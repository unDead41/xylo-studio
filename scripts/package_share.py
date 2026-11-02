"""Create the self-contained digital distribution without publishing it."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import zipfile

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args(); target=args.output.resolve()
    if target==ROOT or ROOT in target.parents:
        parser.error('Output must be outside the source repository.')
    if target.exists() and any(target.iterdir()):
        parser.error('Output must be absent or empty; existing files are never deleted.')
    target.mkdir(parents=True,exist_ok=True)
    for name in ['index.html','VERSION','SETUP.md','.nojekyll']:
        shutil.copy2(ROOT/name,target/name)
    version=(ROOT/'VERSION').read_text().strip()
    (target/'README.md').write_text(f'# Xylo Studio {version}\n\nExtract ZIP dan buka index.html dalam Chrome/Edge. Tiada pemasangan diperlukan untuk bermain. Mikrofon pilihan memerlukan HTTPS/localhost. Panduan: SETUP.md.\n',encoding='utf-8')
    hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(target.iterdir()) if p.is_file()}
    (target/'SHARE_MANIFEST.json').write_text(json.dumps({'schema':1,'version':version,'files_sha256':hashes},indent=2)+'\n')
    archive=target.with_suffix('.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for file in sorted(target.iterdir()):
            if file.is_file(): z.write(file,str(Path('xylo-studio')/file.name))
    print(archive)


if __name__=='__main__':
    main()
