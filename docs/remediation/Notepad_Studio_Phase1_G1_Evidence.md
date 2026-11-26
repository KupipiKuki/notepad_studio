# Notepad Studio — Phase 1 G1 evidence record

Implementation date: November 26, 2026 (America/New_York). Evidence timestamps use UTC.
Branch: `wp/phase1`.
Scope: the final Phase 1 work item approved by the auditor (native open path) and the consolidated G1 disposition against `notepad_studio_remediation_plan.md` §4. This record proposes **G1 review**; per project rule it does not self-declare the gate.

## 1. G1 batch — every open path shares the verified decode and size guard

The P09/P17 QA/QC report's residual observation was the last open checklist item: `openFileNativeOrFallback` used `file.text()` on native handles, so the P17 decode pipeline and the 2 MiB guard did not cover the native picker path (`file.text()` silently strips the UTF-8 BOM per the UTF-8 decode algorithm and replaces invalid bytes with U+FFFD without any warning).

### Changes

- `scripts/notepad-studio.html`: new `openFileWithPolicy(file, attachHandle)` is the single open pipeline — 2 MiB size guard, `decodeFileBuffer` verified decode (UTF-8/UTF-16 BOM handling, fatal-decode lossy warning, binary detection), toast + durable log surfacing, optional native-handle attachment. `handleFiles` (file input + drag/drop) and the `showOpenFilePicker` path now both call it; the native path no longer reads `file.text()`.
- `tests/phase1-split-encoding.spec.js`: three new native-path regressions (the picker is replaced with synthetic in-page handles; still not the real OS picker UI):
  - `P17 native open: the picker path decodes through the verified pipeline` — same BOM + Latin-1 E9 fixture as the input-path regression: BOM preserved, U+FFFD decode with the "not valid UTF-8" toast + log, and the attached native handle saves back the exact policy payload (`\uFEFFcaf\uFFFD\r\n`, CRLF selected) with an honest un-normalized `savedContent` snapshot, `dirty=false`, status `Saved`.
  - `P17 native open: oversized files are refused with the same feedback` — 3 MB in-page fixture: no tab created, limit toast, log entry, workspace untouched.
  - `P17 native open: valid UTF-8 opens cleanly with no false warnings` — clean decode, ordinary "Created" feedback, status stays `0 Errors` (no policy noise).
- Regression validity: the picker-path and oversized tests **fail against the committed pre-fix app** (observed); the clean control passes on both (it is a control, not the regression). The fix restores all three.

### Verification performed

Windows 11, Node v24.20.0, Playwright 1.65.1.

- Full committed suite, the exact CI command `npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox`: **52 passed / 0 failed / 0 skipped** (26 scenarios × 2 browsers).
- Configured CI (`ubuntu-latest`) reran on push of this batch (run link recorded at commit time in the follow-up).

## 2. Phase 1 checklist disposition (plan §4, G1 = "no silent loss or false clean state in tested save/cancel/permission/quota/split-edit scenarios; exact bytes and pre/post states match for all supported file formats and line endings")

| Plan work item | Implementation | Regression evidence | QA/QC |
| --- | --- | --- | --- |
| Separate "workspace auto-saved", "download initiated", "native write completed", "disk save failed", "unsaved" states; do not mark saved merely because a download click fired | P01/P11 first batch: fallback download keeps dirty, honest indicators | `P01: fallback download with suppressed click keeps dirty state honest`, `P01/P11: real fallback download keeps honest state and exact CRLF bytes` | PASS (`afb4ce6` R02RL QA/QC base lineage, correction batch records) |
| Immutable snapshots during async native writes; mid-write edits keep dirty; status resolves against the original tab | P02/R03: `contentSnapshot` + `completeNativeSave` snapshot comparison; `saveActiveFile({tab, content})` fallback snapshot | P02 scenarios ×4, R03 ×2 | PASS (independently verified in prior QA/QC reports) |
| One explicit encoding/line-ending policy for native and fallback save; clarify what editor text normalized | P11: `normalizeLineEndingsForSave` applied to every save path; editor text keeps stored endings un-normalized | P01/P11, P02 exact-byte assertions (`snapshot before\r\nwrite`, `a\r\nb\r\nc\r\n…`) | PASS |
| Storage load failures as recovery mode; preserve raw payload instead of resetting and overwriting | P03 + R01/R02/R02-RL: recovery key, recovery tab, guard re-armed across reloads | 15 save-recovery scenarios incl. quota, denied writes, unseeded reload | PASS (`Notepad_Studio_wp_phase1_R02RL_QAQC_Evidence.md`) |
| Validate persistence schema and legacy data; preserve documents, macros, bookmarks | P16: `sanitizePersistedTab` coerces without inventing/discarding | `P16: malformed persisted model is sanitized without bootstrap failure` | PASS |
| Split-pane edited text survives selection, close, toolbar save, disk save, reload | P09: same-tab bidirectional sync (`syncSplitViewIfSameTab`), close-repopulation | P09 ×2 (fail-without-fix verified in two QC cycles) | PASS (`Notepad_Studio_wp_phase1_P09_P17_QAQC_Evidence.md`) |
| Warn about unsupported/binary encodings and large files; **test every open path**; true download/file write bytes | P17: input+drag/drop+native picker all through `openFileWithPolicy` (this batch) | P17 ×5 input-path + ×3 native-path, incl. byte-exact save round trips | This batch (proposes verification) |
| Recovery/confirmation where closing dirty tabs could discard the only copy | `closeTab` confirm() on dirty tabs; autosave-blocked recovery path | `P09: closing a split-displayed dirty tab…` (dialog asserted), R02-RL blocked autosave | PASS |

Cumulative committed suite at this batch: **52 tests** (15 save-recovery + 11 split/encoding scenarios) × chromium/firefox, run locally and in the configured Ubuntu CI.

## 3. Explicit non-claims (unchanged limits)

- The native picker replacements in tests are synthetic in-page handles at API boundaries; the real Windows picker UI, OS permission grants and true OS disk writes remain unvalidated (as in every prior batch).
- WebKit; the real OS writing of the native save path; UTF-16 without a BOM (no marker — outside policy); files above the 2 MiB open limit (refused by policy, not "supported").
- Phase 2+ findings (P04–P08, P10, P12–P15, P18–P21) and the B01/B02/A3 architecture gates remain open and out of G1's scope.

## 4. Change register

| File | Change |
| --- | --- |
| `scripts/notepad-studio.html` | `openFileWithPolicy` shared open pipeline; `handleFiles` and the native picker path now both use it (native path no longer `file.text()`) |
| `tests/phase1-split-encoding.spec.js` | 3 new native-open regressions (17 scenarios in this spec) |
| `docs/remediation/Notepad_Studio_Phase1_G1_Evidence.md` | This record |
