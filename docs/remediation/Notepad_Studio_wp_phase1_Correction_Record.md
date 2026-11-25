# Notepad Studio — wp/phase1 correction batch: R01–R04

Implementation date: November 24, 2026 (America/New_York). Evidence timestamps use UTC.
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
- **Configured CI execution** (retrospective note added after the batch was pushed): GitHub Actions run `45525662464` (`Playwright Tests`, event `push`, branch `wp/phase1`, head `3c30b5d`, `ubuntu-latest`, attempt 1) ran 2026-11-25T01:25:36Z–01:26:51Z with every step concluded `success`, including `Install dependencies` (`npm ci`), `Install Playwright Browsers` (chromium + firefox) and `Run Playwright tests` (`npx playwright test tests/phase1-save-recovery.spec.js --project=chromium --project=firefox`). Playwright exits non-zero on any failed test, so the successful step is direct evidence that the committed, now location-independent spec passed in the workflow's intended Linux environment — the environment R04 identified as unable to even locate the app before this batch. The report artifact `playwright-report` (216,378 bytes) was uploaded from that run.

## 4. Gate disposition

- The four blocking findings R01–R04 from the independent audit are addressed with regressions passing on Chromium and Firefox on Windows.
- **Bounded batch acceptance** (per transition-audit §4) is proposed for independent re-verification; this record does not self-declare G1. Remaining Phase 1 scope — P09 (split-pane edit preservation) and P17 (encoding/large-file policy) — stays open as already declared.
- Not validated here and not claimed: native Windows picker UI with real OS permission grants, real disk writes beyond the synthetic handle paths, WebKit, and the full four-browser/origin matrix. The configured CI execution on `ubuntu-latest` **did** complete successfully (see §3).

## 5. Change register

| File | Change |
| --- | --- |
| `scripts/notepad-studio.html` | R01 dropped-entry repair flag; R02 verified recovery writes, guard state, blocked-autosave path, recovery-tab helper; R03 snapshot-aware `saveActiveFile` and three failure fallbacks |
| `tests/phase1-save-recovery.spec.js` | R04 portable app resolution; R01, R02×2, R03×2 regressions; committed scenarios unchanged |
| `.github/workflows/playwright.yml` | R04: `wp/phase1` triggers; chromium+firefox scoped install/run of the remediation spec |
| `docs/remediation/Notepad_Studio_wp_phase1_Correction_Record.md` | This record |

## 6. R02-RL remediation batch (re-audit follow-up)

Remediation date: November 26, 2026 (America/New_York). Trigger: `docs/audit/Notepad_Studio_wp_phase1_Reaudit.md` (decision: HOLD bounded batch acceptance on the remaining P0 recovery-lifecycle gap R02-RL). This addendum records the second correction cycle only; sections 1–5 above remain the historical record of the first batch.

### The finding

`recoveryGuardRaw` was a session-only flag. A persisted workspace whose recovery tab was structurally valid loaded without repair, so after an unseeded reload the guard was `null`; closing the clean `workspace-recovery.json` tab and editing allowed the replacement autosave to overwrite the only retained raw copy while the recovery-key backup did not exist. The committed reload regression reseeded the original fixture on every navigation via `context.addInitScript`, so it exercised initial recovery again instead of the persisted workspace.

### Correction in `scripts/notepad-studio.html`

- `buildWorkspaceData` now records durable metadata `recoveryTabId`: the id of the tab carrying the guarded raw payload, present only while the guard is armed. It is persisted with the very workspace it protects (such a persist by definition retains the payload inside the recovery tab).
- `restoreRecoveryGuardAfterReload(parsed)` reconstructs the guard on a clean load (`repairedSomething === false`): it resolves the carrier tab from the persisted `recoveryTabId` (falling back to a persisted `workspace-recovery.json` tab for workspaces written before this batch) and re-arms `recoveryGuardRaw` from that tab's content unless the recovery key verifiably holds the same payload. A load that itself repairs arms the guard through the existing R02 path instead.
- Consequently: after a reload, closing/editing the last retained raw copy leaves the recovery key retry + blocked-autosave protection in force across sessions (blocked autosave leaves the original-containing workspace key intact, with the existing toast/log feedback). When the recovery key holds the backup, no guard is armed and ordinary close/autosave proceeds. The blocked-autosave semantics are unchanged in-session.

### Correction in `tests/phase1-save-recovery.spec.js`

- Seeding is now once per isolated context: the init script seeds only when the workspace key is absent, so `page.reload` reopens the bytes the app actually persisted. The genuine-quota reload step of the R02 regression now tests a true cross-session reopen. The `Storage.setItem` denial patch continues to run on every navigation (fresh `Storage.prototype` per document); only the fixture write is gated.
- New regression `R02-RL: recovery protection survives an unseeded reload when recovery writes are denied`: denied recovery-key writes → repair → first-session autosave embedding the raw payload → unseeded reload → reopen recovery tab → close last recovery tab → edit/autosave → asserts the destructive autosave is blocked with the "Autosave blocked" toast and error log, and the workspace key is left byte-identical, still containing the original marker.
- New control `R02-RL control: retained recovery-key backup does not block close/autosave across reload`: corrupt raw whose recovery-key write succeeds → reload → close the recovery tab → edit/autosave → asserts autosave proceeds normally and the original stays recoverable via the key (no over-blocking).

### Verification performed

Windows 11, Node v24.20.0, Playwright 1.65.1.

- Function-level probe (auditor's method, exact updated functions, synthetic storage, no browser integration claim): first session arms the guard and persists `recoveryTabId`; a fresh session re-arms the guard from the persisted metadata (`guardArmed: true`, guard equals the original raw); after closing the recovery tab the destructive autosave is blocked (`storedContainsOriginal: true`, denied-write log + "Autosave blocked" toast); the successful-backup control is not blocked (`guardArmed: false`, storage updated, key retains the original). The probe asserted the fixed behavior and passed.
- Committed suite, this checkout: `npx playwright test tests/phase1-save-recovery.spec.js --project=chromium --project=firefox` — **30 passed / 0 failed / 0 skipped** (15 scenarios × 2 browsers, 13 previous + the 2 new R02-RL scenarios), incl. the unseeded-reload and control cases on both browsers.
- Configured CI (`ubuntu-latest`, same workflow as §3) reruns on push of this batch; the run link and result are recorded below at commit time.

### Gate disposition

- R02-RL is addressed with the durable recovery metadata design the re-audit required; bounded batch acceptance is again proposed for independent re-verification. Remaining Phase 1 scope (P09, P17) stays open; native OS permission/save UI remains unvalidated, as does WebKit, which the committed workflow does not claim.
