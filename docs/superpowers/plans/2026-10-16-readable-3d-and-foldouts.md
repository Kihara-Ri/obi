# Readable album inspection and complete foldouts

> **For agentic workers:** Use subagent-driven-development for the independent paper protocol/Blender task, then fresh review. Main owns camera, input, host integration and real browser checks. User supplied concrete behavior and authorized implementation; no commit, push or deployment.

**Goal:** Comparable 2D/3D initial body size, moderate CD inspection size, independent readable roll for free objects, complete two-sided unfolding paper.

**Architecture:** Keep camera centered on the album; initial distance fits the closed cover rather than the clearance sphere. Free components retain separate inspection poses, including roll. Canonical optional fold metadata drives authored Blender hinges and full-sheet UVs; physical stowed dimensions remain unchanged. Host only updates fixed reference declarations and engine distribution.

**Tech Stack:** TypeScript/Three.js/React, Blender GLB, shared JSON schema, standard-library Python runtime, existing fixed offline sample bundle.

**Spec:** User images and instructions this turn. Lift sheets have four panels on each side; Illinois strip has six, verified against locked originals. Accordion template is a nominal reconstruction, not a measured assertion about a physical copy. No invented print content or missing backside substitution.

## Global constraints

- All modeling in Blender; no runtime replacement mesh. Canonical schema owns fold data and Python/TS must preserve it through publish/readback.
- Default 2D, explicit 3D, no CSS fallback, actual data/ untouched. Fixed sample definitions and persistent preview only.
- Camera never follows withdrawn contents. Physical mount/disc sizes and collision clearance retained; detached inspection may fit uniformly to readable screen workspace, restored fully on stow.
- Preserve dirty work, generation leases, monetary/business tests. New local engine version 0.2.2 with matching runtime/viewer/models.

## Review focus

- Closed 3D album projected size agrees with 2D card at desktop/mobile, regardless of accessory count; unfolding and extraction do not move camera center.
- CD fits a moderate fraction of the viewport; roll rotates lettering around its own normal, independently from album/other parts, including negative angles and reversal.
- Sheet UVs include every panel on both sides once, no cropped-away panels or mirroring. Only explicit fold metadata enables unfolding.
- Fold before stow and before closing package; interrupt/reverse safely; folded physical dimensions fit their existing mount.
- Bundle updates archive before changing versions; raw source images persist unchanged; rebuilt preview passes actual requests/visual checks after restart.

## Tasks

- [ ] Paper worker: optional canonical `fold: {pattern:'accordion', panels:2..6}` on booklet; preserve validation/roundtrip in Python, generated TS, compatibility envelope and viewer records. New Blender authored component-foldout template supports 2..6 leaves via reusable hinge hierarchy, complete per-panel UV intervals, front/back print. Existing booklet unchanged without fold metadata. Tests fail before implementation and cover full UV extent, correct back orientation, hinges/intermediate states, stowed dimensions, schema roundtrip. Wire accessory preparation and pure `paintPaperFold(part, amount)`; main wires scene controls.
- [ ] Main: regression for actual projected initial cover height; replace workspace-only distance with viewport-aware closed-cover framing, keep camera center independent from contents. CD inspection target smaller and bounded. Moderate fit of detached paper without changing stowed geometry.
- [ ] Main: add z/roll to inspection poses, rim drag/Shift drag + Q/E keyboard continuous/quarter rotations, preserve central drag yaw/pitch. Own independent paper fold state, double-click or F to toggle free paper; Enter/click keeps existing take/stow; close folds before return. Update accessible description and dataset used for real gesture tests.
- [ ] Main: fixed sample Lift4/Illinois6 full front/back declarations and coverage; engine0.2.2 build/runtime export/pack, host build, version lock refresh, archive and rebuild fixed preview offline. Real screenshots compare initial size and moderate CD, exercise pointer roll and complete paper unfolding/refolding.
- [ ] Fresh reviewer: inspect behavior and protocol/collision/cleanup contracts; fix material issues. Run engine Node/Python/typecheck/build/Studio, host backend/web/typecheck/build/Docker, leak scan/diff check. Update docs and evidence with actual limitations.
