# Notepad Studio — wp/phase1 correction batch: R01–R04

Implementation date: December 1, 2026 (America/New_York). Evidence timestamps use UTC.
Branch: `wp/phase1` (cut from `wp/phase0` @ `a2f1acb` per the transition audit).
Scope: the four blocking findings of `docs/remediation/Notepad_Studio_wp_phase0_Independent_Audit.md` — R02 (P0), R01/R03/R04 (P1) — plus the required regressions. No other findings (notably P09, P17) are claimed closed by this batch.

## 1. Changes to `scripts/notepad-studio.html`

### R01 — dropped tab-list entries are repairs

`loadState` now sets `repairedSomething = true` when `sanitizePersistedTab` returns `null` (non-object/array entry), in addition to repaired retained tabs. A dropped entry therefore triggers the same preservation and reporting path as any other repair; it can no longer be silently discarded while all retained entries are valid.

### R02 — verified recovery preservation, honest feedback, guarded autosave

- `preserveRecoveryPayload(raw)` now returns real success/failure instead of swallowing quota/denial errors, and logs the storage failure.
- On the repaired-state path, the "original backup stored in recovery key" toast/log is shown **only** when the recovery-key write verifiably succeeded. On failure:
  - the raw payload is kept inside the workspace as a visible `workspace-recovery.json` tab (`pushRecoveryTab`), and
  - a session guard `recoveryGuardRaw` is armed.
- `persistState` refuses to replace the workspace key while the guarded raw payload is not retained anywhere (recovery key or an open tab carrying it verbatim): it retries the recovery-key backup once, and if that fails it blocks the autosave, logs the reason and warns the user once. The original workspace key is left intact in that case.
- The corrupt-JSON / no-usable-documents / not-a-workspace paths use the same verified write and arm the guard on failure (their recovery tab, already existing, is the retained copy).

Design rationale: the auditor's quota probe showed the raw payload's duplicate can exceed quota while the payload itself fits the workspace key. Keeping the raw verbatim inside a visible, exportable tab is the retained copy of last resort; `Download Workspace Backup`, tab export and ordinary save all remain available for it.

### R03 — failure fallbacks download the requested save

`saveActiveFile` accepts `{ tab, content }`. All three native failure fallbacks (`handle.createWritable`/write/close failure on an established handle, `showSaveFilePicker` start failure, and Save As write failure) now pass the **original** tab and its pre-async `contentSnapshot`, so the fallback download carries the requested document's name and bytes even after a tab switch. The live state of the now-active tab is not touched, and no tab is marked saved by a download.

## 2. Test harness changes

### R04 — location-independent paths and runnable committed CI

- `tests/phase1-save-recovery.spec.js` resolves `scripts/notepad-studio.html` via `path.resolve(__dirname, '..', 'scripts', 'notepad-studio.html')` and derives the `file://` URL with `pathToFileURL`. The committed constants no longer hardcode `C:/Git/notepad_studio`, so the suite tests the checkout it lives in on Windows clones and on the Ubuntu runner alike.
- `.github/workflows/playwright.yml`: push/pull_request triggers extended to `wp/phase1`; browser install and run scoped to the validated matrix (`chromium`, `firefox`) and to the committed remediation spec, instead of also running `example.spec.js` (external network sites) and webkit, which were never part of the validated coverage.

### New regressions in `tests/phase1-save-recovery.spec.js`

| Test | Covers |
| --- | --- |
| R01: dropped invalid tab entries are repaired with the raw payload preserved | Repair reported, recovery key holds the exact raw payload, survives autosave after edits |
| R02: genuine quota failure keeps honest feedback and preserves the original payload | 3,000,378-char raw payload (fits workspace key, duplicate exceeds storage quota). No false "backup stored" toast, `workspace-recovery.json` recovery route surfaced, original payload still accessible in storage after edit/autosave and after reload |
| R02: denied recovery writes preserve the original and block destructive autosave | Explicit `Storage.setItem` denial for the recovery key: raw payload retained inside the replacement workspace (recovery tab), and after the recovery tab is closed, replacement autosave is blocked — the last retaining copy of the original stays in the workspace key, with an explicit "Autosave blocked" toast and error-log entry |
| R03: failed Save As after a tab switch downloads the requested snapshot | `createWritable` rejection after switching to tab b: download must be `a.txt` with the exact requested bytes; both tabs' dirty states stay honest |
| R03: established-handle failure after a tab switch downloads the requested snapshot | Handle established via successful Save As, then write failure after switching to tab b: download must be `native-a.txt` with the exact requested bytes; both tabs' states asserted |

The eight committed scenarios (P01 ×2, P02 ×4, P03, P16) are unchanged, per the audit's retest requirement.

## 3. Verification performed

Windows 11, Node v24.20.0, Playwright 1.65.1 (npm ci from committed `package-lock.json`), Chromium 159 and Firefox 159 installed for the matrix. Synthetic data only; isolated fresh contexts.

- Committed suite, this checkout: `npx playwright test tests/phase1-save-recovery.spec.js --project=chromium --project=firefox --workers=1` — **26 passed / 0 failed / 0 skipped** (13 scenarios × 2 browsers; the 16 previously committed results plus 10 new regressions), incl. real browser downloads with exact-byte assertions on the loopback HTTP origin.
- **Genuine quota confirmation** (independent file-origin probe, not part of the committed suite): with the 3,000,378-char raw workspace stored, both Chromium and Firefox threw a real `QuotaExceededError` on the recovery-key duplicate write; the app then showed `Workspace repaired; recovery backup failed — original preserved as workspace-recovery.json tab.` (not the false success toast), surfaced the recovery tab, and after an edit plus the autosave debounce the marker remained present in `npp_studio_state_v1`. Matches the auditor's reproduction conditions and confirms the genuine-quota branch of the R02 regression was exercised, not the backup-succeeded branch.

## 4. Gate disposition

- The four blocking findings R01–R04 from the independent audit are addressed with regressions passing on Chromium and Firefox on Windows.
- **Bounded batch acceptance** (per transition-audit §4) is proposed for independent re-verification; this record does not self-declare G1. Remaining Phase 1 scope — P09 (split-pane edit preservation) and P17 (encoding/large-file policy) — stays open as already declared.
- Not validated here and not claimed: native Windows picker UI with real OS permission grants, real disk writes beyond the synthetic handle paths, WebKit, full four-browser/origin matrix, and a completed configured CI execution on `ubuntu-latest` (the workflow is now configured to run on push to `wp/phase1`; its result must be read from the Actions run, not from this document).

## 5. Change register

| File | Change |
| --- | --- |
| `scripts/notepad-studio.html` | R01 dropped-entry repair flag; R02 verified recovery writes, guard state, blocked-autosave path, recovery-tab helper; R03 snapshot-aware `saveActiveFile` and three failure fallbacks |
| `tests/phase1-save-recovery.spec.js` | R04 portable app resolution; R01, R02×2, R03×2 regressions; committed scenarios unchanged |
| `.github/workflows/playwright.yml` | R04: `wp/phase1` triggers; chromium+firefox scoped install/run of the remediation spec |
| `docs/remediation/Notepad_Studio_wp_phase1_Correction_Record.md` | This record |
