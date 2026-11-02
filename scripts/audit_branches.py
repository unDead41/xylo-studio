"""Read branch readiness without checkout/merge/commit/push. Requires Git >= 2.38.
Run git fetch first, or explicitly pass --fetch. Text merge success is not a build PASS.
"""
from __future__ import annotations
import argparse
import itertools
import json
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone


class AuditError(RuntimeError):
    pass


def git(root: Path, *args: str, ok=(0,)) -> subprocess.CompletedProcess:
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True)
    if result.returncode not in ok:
        raise AuditError(f'git {args[0]} failed ({result.returncode}): {result.stderr.strip()}')
    return result


def resolve(root: Path, ref: str) -> str:
    if ref.startswith('-'):
        raise AuditError('Refs cannot start with an option.')
    return git(root, 'rev-parse', '--verify', '--end-of-options', ref + '^{commit}').stdout.strip()


def changed(root: Path, base: str, head: str) -> list[str]:
    common = git(root, 'merge-base', base, head).stdout.strip()
    return sorted(set(git(root, 'diff', '--name-only', '-z', common, head).stdout.split('\0')) - {''})


def merge_check(root: Path, a: str, b: str) -> dict:
    result = git(root, 'merge-tree', '--write-tree', '--name-only', a, b, ok=(0, 1))
    lines = result.stdout.splitlines()
    paths = []
    for line in lines[1:]:
        if not line:
            break
        paths.append(line)
    return {'text_merge': 'CONFLICT' if result.returncode else 'CLEAN',
            'conflict_paths': paths if result.returncode else [],
            'software_compatibility': 'NOT_TESTED',
            'diagnostic': result.stdout.strip() if result.returncode else ''}


def audit(root: Path, base_ref: str, refs: list[str]) -> dict:
    base_sha = resolve(root, base_ref)
    if len(refs) != len(set(refs)):
        raise AuditError('Duplicate branch refs are not allowed.')
    report = {'schema': 1, 'recorded_at_utc': datetime.now(timezone.utc).isoformat(),
              'base_ref': base_ref, 'base_sha': base_sha,
              'head_sha': resolve(root, 'HEAD'),
              'working_tree_dirty': bool(git(root, 'status', '--porcelain').stdout.strip()),
              'freshness': 'LOCAL_REFS; require fetch immediately before use',
              'branches': [], 'pairs': [], 'errors': []}
    heads = {}
    for ref in refs:
        try:
            sha = resolve(root, ref)
            behind, ahead = map(int, git(root, 'rev-list', '--left-right', '--count', base_sha + '...' + sha).stdout.split())
            paths = changed(root, base_sha, sha)
            check = merge_check(root, base_sha, sha)
            report['branches'].append({'ref': ref, 'sha': sha, 'ahead_of_main': ahead,
                                       'behind_main': behind, 'changed_paths': paths, **check})
            heads[ref] = sha
        except AuditError as exc:
            report['errors'].append({'ref': ref, 'error': str(exc)})
    for a, b in itertools.combinations(heads, 2):
        try:
            check = merge_check(root, heads[a], heads[b])
            overlap = sorted(set(changed(root, base_sha, heads[a])) & set(changed(root, base_sha, heads[b])))
            report['pairs'].append({'a': a, 'b': b, 'overlap_paths': overlap, **check})
        except AuditError as exc:
            report['errors'].append({'pair': [a, b], 'error': str(exc)})
    blocked = bool(report['errors']) or any(b['behind_main'] or b['text_merge'] == 'CONFLICT' for b in report['branches']) or any(p['text_merge'] == 'CONFLICT' for p in report['pairs'])
    report['branch_readiness'] = 'BLOCKED' if blocked else 'TEXT_SYNC_CHECK_PASSED'
    report['publication_approved'] = False
    report['limits'] = 'No test, semantic/API or browser acceptance performed by this tool.'
    return report


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    p.add_argument('--base', default='origin/main')
    p.add_argument('--branch', action='append', dest='branches')
    p.add_argument('--fetch', action='store_true', help='Fetch origin and prune remote-tracking refs; never changes local branches.')
    p.add_argument('--output', type=Path, help='Explicit JSON output path; outside the worktree is recommended.')
    a = p.parse_args()
    try:
        if a.fetch:
            git(a.root, 'fetch', '--prune', 'origin')
        report = audit(a.root, a.base, a.branches or ['origin/architecture', 'origin/music', 'origin/gameplay', 'origin/ui'])
    except (AuditError, OSError) as exc:
        print(f'BLOCKED: {exc}', file=sys.stderr)
        return 2
    if a.fetch:
        report['freshness'] = 'Fetched origin for this run; SHA snapshot may still change after the fetch.'
    payload = json.dumps(report, indent=2, ensure_ascii=False) + '\n'
    if a.output:
        a.output.write_text(payload, encoding='utf-8')
    print(payload, end='')
    if report['errors']:
        return 2
    return 1 if report['branch_readiness'] == 'BLOCKED' else 0


if __name__ == '__main__':
    raise SystemExit(main())
