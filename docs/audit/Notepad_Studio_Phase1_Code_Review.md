# Notepad Studio — Code review of the Phase 1 implementation batch (for the auditor)

Review date: November 19, 2026 (UTC)
Reviewed branch: `wp/phase0`, commit `6d3e2e17624d9f3f16eea316fdf93c1a0b626370` ("Phase 1 (P0 data integrity)…"), based on `vibe/remediation-plan` @ `6e25cdc`.
Baseline reviewed against: `main` @ `2437b1c`, application Git blob `d29dfa5785ba62e89ced8386dd022dbec5b42890` (SHA-256 `962e4a66…cc89`, per the Phase 0 review).
Reviewer method: full diff read (`git show`), re-inspection of every changed region in the working tree, syntax check of the inline script (`node --check`), re-execution of the committed Playwright spec on Chromium and Firefox, plus five additional ad-hoc browser probes for paths the spec does not cover. Read-only with respect to application code; no app files were modified by this review.

## 1. Commit inventory and checksums (post-commit working tree)

| File | SHA-256 |
| --- | --- |
| `scripts/notepad-studio.html` | `6b3d88e5849b28987e6db203d836267e3b3095d56f81e7484e25fdd527b03834` |
| `tests/phase1-save-recovery.spec.js` | `68c34cdcd9a639780e417626ed07a72bd248ce5bcd13672e51545a48ea36c65e` |
| `docs/remediation/Notepad_Studio_Phase1_Implementation_Record.md` | `3234d0a0e478c01ac6f2d54f323e1c4737bd7450197d893a387f6181b7e3fd2e` |

Diffstat: 3 files, 586 insertions(+), 73 deletions(-). The application diff touches only the persistence/save region of the single-file app; no markup, CSS, CDN pins, or storage-key names changed (`npp_studio_state_v1`, `npp_theme`, `gemini_studio_transfer_queue_v1`, `gemini_studio_bus` unchanged). One new storage key is introduced: `npp_studio_state_v1_recovery`.

## 2. Per-finding disposition of the audited Phase 0 findings

| Finding | Phase 0 disposition | This batch's change | Review verdict |
| --- | --- | --- | --- |
| P01 (false "Saved" on download click) | Reproduced | `saveActiveFile` no longer mutates `savedContent`/`dirty`/indicator; toast changed to "Download started: … - confirm it in your browser downloads"; anchor-click exceptions are caught, logged, and surfaced | **Fixed, verified** (spec tests 1–2; probe 3) |
| P02 (native write races; wrong-tab Save As) | Reproduced, incl. wrong-tab variant | `contentSnapshot` captured synchronously before any `await`; `completeNativeSave(tab, snapshot)` resolves against the original tab and recomputes `dirty` from live text; Save As picker errors separated from write errors; UI refresh (`refreshWorkspaceUI`) always derives from the active tab | **Fixed, verified** (spec tests 3–6; probe 1 covers the existing-handle `fileHandles` branch) |
| P03 (silent reset on corrupt state; no recovery action) | Reproduced | Corrupt/unusable payload preserved in `npp_studio_state_v1_recovery` **and** as an editable `workspace-recovery.json` tab; error-log entry + toast; quota-failure toast deduped per session (`storageWarningShown`); new "Download Workspace Backup" palette command | **Fixed, verified** (spec test 7; probes 4–5). Residual notes in §4 |
| P11 (native vs fallback line endings) | Reproduced with real bytes | Single `normalizeLineEndingsForSave()` used by fallback download and both native write paths; `savedContent` deliberately keeps editor text so dirty comparison stays consistent | **Fixed, verified** (spec tests 2, 3, 5 assert exact written bytes incl. CRLF; probe 1 asserts `line1\r\nline2` on the handle path) |
| P16 (malformed model crashes bootstrap) | Reproduced (`e.split is not a function`) | `sanitizePersistedTab` validates/dedupes ids, defaults names, coerces primitive contents to strings, validates modes against the 12 known modes with `detectMode` fallback, filters bookmarks to integers, recomputes `dirty`; repaired states backed up to the recovery key | **Fixed, verified** (spec test 8: no page errors, unique ids, `content: 17` → `"17"`, bad mode → `text`, bad bookmarks dropped) |
| P09, P17, P12, others | Various | Not in this batch's scope | Unchanged; remain open per plan |

## 3. Verification evidence (re-executed during this review)

- Committed spec `tests/phase1-save-recovery.spec.js`: **16/16 passed** (8 tests × Chromium 159 and Firefox 159, Windows, Playwright 1.65.1; file:// origin for state/fault-injection scenarios, loopback HTTP for real-download scenarios — matching the Phase 0 audit environments). No page errors in any test.
- Ad-hoc probes (Chromium, this review), all clean of page errors:
  1. **Native handle save** (plain Save after Save As seeded a handle): two writes `line1\r\nline2`, `second edit\r\nwith lines` (P11 normalization on the handle path), `savedContent` = editor text, `dirty=false`, indicator "Saved".
  2. **Valid-state reload round trip**: content, wrap, tabSize=4, LF, symbols, ruler=1, theme all preserved; **no spurious recovery key** (`npp_studio_state_v1_recovery` is null); command palette now has **21** entries (was 20 — the deliberate addition of "Download Workspace Backup").
  3. **Clean-tab fallback save** over HTTP: downloaded bytes exactly `clean\r\ncontent`; tab was already clean so `dirty` stays false and the indicator stays "Saved" — i.e., the P01 fix only changes behavior for documents with unsaved edits, as intended.
  4. **Workspace backup command**: downloads `notepad-studio-workspace-backup.json`, parses as JSON, contains all open tabs.
  5. **Recovery reload stability**: corrupt payload → edit → autosave → reload yields exactly one `workspace-recovery.json` tab, recovery key intact with the raw payload, the edit persisted, no errors.

## 4. Reviewer observations and residual notes

1. **Deliberate behavior change (flagged, not a defect):** a document whose only save was a fallback Blob download now remains dirty, so closing it prompts for confirmation. This is the plan-mandated honest state ("do not mark a file saved merely because a Blob download click fired"). The implementation record documents it.
2. **Recovery tab is not dirty** (`createTab` sets `savedContent = content`): closing `workspace-recovery.json` will not prompt, but the raw payload is additionally held in the recovery key, so no data is at risk. Consider marking it dirty in a future pass so the user is nudged to export it.
3. **Non-primitive persisted content** (e.g., an object) is coerced to `''` and flagged as repaired; primitives (number/boolean) are stringified and preserved. Original raw is backed up whenever any repair occurs. Acceptable; object-typed content was never renderable and previously crashed the app.
4. **Recovery key is last-write-wins**: a second corrupt payload overwrites `npp_studio_state_v1_recovery`. In practice the previous payload is also embedded in the persisted recovery tab, so nothing is silently lost; noted for completeness.
5. **Toast dedupe** (`storageWarningShown`) resets only on a successful `persistState`; error-log entries still record every failure (with count coalescing). Verified by code read; the genuine-quota scenario itself was covered in Phase 0, not re-run here.
6. **Palette count changed 20 → 21** (new command). Any test or doc asserting exactly 20 entries must be updated; the Phase 0 audit's "palette contains 20 entries" observation is now outdated by design.
7. **`savedContent` semantics** are now uniformly "last confirmed-good copy"; all consumers (change handlers, split-pane sync, dirty computation) were re-checked and are consistent.
8. **Not verified here** (unchanged from Phase 0 limits): real Windows picker/OS file writes and permission UI (API-boundary injection only), WebKit/Safari run, genuine quota-exhaustion run, and all non-batch findings (P04–P10, P12–P15, P17–P21). The spec's HTTP download coverage uses Chromium/Firefox only.
9. **Repo hygiene:** the commit intentionally excludes the pre-existing untracked Phase 0 artifacts (`package.json`, `playwright.config.js`, `tests/example.spec.js`, `docs/audit/…`, `.github/`, `.gitignore`). The new spec depends on that untracked Playwright setup; committing the harness itself is finding P20's decision, not this batch's.

## 5. Verdict

The batch is **source-consistent, minimal, and evidence-backed**: every changed region was re-read, the inline script passes `node --check`, the committed spec passes 16/16 across Chromium and Firefox, and five additional probes confirm the uncovered save/recovery paths with zero page errors. P01, P02, P03, P11, and P16 are fixed with browser-verified regression evidence at API boundaries. No unrelated reformatting, storage-key drift, or removed controls were found in the diff. The residual notes in §4 are recorded for the auditor; none block the batch.
