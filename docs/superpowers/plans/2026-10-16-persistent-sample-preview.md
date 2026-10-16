# Persistent sample preview implementation plan

> **For agentic workers:** Use subagent-driven-development for independent test work; the main agent owns bundle and preview integration. The user approved implementation of the preceding persistence and redundancy audit.

**Goal:** One preview command reliably opens the same real covers and textured 3D entities, offline after initial material acquisition.

**Architecture:** Commit a public source/checksum lock, keep the complete verified asset bundle and working sample instance outside the repository, and import exclusively through fixed seed definitions and Store transactions. Tests consume the same bundle; engine contracts remain in the independent engine.

**Tech Stack:** Python standard library, existing Node/TypeScript harness, Playwright browser acceptance, Album Engine.

**Spec:** User-approved audit in this conversation and `docs/固定样本真实贴图.md`.

## Global constraints

- No writes to real `data/`, no personal data in tracked artifacts, no direct database mutation outside Store.
- No rendering/geometry changes or loss of the 19 model variants, synthetic raster tests, monetary/concurrency/backup coverage.
- Real artwork acquisition is an explicit bundle preparation operation; subsequent preview startup is offline.
- New engine contents use a new package version and matching viewer/runtime/model artifacts.
- Preserve unrelated uncommitted work. Do not commit, push or deploy.

## Review focus

- A changed directory or missing asset must produce an actionable failure rather than a successful empty preview.
- The full snapshot restores into a fresh directory with networking disabled and the same cover/model sources.
- Corrupt files, wrong bundle/version and stale engine artifacts must fail before the preview is advertised ready.
- Browser acceptance checks actual decoded covers, real per-face resource requests, default 2D and explicit 3D.
- Removing test scaffolding must preserve behavioral assertions and host-specific authorization/transactions.

## Tasks

- [x] Main: add source/checksum lock, bundle capture/fetch/verify/import, fixed preview launcher and complete backup/restore; test missing/corrupt files, offline fresh import, version mismatch and idempotence.
- [x] Engine worker: move the 21 pure-engine tests into engine Python coverage, retain host compatibility smoke tests, add Python CI and bump package version. Main regenerates and installs artifacts after worker checks.
- [x] Web worker: share repeated TS compilation setup; replace 11 source-string tests with browser behavior coverage; add real-art acceptance runner that consumes the fixed preview instance. Keep assertions around geometry/motion and package boundaries.
- [x] Main: capture the real asset bundle, prepare a fresh persistent instance, verify the complete snapshot restore offline, switch the current preview and run real browser acceptance.
- [x] Main: archive redundant initial download directories after bundle validation, remove obsolete unreferenced npm tarballs; preserve referenced frozen sources and active older instances.
- [x] Main: update project instructions/docs/CI pointers, run required tests/builds/Docker and receive a final review.

## Evidence and necessary scope adjustment

Real renderer-request acceptance exposed a missing `Print_insideRight` on the Blender Jewel rear card. Asset/data validation alone could not expose this omission. Added that independent print face without changing geometry, regenerated four shared Jewel templates, and added a failing-then-passing GLB structure regression in the engine. This was necessary to satisfy actual texture acceptance.

Completed evidence is recorded in `docs/superpowers/reports/2026-10-16-persistent-samples.md`. CI configuration is checked locally; the remote workflow has not run. No commit, push or deployment was performed.
