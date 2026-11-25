# Notepad Studio — QA/QC evidence report for the wp/phase1 P09/P17 completion batch

Review date: November 25, 2026 (America/New_York; report generated 2026-11-25T22:31:06Z).

**Decision: PASS — the P09/P17 completion batch (`74dd6c4`, docs `649b771`) is verified against `docs/remediation/Notepad_Studio_Phase1_P09_P17_Record.md`.** Both findings are addressed in code with committed regressions; the full committed suite passes locally on Chromium and Firefox (44/44), the P09 regression was independently shown to fail when the fix is disabled, and the claimed configured Ubuntu CI run was verified via the GitHub API. Bounded acceptance of the P09/P17 cycle is supported; this is not a G1 declaration (see non-claims).

## Candidate and branch status

| Item | Verified state |
| --- | --- |
| Local checkout | `wp/phase1` @ `649b7719aeb7887c19b8a489cf4f9508a3fd83e2`, clean working tree (a temporary fix-disabled probe edit was made and fully restored; `git status` clean afterwards) |
| Code commit | `74dd6c41071dd1fe923c494abe49ff8ded6670af` (2026-11-25 17:10:40 -0500) |
| Docs-only follow-up | `649b7719aeb7887c19b8a489cf4f9508a3fd83e2` (2026-11-25 17:15:57 -0500), records the CI run link |
| Prior QA/QC base | `afb4ce66c3e11e228324cbccb773c37169f9a86a` (R02-RL batch, decision PASS in `Notepad_Studio_wp_phase1_R02RL_QAQC_Evidence.md`) |
| App blob at `74dd6c4` | `ef8561a6c7f4e7924cd3d6bb42388aacc92063f3` |
| New spec blob | `tests/phase1-split-encoding.spec.js` = `b8b3672dc49b9ac5b7ecee113df7bf4dd5eea2a6` (7 scenarios) |
| Workflow blob | `.github/workflows/playwright.yml` = `d1c321c874df7e89b71893e6bef2ce59a672fd74` (now runs both specs) |
| `tests/phase1-save-recovery.spec.js` | Unchanged in this batch (empty diff `afb4ce6..74dd6c4`) |
| Remote existence | `649b771…` confirmed via GitHub API (`get_commit`, expected message) |

## What was reviewed and how

### 1. Static review of the delta (`git diff afb4ce6..74dd6c4`)

**P09 — same-tab split sync.** The primary editor's `change` handler now calls `syncSplitViewIfSameTab()` (`scripts/notepad-studio.html:1872-1873`). The new function (`:2156-2171`) mirrors the active tab's content into the secondary editor only when the split pane is open and `splitTabSelect.value === activeTabId`, preserving the cursor and guarded by `isSwitchingTab` so the secondary's write-back handler (`:1839-1854`) returns early — no change loop, no echo. Source analysis confirms the defect claim: the secondary handler unconditionally wrote its full value into `splitTab.content`, so with the same tab on both panes a stale secondary value would overwrite primary edits. The fix restores bidirectional sync for the same-tab case; the different-tab case is untouched.

**P17 — honest open policy.** `handleFiles` (`:3585`) now refuses files over `MAX_OPEN_BYTES` (2 MiB, `:3535`) before reading — log entry + limit toast, no tab, workspace untouched — and decodes via `readAsArrayBuffer` + `decodeFileBuffer` (`:3538-3583`): UTF-16LE/BE per BOM with an explicit notice; UTF-8 BOM kept as U+FEFF in the document so the UTF-8 `Blob` save reproduces the `EF BB BF` prefix; otherwise `fatal: true` UTF-8 decode with a non-fatal U+FFFD fallback plus an explicit "not valid UTF-8 … re-saving will not reproduce the original bytes" warning; binary heuristic (control chars >10% or U+FFFD density >30%, tab/LF/CR/BOM excluded) adds an "appears to be binary" warning. Infos/warnings are surfaced as toast + durable log entries. Save-side policy (UTF-8 + selected line-ending normalization) is unchanged, consistent with the P11 disposition.

### 2. Local integrated run (independently rerun in this checkout)

```
npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox --reporter=line
  44 passed (1.4m)
```

**44 passed / 0 failed / 0 skipped** (22 scenarios × 2 browsers), matching the record's claim exactly, including the byte-exact UTF-8-BOM open→save round trip on both browsers, the honest Latin-1 lossy re-export (`EF BF BD`), the binary warning, the 3 MB refusal, and UTF-16LE decode.

### 3. Regression validity (fail-without-fix), independently reproduced

The `syncSplitViewIfSameTab();` call at `:1873` was temporarily commented out (file backed up first, restored afterwards; tree clean): `P09: same-tab split edits sync in both directions and survive a reload` **failed** on Chromium as expected; with the fix restored it **passed** (1 passed). The new P09 regression therefore genuinely covers the defect.

### 4. CI verification via the GitHub API

Run [45710963119](https://github.com/KupipiKuki/notepad_studio/actions/runs/45710963119), fetched from the API (`/actions/runs/45710963119` + `/jobs`):

| Field | Value |
| --- | --- |
| event / branch / head_sha | `push` / `wp/phase1` / `74dd6c41071dd1fe923c494abe49ff8ded6670af` |
| run_number / workflow | 6 / `.github/workflows/playwright.yml` |
| status / conclusion | `completed` / `success` |
| window | 2026-11-25T22:10:44Z → 2026-11-25T22:12:37Z |
| job `test` | conclusion `success`; every step `success`, including `npm ci`, `npx playwright install --with-deps chromium firefox`, `npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox`, artifact upload |

The workflow at HEAD indeed runs both committed specs on the chromium+firefox matrix (verified in the diff), so the green CI step is direct evidence for the full 44-test suite in the intended Linux environment.

## Requirement-by-requirement disposition

| Record claim | QC result |
| --- | --- |
| P09 same-tab split defect exists and is fixed by `syncSplitViewIfSameTab` + primary-change hook; both directions sync and persist | Confirmed by source review and by the browser test; regression shown to fail without the fix |
| P09 close of a split-displayed dirty tab repopulates the split and persists | Test at spec L132 passes on both browsers (dialog shown, split select falls back to `a`, workspace persisted without the closed tab, clean reload) |
| P17 2 MiB open-size guard with explicit feedback, no tab created, workspace untouched | Test at spec L227 passes; code refuses before `FileReader` (`:3586-3591`) |
| P17 UTF-8 BOM preserved through open and save as exact bytes | Test at spec L157 passes on both browsers with byte-exact download assertion |
| P17 invalid UTF-8 reported honestly; re-export loss stated | Test at spec L184 passes (`caf\uFFFD\n`, "not valid UTF-8" toast, `EF BF BD` export) |
| P17 binary detection warning | Test at spec L210 passes; heuristic thresholds reviewed (sparse placeholders stay a decode warning) |
| P17 UTF-16 BOM decode with notice | Test at spec L248 passes (`FF FE 61 00 62 00` → `ab`) |
| 7 new regressions; save-recovery spec unchanged; workflow runs both specs | Confirmed: 7 `test()` blocks in the new spec; empty diff for the save-recovery spec; workflow diff adds the second spec |
| Local 44/44 and CI run 45710963119 success | Independently reproduced locally (44/44) and via the GitHub API (conclusion `success`, all steps `success`) |

## Residual observations and explicit non-claims

- **Native open path still lossy by design of scope**: `openFileNativeOrFallback` (`:3939`) uses `file.text()` on handles from `showOpenFilePicker` (`:3955-3957`), so the P17 decode pipeline and the 2 MiB guard do **not** cover the native picker path. The record discloses this deferral explicitly; it is a known limitation, not a false claim. Recommended follow-up for a later phase.
- UTF-16 files without a BOM are outside the policy (no marker, no evidence) — as the record states.
- WebKit and other open Phase 0 findings (P04–P08, P10, P12–P15, P18–P21, B01/B02) remain out of scope; no G1 is claimed.
- No repository files were modified by this review except the temporary fix-disabled probe edit, which was restored byte-for-byte (backup copy) and verified clean via `git status` plus a passing rerun of the affected test.

## Sources

- [P09 fix and handler](https://github.com/KupipiKuki/notepad_studio/blob/649b7719aeb7887c19b8a489cf4f9508a3fd83e2/scripts/notepad-studio.html#L1872) and [syncSplitViewIfSameTab](https://github.com/KupipiKuki/notepad_studio/blob/649b7719aeb7887c19b8a489cf4f9508a3fd83e2/scripts/notepad-studio.html#L2156)
- [P17 pipeline](https://github.com/KupipiKuki/notepad_studio/blob/649b7719aeb7887c19b8a489cf4f9508a3fd83e2/scripts/notepad-studio.html#L3535) (`MAX_OPEN_BYTES`, `decodeFileBuffer`, `handleFiles`); [native-path deferral](https://github.com/KupipiKuki/notepad_studio/blob/649b7719aeb7887c19b8a489cf4f9508a3fd83e2/scripts/notepad-studio.html#L3955)
- [New spec](https://github.com/KupipiKuki/notepad_studio/blob/74dd6c41071dd1fe923c494abe49ff8ded6670af/tests/phase1-split-encoding.spec.js)
- [Record under review](https://github.com/KupipiKuki/notepad_studio/blob/649b7719aeb7887c19b8a489cf4f9508a3fd83e2/docs/remediation/Notepad_Studio_Phase1_P09_P17_Record.md)
- [CI run 45710963119](https://github.com/KupipiKuki/notepad_studio/actions/runs/45710963119) and its [API record](https://api.github.com/repos/KupipiKuki/notepad_studio/actions/runs/45710963119)
- [Prior R02-RL QA/QC evidence](https://github.com/KupipiKuki/notepad_studio/blob/649b7719aeb7887c19b8a489cf4f9508a3fd83e2/docs/audit/Notepad_Studio_wp_phase1_R02RL_QAQC_Evidence.md)
