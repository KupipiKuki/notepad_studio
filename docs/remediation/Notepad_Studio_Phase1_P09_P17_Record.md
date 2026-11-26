# Notepad Studio — Phase 1 completion: P09 & P17

Implementation date: November 26, 2026 (America/New_York). Evidence timestamps use UTC.
Branch: `wp/phase1`.
Scope: the remaining Phase 1 coding work cleared by the auditor — P09 (split-pane edit lifecycle) and P17 (encoding / byte fidelity and open-size policy) — after the R02-RL remediation batch passed QA/QC (`docs/audit/Notepad_Studio_wp_phase1_R02RL_QAQC_Evidence.md`, decision PASS, base `afb4ce6`/`4dd7a57`). No other findings are claimed closed by this batch.

## 1. Finding definitions (Phase 0 review register)

- **P09** — "Loss NOT reproduced in tested split lifecycle … Same-tab split/save/close and broader lifecycle combinations remain unverified."
- **P17** — "UTF-8 BOM removed on read; non-ASCII text survives but LF becomes selected CRLF on save. Latin-1 byte E9 decodes as U+FFFD and re-exports EF BF BD; binary FF/FE/80 similarly replaced. No unsupported-encoding/binary warning observed. Large-file input limits and native open path remain unverified."

## 2. Changes to `scripts/notepad-studio.html`

### P09 — same-tab split synchronization

Source analysis found a real defect in the unverified same-tab combination: the primary editor's change handler never updated the secondary editor when the split pane showed the **same** tab, while the secondary handler always wrote its full value back to the tab. A stale secondary value therefore discarded all primary edits on the next split edit.

- New `syncSplitViewIfSameTab()` mirrors tab content into the secondary editor whenever the open split pane shows the active tab (cursor preserved, guarded by `isSwitchingTab` so no change loop or write-back echo occurs).
- The primary `change` handler calls it after the normal tab update. Secondary→primary synchronization was already correct; edits now flow both directions and persist through autosave.

### P17 — honest open policy

`handleFiles` switched from `readAsText` (silent lossy UTF-8 decode, BOM stripped by the browser's encoding-sniffing algorithm) to a verified decode pipeline over `readAsArrayBuffer`:

- **Open-size guard**: files over `MAX_OPEN_BYTES` (2 MiB) are refused before reading, with a log entry and a toast naming the limit; no tab is created and the workspace is untouched. (The native open path via `showOpenFilePicker` remains a native-UI deferral, as in all previous batches.)
- **UTF-8 BOM fidelity**: a leading `EF BB BF` is detected and re-inserted as the U+FEFF document character, so saves (UTF-8 `Blob`) reproduce the original byte prefix instead of dropping it on read. Surfaced via toast + durable log entry.
- **UTF-16 BOM decode**: `FF FE`/`FE FF` files decode per their mark (`utf-16le`/`utf-16be`) with an explicit notice; previously they became U+FFFD noise.
- **Lossy-decode honesty**: decode is attempted with `fatal: true`; if the file is not valid UTF-8, the non-lossy fallback decode keeps U+FFFD placeholders but warns that re-saving will not reproduce the original bytes (toast + log entry). This replaces the silent replacement the audit found.
- **Binary detection**: control characters (code points below 0x20, tab/newline excepted, plus 0x7F) beyond 10% of content, or U+FFFD placeholder density beyond 30%, triggers an "appears to be binary" warning. A few undecodable bytes in a text file stays a decode warning, not a mislabel as binary.

Save-side policy is unchanged: saves are UTF-8 with the selected line-ending normalization (the P11 policy is explicit and tested; the audit's "LF becomes CRLF" observation is that policy, not a defect).

## 3. Test harness changes

New committed spec `tests/phase1-split-encoding.spec.js` (7 scenarios, same portable R04 app resolution and once-per-context seeding as the save-recovery spec):

| Test | Covers |
| --- | --- |
| P09: same-tab split edits sync in both directions and survive a reload | Primary edit reaches the secondary pane; secondary edit writes back and re-syncs primary; honest dirty state; persisted and reopened intact. **Verified to fail when the fix is disabled.** |
| P09: closing a split-displayed dirty tab repopulates the split and persists | Dirty-close confirmation; split select repopulated away from the closed tab; secondary pane shows the retained tab; workspace without the closed tab persists and reloads. |
| P17: UTF-8 BOM survives open and save as exact bytes | BOM preserved in the document, notice surfaced, and the downloaded save reproduces the input bytes exactly (LF selected). |
| P17: invalid UTF-8 bytes are reported and re-exported with the stated loss | Latin-1 E9 loaded honestly as U+FFFD with the "not valid UTF-8" warning; re-export asserted as EF BF BD per the advertised policy. |
| P17: apparent binary files open with an explicit binary warning | Audit's binary fixture decoded, warned and logged; no silent corruption feedback gap. |
| P17: files over the open limit are refused with explicit feedback | 3 MB file refused: no tab, explicit limit toast, error log entry, workspace untouched. |
| P17: UTF-16LE BOM files are decoded with an explicit notice | Audit's FF FE case: decoded "ab" per the mark instead of U+FFFD; notice logged. |

`.github/workflows/playwright.yml` now runs both committed specs on the validated chromium+firefox matrix. `tests/phase1-save-recovery.spec.js` is unchanged (15 scenarios × 2 browsers, as QA/QC-verified).

## 4. Verification performed

Windows 11, Node v24.20.0, Playwright 1.65.1.

- New spec alone, Chromium + Firefox: **14 passed / 0 failed**.
- Full committed suite (both specs), the exact CI command `npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox`: **44 passed / 0 failed / 0 skipped** (22 scenarios × 2 browsers).
- Regression validity: with the P09 sync call temporarily disabled, the same-tab P09 scenario fails at the secondary-sync assertion (observed), and passes with the fix restored.
- Configured CI (`ubuntu-latest`) reran on push of this batch: GitHub Actions run [45710963119](https://github.com/KupipiKuki/notepad_studio/actions/runs/45710963119) (`Playwright Tests`, event `push`, branch `wp/phase1`, head `74dd6c4`) completed with conclusion `success`; every step concluded `success`, including `Install dependencies` (`npm ci`) and `Run Playwright tests` (`npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox`). Playwright exits non-zero on any failed test, so the successful step is direct evidence that all 44 tests of the extended committed suite (22 scenarios × 2 browsers) passed in the intended Linux environment. The `playwright-report` artifact was uploaded from that run.

## 5. Gate disposition

- The Phase 1 findings cleared for implementation by the auditor — P09 and P17 — are addressed with committed regressions passing on Chromium and Firefox on Windows, plus the configured Ubuntu CI.
- Not validated here and not claimed: the native `showOpenFilePicker`/native Windows picker and permission UI (the size guard also does not cover that path), WebKit, and any other open Phase 0 findings (P04–P08, P10, P12–P15, P18–P21, B01/B02) which were never in Phase 1 scope. UTF-16 files without a BOM are outside this policy (no marker, no evidence). This record does not self-declare G1; it proposes bounded acceptance of the P09/P17 completion cycle for independent re-verification.

## 6. Change register

| File | Change |
| --- | --- |
| `scripts/notepad-studio.html` | P09 `syncSplitViewIfSameTab` + primary-change hook; P17 `MAX_OPEN_BYTES`, `decodeFileBuffer` (BOM/UTF-16/lossy/binary policies), `handleFiles` size guard and verified decode pipeline |
| `tests/phase1-split-encoding.spec.js` | New: 7 committed regressions (P09 ×2, P17 ×5) |
| `.github/workflows/playwright.yml` | Run both committed specs on chromium+firefox |
| `docs/remediation/Notepad_Studio_Phase1_P09_P17_Record.md` | This record |

## 7. P17 hold follow-up (auditor-identified gap)

Follow-up date: November 26, 2026 (America/New_York). The auditor held the P17 acceptance on `649b771`: the BOM-prefixed UTF-8 branch decoded non-fatally, so invalid UTF-8 after a BOM bypassed the data-loss warning, and no regression covered that fixture.

### Correction in `scripts/notepad-studio.html`

- The UTF-8 BOM branch of `decodeFileBuffer` now validates the body with `TextDecoder('utf-8', { fatal: true })` before decoding. On failure it falls back to the placeholder decode and emits the same "bytes that are not valid UTF-8 … re-saving will not reproduce the original bytes" warning as the general UTF-8 path. The BOM itself is still preserved.

### Correction in `tests/phase1-split-encoding.spec.js`

- New regression `P17: invalid UTF-8 after a BOM still triggers the data-loss warning`: fixture `EF BB BF | 63 61 66 E9 0A` (UTF-8 BOM + "caf" + Latin-1 E9 + LF). Asserts the BOM is preserved in the document, the invalid byte is decoded as U+FFFD **with** the "not valid UTF-8" toast and a durable error-log entry, and the save re-exports the advertised loss exactly (`EF BB BF | caf-EF BF BD-LF`, LF selected).

### Verification performed

- Regression validity: the new test **fails against the committed pre-fix app** (observed: no warning, the BOM branch bypassed it) and passes with the correction.
- Full committed suite, both specs, the exact CI command: **46 passed / 0 failed / 0 skipped** (23 scenarios × 2 browsers, 22 previous + this regression).
- Configured CI (`ubuntu-latest`) reran on push of this batch: GitHub Actions run [45730238080](https://github.com/KupipiKuki/notepad_studio/actions/runs/45730238080) (`Playwright Tests`, event `push`, branch `wp/phase1`, head `3bb06f6`) completed with conclusion `success`, including `Run Playwright tests` (`npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox`). Playwright exits non-zero on any failed test, so the successful step is direct evidence that all 46 tests (23 scenarios × 2 browsers) passed in the intended Linux environment. The `playwright-report` artifact was uploaded from that run.

## 8. G1 follow-up: native open path

The P09/P17 QA/QC residual observation (native `showOpenFilePicker` path lossy via `file.text()`) was closed in the G1 batch: every open path (file input, drag/drop, native picker) now shares `openFileWithPolicy` — the P17 size guard and verified decode — with three new native-path regressions. The consolidated Phase 1 / G1 disposition lives in `docs/remediation/Notepad_Studio_Phase1_G1_Evidence.md`.
