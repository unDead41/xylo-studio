# Repository Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the approved role branches and a self-contained digital project.

**Architecture:** Preserve verified worker sources in Git history. Audit the actual integrated tree, then publish main and the approved branch names; generate share using an explicit file allowlist.

**Tech Stack:** HTML, Web Audio, JavaScript, Node test runner.

**Spec:** docs/specs/2026-11-02-branch-workflow.md

## Global Constraints

- Branch names and chat names follow docs/BRANCH_POLICY.md.
- Tutorial and share content update only on explicit user request after initial migration.
- No force push, history rewrite or fabricated hardware/browser measurements.

## Review Focus

- Source filters must build the actual candidate rather than a historical fixture.
- Historical evidence must not be presented as a current PASS.
- Share ZIP extraction must include every dependency needed for its documented setup.
- Removing retired names must retain original commits in main history.
- Remote changes during work must be detected before publishing.

### Task 1: Preserve and prepare sources

Files: source, include, tests and existing documentation.

- [x] Fetch source trees and verify every blob SHA.
- [x] Materialize isolated candidates and record original refs.

### Task 2: Clean the active project

Files: index.html, tests/, AGENTS.md, README.md, VERSION, docs/SOR.md.

- [x] Run existing relevant tests and reproduce separation/integration defects.
- [x] Apply minimal fixes and verify affected behavior.
- [ ] Run all relevant checks on the final candidate and obtain independent reviews.

### Task 3: Publish the approved workflow

Files: docs/BRANCH_POLICY.md, docs/BRANCHES.json, setup/quickstart and release metadata.

- [ ] Build and test the share ZIP from an explicit allowlist.
- [ ] Publish with original worker heads as parents; verify refs and CI.
- [ ] Create approved branches, retire old names after ancestry verification, and record version tags.
