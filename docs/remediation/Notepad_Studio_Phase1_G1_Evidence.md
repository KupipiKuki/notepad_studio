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
- Configured CI (`ubuntu-latest`) reran on push of this batch: GitHub Actions run [45748514671](https://github.com/KupipiKuki/notepad_studio/actions/runs/45748514671) (`Playwright Tests`, event `push`, branch `wp/phase1`, head `7a39b47`) completed with conclusion `success`, including `Run Playwright tests` (`npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox`). Playwright exits non-zero on any failed test, so the successful step is direct evidence that all 52 tests (26 scenarios × 2 browsers) passed in the intended Linux environment. The `playwright-report` artifact was uploaded from that run.

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
| `tests/phase1-split-encoding.spec.js` | 3 new native-open regressions (this batch: 11 scenarios in this spec; 15 save-recovery + 11 split/encoding = 26 total — count corrected per the independent G1 review's documentation nit) |
| `docs/remediation/Notepad_Studio_Phase1_G1_Evidence.md` | This record |

## 5. G1 hold follow-up — malformed BOM-marked UTF-16 disclosure

Follow-up date: November 26, 2026 (America/New_York). Trigger: `docs/audit/Notepad_Studio_G1_Independent_Review.md` (decision HOLD on the malformed UTF-16 warning gap; the native-open pipeline batch itself was credited). Policy chosen from the review's options: **lossy fallback with an explicit encoding-specific warning** (consistent with the accepted UTF-8 policy), not rejection.

### Changes

- `scripts/notepad-studio.html` (`decodeFileBuffer`): both UTF-16 branches now decode the body with `TextDecoder('utf-16{le,be}', { fatal: true })` first exactly like the UTF-8 branches. On invalid input (e.g. a truncated final code unit) the non-fatal fallback decode keeps the U+FFFD placeholder and emits "File contained bytes that are not valid UTF-16{LE,BE}; they are shown as U+FFFD and re-saving will not reproduce the original bytes." (toast + durable log entry). The conversion notice ("decoded as UTF-16, saves are UTF-8") is unchanged and ordinary conversion remains disclosed, as the review required.
- `tests/phase1-split-encoding.spec.js` — four new/updated regressions (fixtures are the review probe's exact hex):
  - `P17: malformed UTF-16LE is reported and re-exported with the stated loss` — `FF FE + "abcde" + 0x66` (truncated LE unit): value `abcde\uFFFD`, "not valid UTF-16LE" toast + log, and the save re-exports the documented output bytes exactly (`abcde<U+FFFD>` = `EF BF BD`).
  - `P17: malformed UTF-16BE is reported and re-exported with the stated loss` — `FE FF + "abcde" BE + 0x00` (truncated BE unit): same assertions with the BE-specific disclosure.
  - `P17: valid UTF-16BE decodes cleanly with no false invalid-data warning` — valid BE control (previously only LE was covered): decodes `abcde`, conversion notice only, toast asserted **not** to contain "not valid".
  - `P17 native open: malformed UTF-16LE through the picker gets the same policy` — the same malformed LE fixture through the native API boundary (shared `openFileWithPolicy` pipeline), proving the native path receives the identical disclosure. Additionally the existing valid-LE test was extended to assert no false "not valid" warning (valid control with no false invalid-data claim).
- The documentation nit from the review is corrected in §4 (11 split/encoding scenarios at that batch, not 17).

### Regression validity

All three malformed-data tests **fail against the committed pre-fix app** (observed: silent U+FFFD, no warning — the review's reproduction), and both valid controls pass on it. With the fix restored, all five UTF-16 scenarios pass.

### Verification performed

- Full committed suite, the exact CI command: **60 passed / 0 failed / 0 skipped** (30 scenarios × 2 browsers = 15 save-recovery + 15 split/encoding).
- Configured CI (`ubuntu-latest`) reran on push of this frozen corrected candidate: GitHub Actions run [45826357108](https://github.com/KupipiKuki/notepad_studio/actions/runs/45826357108) (`Playwright Tests`, event `push`, branch `wp/phase1`, head `b223edf`) completed with conclusion `success`, including `Run Playwright tests` (`npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox`). Playwright exits non-zero on any failed test, so the successful step is direct evidence that all 60 tests (30 scenarios × 2 browsers) passed in the intended Linux environment. The `playwright-report` artifact was uploaded from that run.

### Updated gate disposition

The corrected scenario counts are: `tests/phase1-save-recovery.spec.js` 15 scenarios, `tests/phase1-split-encoding.spec.js` 15 scenarios, 60 tests across chromium/firefox. The Phase 1 checklist disposition in §2 is otherwise unchanged; the "test every open path" row now also covers malformed UTF-16 through both the input and native boundaries with valid controls. This record still proposes G1 review — the independent reviewer's re-verification decides the gate.
