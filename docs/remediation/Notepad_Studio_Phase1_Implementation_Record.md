# Notepad Studio — Phase 1 implementation record (first change batch)

Branch: `wp/phase0` (based on `vibe/remediation-plan`)
Application commit: this batch; baseline remains `main` @ `2437b1c` (Git blob `d29dfa57…`, unchanged by this batch until this commit).
Scope: Phase 1 P0 data-integrity path from the remediation plan's first implementation checkpoint — save/write/state consistency (P01, P02, P03), save line-ending policy (P11), persisted-model sanitation (P16). Findings P09, P17 and the remaining Phase 1 items are not addressed in this batch.

## Change register

| ID | Finding | Change | Regression evidence |
| --- | --- | --- | --- |
| D001 | P01 | `saveActiveFile` (Blob fallback) no longer sets `savedContent`, clears `dirty`, or flips the indicator. A download click only initiates a browser download; the status stays `Unsaved changes`, the toast says `Download started: … - confirm it in your browser downloads`, and download-start failures are logged instead of silently claimed. | `tests/phase1-save-recovery.spec.js` tests 1–2, Chromium + Firefox |
| D002 | P02 | `saveFileNativeOrFallback` snapshots the editor text synchronously before any `await`. Native completion (`completeNativeSave`) resolves against the *original* tab: `savedContent` = written snapshot, `dirty` recomputed from live text (edits during pending I/O keep the tab dirty). Save As with a tab switch mid-picker now writes/renames/finalizes the original tab, never the newly active one. UI refresh reflects the active tab only. | Tests 3–5, Chromium + Firefox |
| D003 | P11 | New `normalizeLineEndingsForSave()` is the single line-ending policy; both native write paths and the fallback download now emit the selected CRLF/LF conversion (native path previously always wrote raw editor text). `savedContent` intentionally stores editor text, not the converted bytes (dirty comparison stays consistent with `editor.getValue()`). | Tests 2–3, 5 (written/downloaded byte assertions) |
| D004 | P03 | Corrupt/invalid persisted state no longer silently resets: the raw payload is preserved under `npp_studio_state_v1_recovery`, surfaced as an editable/savable `workspace-recovery.json` tab alongside starter tabs, logged in the error log and toast. Autosave after recovery does not destroy the backup or the in-tab raw copy. Quota failures during autosave now warn once per failure (session flag `storageWarningShown`) instead of toasting on every debounce cycle, and a new **Download Workspace Backup** command gives an explicit recovery action. | Test 7 (P03), command palette entry |
| D005 | P16 | `loadState` sanitizes every persisted tab before it reaches CodeMirror: ids validated/deduplicated, names defaulted, contents coerced from primitives to strings, modes validated against the known mode set with `detectMode` fallback, bookmarks filtered to integers, `dirty` recomputed. Original persisted data preserved when repairs occur. The `e.split is not a function` bootstrap crash from the audit no longer occurs. | Test 8 (P16), Chromium + Firefox |
| D006 | P01/P03 | Shared `triggerTextDownload()` and `buildWorkspaceData()` helpers; `persistState` and the backup download use one data shape. | All tests above |

## Verification

- `tests/phase1-save-recovery.spec.js`: 8/8 passed on Chromium (Playwright 1.65.1, file:// for state/fault-injection scenarios, loopback HTTP for real-download scenarios, matching the Phase 0 audit environments) and 8/8 passed on Firefox, Windows.
- Scenario coverage: suppressed download click; real download exact bytes (`alpha\r\nbeta\r\nEDITED`); edit during pending native write; tab switch during pending Save As picker; race-free native save reaching clean state; picker cancellation; corrupt stored workspace recovery (raw preserved in recovery key + recovery tab across a subsequent autosave); malformed model with duplicate ids, numeric content, invalid mode/bookmarks.

## Explicitly not verified in this batch

- Native Windows picker UI, real OS file writes, and permission grants remain boundary-injected (per Phase 0 limitation).
- P09/P13 split-history variants, P17 encoding/BOM handling, P12 macro `try/finally`, and quota-exhausted real-browser storage were not retested here.
- WebKit/Safari was not run; the IE/Edge print matrix and Studio Bus scenarios are untouched (P10/P21 belong to Phase 4).
- Imposed behavior change: documents whose only save was a fallback download now remain dirty (close/quit may prompt to confirm). This is the plan-required honest state for an unconfirmed download.

## Tooling note

The Playwright setup (`package.json`, `playwright.config.js`, `@playwright/test`, browser installs) and `docs/audit/Notepad_Studio_Phase0_Review.md` pre-exist as untracked files from the Phase 0 review and are intentionally not included in this batch's commits.
