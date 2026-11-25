# Notepad Studio — QA/QC evidence report for the wp/phase1 R02-RL remediation batch

Review date: November 25, 2026 (America/New_York; report generated 2026-11-25T10:29:29Z).

**Decision: PASS — the R02-RL correction batch (`fcead7b`, docs `4dd7a57`) satisfies every "required correction and retest" item of `Notepad_Studio_wp_phase1_Reaudit.md`.** The reload-lifecycle gap is closed with durable recovery metadata, the spec seeding flaw is fixed, the exact regression sequence and the successful-backup control are committed, and the retest evidence (local Chromium/Firefox plus the configured Ubuntu CI run) was independently reproduced/verified. This supports bounded acceptance of the R02-RL correction cycle only — not full G1 (P09/P17 remain open, native OS save paths remain unvalidated).

## Candidate and branch status

| Item | Verified state |
| --- | --- |
| Local checkout | `wp/phase1` @ `4dd7a579b509734518950e444e0d4c7f03b14d8d`, clean working tree |
| Remediation commit | `fcead7bd24203e765a7e676c0978b099c7e14089` (2026-11-25 05:03:28 -0500) |
| Docs-only follow-up | `4dd7a579b509734518950e444e0d4c7f03b14d8d` (2026-11-25 05:08:28 -0500), records the CI run link |
| Reaudit base | `388c6afadc85b5c12046217a5cba77dc1e1ed4c5` (the HOLD-decision head) |
| App blob at `fcead7b` and at HEAD | `e14c1b22463065755c6af6875ca8aa8c0603e82d` (identical — `4dd7a57` changed docs only) |
| Spec blob at `fcead7b` | `ab5ec9cc2715b8a816505a758467e74879368d28` |
| Diff `388c6af..HEAD` | app +43 lines, spec +139/-1, docs; R01/R03/R04 code untouched |
| Remote existence | `4dd7a57…` confirmed present on the remote via the GitHub API (`get_commit`) |

No source, repository branch, test or workflow was changed by this review. The review produced this report plus a reproducible scratch probe outside the checkout's tracked files.

## Reaudit requirements vs. verified implementation

| Reaudit "required correction and retest" | Where implemented | QC evidence |
| --- | --- | --- |
| Preserve/reconstruct recovery-pending protection across reloads; a session-only flag is insufficient | `buildWorkspaceData` records durable `recoveryTabId` while the guard is armed (`scripts/notepad-studio.html:3058-3069`); new `restoreRecoveryGuardAfterReload` re-arms `recoveryGuardRaw` on a clean load from that metadata, with a legacy fallback to a persisted `workspace-recovery.json` tab, unless the recovery key verifiably holds the same payload (`:3224-3239`, invoked at `:3292-3298`) | Probe scenario A: after an unseeded reload `guardArmed: true` and the re-armed guard **equals the original raw payload**; browser test `R02-RL … survives an unseeded reload` (spec L516) passed on Chromium and Firefox |
| Closing/editing the last retained raw copy must not enable replacement autosave without a real retained backup or reviewed discard policy | `persistState` (`:3094-3117`) blocks the write, emits an error log and an "Autosave blocked" toast when neither the recovery key nor any tab retains the payload and the last-chance backup write fails | Probe A: `storedUnchanged: true`, `storedContainsOriginal: true`, `backup: null`, blocked toast + log present. Browser test asserts the stored bytes are byte-identical after close+edit, the marker survives, and the toast/error surface is accurate |
| Seed isolated browser storage once; do not rewrite it on reload | All three `addInitScript` seeding sites are once-per-context guards: spec L54 (`openApp`), L456 (denied-writes test), L528 (R02-RL test); the setItem patch still runs on every navigation. Reloads at L418/L557/L610 now reopen the bytes the app persisted | Grep of the spec shows no unguarded reseed; all reload-based tests passed on both browsers |
| Add the exact sequence: denied recovery-key writes → repair → successful autosave embedding raw → unseeded reload → close last recovery tab → edit/autosave, asserting the original remains accessible or the destructive autosave is blocked with accurate feedback | New test at `tests/phase1-save-recovery.spec.js:516` implements exactly this sequence and asserts stored-state identity, marker presence, null recovery key, "Autosave blocked" toast, and a non-zero error count | Passed: Chromium 15/15, Firefox 15/15 (see below) |
| Include a successful-backup control case so ordinary close/autosave is not unnecessarily blocked | New control test at spec L594 | Passed on both browsers; probe B confirms guard stays disarmed and autosave proceeds when the key verifiably retains the payload |
| Retest the frozen corrected candidate on Chromium/Firefox and rerun configured CI | — | Local: 30/30 passed. CI: run 45591305388 verified via GitHub API (below) |

## Verification evidence

### 1. Static review of the delta (`git diff 388c6af..fcead7b`)

- App: +43 lines only — `recoveryTabId` in `buildWorkspaceData`, comment on the guard, `restoreRecoveryGuardAfterReload`, and its invocation in the non-repair branch of `loadState`. `STORAGE_KEY` has exactly one writer (`persistState`, `:3110`), so the durable metadata cannot be bypassed by another persist path.
- Spec: +139/-1 — once-per-context seeding guards plus the two new R02-RL tests.
- Docs: reaudit committed at `fcead7b`; CI run link recorded at `4dd7a57` in `docs/remediation/Notepad_Studio_wp_phase1_Correction_Record.md`.

### 2. Function-level probe (reaudit's method, fixed-behavior assertions)

The exact candidate function bodies (`createTab`, `detectMode`, `buildWorkspaceData`, `persistState`, `preserveRecoveryPayload`, `isRecoveryPayloadRetained`, `pushRecoveryTab`, `coercePersistedString`, `sanitizePersistedTab`, `restoreRecoveryGuardAfterReload`, `loadState`) were extracted verbatim from the current `scripts/notepad-studio.html` by brace matching and executed under Node v24.20.0 with synthetic storage/UID/UI boundaries. Four scenarios, all assertions passed (full source in the appendix; run: `node qaqc_r02rl_probe.cjs` from the repository root):

```json
{
  "scenarioA_deniedWrites": {
    "before": {
      "guardArmed": true,
      "backup": null,
      "storedContainsOriginal": true,
      "recoveryTabIdPersisted": true
    },
    "afterReload": {
      "guardArmed": true,
      "guardEqualsOriginalRaw": true,
      "recoveryTabs": 1
    },
    "afterClose": {
      "storedUnchanged": true,
      "storedContainsOriginal": true,
      "backup": null,
      "blockedToast": true,
      "blockedLog": true
    }
  },
  "scenarioB_control": {
    "bootBackup": "{\"broken recoverable control workspace",
    "afterReload": {
      "guardArmed": false,
      "backup": "{\"broken recoverable control workspace",
      "recoveryTabs": 1
    },
    "afterClose": {
      "storedUpdated": true,
      "recoveryTabGone": true,
      "backupRetained": true,
      "blockedToast": false
    }
  },
  "scenarioC_quotaFreed": {
    "backupWritten": true,
    "guardCleared": true,
    "autosaveProceeded": true,
    "blockedToast": false
  },
  "scenarioD_plain": {
    "guardAfterReload": null,
    "persistedUpdate": true,
    "blockedToast": false
  }
}
```

Reading: **A** is the reaudit's R02-RL sequence — previously the guard stayed `null` after reload and the marker was lost; now the guard is re-armed from durable metadata with the exact original raw, and closing the last recovery tab blocks the destructive autosave with accurate feedback while leaving the stored workspace untouched. **B** is the successful-backup control — no over-blocking. **C** is an extra edge case (quota freed after reload): the cross-session last-chance backup write succeeds, clears the guard, and autosave proceeds — the block is not permanent. **D** confirms ordinary workspaces are unaffected. This is a function-level probe with synthetic boundaries; no browser integration claim is made from it.

### 3. Local integrated browser run (independently rerun in this checkout)

```
cd <repo> && npx playwright test tests/phase1-save-recovery.spec.js --project=chromium --project=firefox --reporter=line
  30 passed (1.0m)
```

(Per-project runs earlier the same day: Chromium 15 passed in 30.0s; Firefox 15 passed in 33.1s. The combined run above is the recorded evidence: **30 passed / 0 failed / 0 skipped**, 15 scenarios × 2 browsers, including `R02-RL: recovery protection survives an unseeded reload when recovery writes are denied` at spec L516 and `R02-RL control: retained recovery-key backup does not block close/autosave across reload` at spec L594.)

### 4. Configured CI run verified via the GitHub API (not just the doc claim)

Run [45591305388](https://github.com/KupipiKuki/notepad_studio/actions/runs/45591305388), fetched from `api.github.com/repos/KupipiKuki/notepad_studio/actions/runs/45591305388` (+ `/jobs`):

| Field | Value |
| --- | --- |
| event / branch / head_sha | `push` / `wp/phase1` / `fcead7bd24203e765a7e676c0978b099c7e14089` |
| run_number / workflow | 3 / `.github/workflows/playwright.yml` |
| status / conclusion | `completed` / `success` |
| window | 2026-11-25T10:03:38Z → 2026-11-25T10:05:14Z |
| job `test` conclusion | `success`; every step `success`: checkout, setup-node, `npm ci`, `npx playwright install --with-deps chromium firefox`, `npx playwright test tests/phase1-save-recovery.spec.js --project=chromium --project=firefox`, artifact upload |

The workflow still triggers on `wp/phase1` pushes and runs the committed remediation spec on `ubuntu-latest` (R04 intact).

## Residual observations and explicit non-claims

- The legacy fallback in `restoreRecoveryGuardAfterReload` arms the guard for any persisted tab named `workspace-recovery.json` even when `recoveryTabId` is absent (older persisted workspaces). This is conservative and only blocks when recovery-key writes also fail — the intended behavior — and the last-chance backup clears it otherwise (probe C). Non-blocking.
- Native OS permission/write UI remains unvalidated (carried over from the reaudit, R03 note).
- P09/P17 remain open; this report does not claim full Phase 1 / G1 acceptance.
- The probe is function-level with synthetic storage/UID/UI boundaries; the integrated evidence is the local 30/30 browser run and the verified CI run.
- Phase 2 and migration/architecture gates were not assessed.

## Sources

- [App persistence/recovery code at HEAD](https://github.com/KupipiKuki/notepad_studio/blob/4dd7a579b509734518950e444e0d4c7f03b14d8d/scripts/notepad-studio.html#L3058) (`recoveryTabId` in `buildWorkspaceData`), [guard re-arm](https://github.com/KupipiKuki/notepad_studio/blob/4dd7a579b509734518950e444e0d4c7f03b14d8d/scripts/notepad-studio.html#L3224), [loadState invocation](https://github.com/KupipiKuki/notepad_studio/blob/4dd7a579b509734518950e444e0d4c7f03b14d8d/scripts/notepad-studio.html#L3292)
- [Spec seeding guards and R02-RL tests](https://github.com/KupipiKuki/notepad_studio/blob/fcead7bd24203e765a7e676c0978b099c7e14089/tests/phase1-save-recovery.spec.js#L48) (once-per-context seed at L54/L456/L528; new tests L516 and L594)
- [Reaudit that defined the requirements](https://github.com/KupipiKuki/notepad_studio/blob/fcead7bd24203e765a7e676c0978b099c7e14089/docs/audit/Notepad_Studio_wp_phase1_Reaudit.md)
- [Correction record with the CI claim](https://github.com/KupipiKuki/notepad_studio/blob/4dd7a579b509734518950e444e0d4c7f03b14d8d/docs/remediation/Notepad_Studio_wp_phase1_Correction_Record.md)
- [CI run 45591305388](https://github.com/KupipiKuki/notepad_studio/actions/runs/45591305388) and its [API record](https://api.github.com/repos/KupipiKuki/notepad_studio/actions/runs/45591305388)

## Appendix — reproducible probe

Run as a `.cjs` file with Node from the repository root (`node qaqc_r02rl_probe.cjs`). It extracts the candidate function bodies verbatim from `scripts/notepad-studio.html` (no hand transcription) and asserts the **fixed** behavior. Synthetic storage, UID and UI/log boundaries; no browser integration claim. Observed on Node v24.20.0: `ALL QAQC PROBE ASSERTIONS PASSED` with the JSON output shown above.

```javascript
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const HTML = path.resolve(process.cwd(), 'scripts', 'notepad-studio.html');
const src = fs.readFileSync(HTML, 'utf8');

function extractFn(name) {
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('function not found: ' + name);
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
    else if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    }
  }
  return src.slice(start, i + 1);
}

const FNAMES = ['createTab', 'detectMode', 'buildWorkspaceData', 'persistState',
  'preserveRecoveryPayload', 'isRecoveryPayloadRetained', 'pushRecoveryTab',
  'coercePersistedString', 'sanitizePersistedTab', 'restoreRecoveryGuardAfterReload', 'loadState'];
const candidateFunctions = FNAMES.map(extractFn).join('\n');

const globals = `
let tabs=[],activeTabId=null,wordWrap=false,tabSize=2,lineEnding='CRLF',macroActions=[],showSymbolsActive=false,rulerMode=0,recoveryGuardRaw=null,recoveryBlockedWarningShown=false,storageWarningShown=false;
let i=0;const uid=()=> 'new-'+(++i);
const EXT_MAP={txt:'text',json:'json'};
const STORAGE_KEY='npp_studio_state_v1';
const errors=[],toasts=[];
const logError=(...a)=>errors.push(a),showToast=m=>toasts.push(m);
const getStarterTabsData=()=>[{name:'starter.txt',content:'starter',mode:'text'}];
const RECOVERY_KEY=STORAGE_KEY+'_recovery';
const PERSISTED_MODES=['text','javascript','json','python','htmlmixed','xml','css','markdown','yaml','sql','text/x-csrc','shell'];
`;

const factory = new Function('localStorage', globals + '\n' + candidateFunctions +
  '\nreturn {loadState,persistState,get tabs(){return tabs},set tabs(v){tabs=v},get guard(){return recoveryGuardRaw},errors,toasts};');

function mkStorage(denyRecovery) {
  const s = {
    _values: new Map(),
    getItem(k) { const v = s._values; return v.has(k) ? v.get(k) : null; },
    setItem(k, v) {
      if (denyRecovery && k === 'npp_studio_state_v1_recovery') throw new Error('recovery write denied (QuotaExceededError)');
      s._values.set(k, String(v));
    }
  };
  return s;
}

const MARKER = 'R02_RL_QAQC_MARKER';
const raw = JSON.stringify({
  activeTabId: 'good',
  tabs: [
    { id: 'good', name: 'good.txt', content: 'good', savedContent: 'good', mode: 'text', dirty: false, bookmarks: [] },
    { id: 'bad', name: 'bad.txt', content: { unrenderable: MARKER }, savedContent: '', mode: 'text', bookmarks: [] }
  ],
  tabSize: 2, lineEnding: 'CRLF', macroActions: []
});

const results = {};

// ---------- Scenario A: reaudit R02-RL sequence, recovery writes denied ----------
{
  const storage = mkStorage(true);
  storage.setItem('npp_studio_state_v1', raw);

  const first = factory(storage);
  first.loadState(); // repair path; recovery write denied -> guard armed + recovery tab
  first.tabs[0].content = 'edited first session';
  first.persistState(); // guard armed but raw retained in recovery tab -> allowed; recoveryTabId recorded

  const persisted1 = storage.getItem('npp_studio_state_v1');
  const before = {
    guardArmed: first.guard === raw,
    backup: storage.getItem('npp_studio_state_v1_recovery'),
    storedContainsOriginal: persisted1.includes(MARKER),
    recoveryTabIdPersisted: JSON.parse(persisted1).recoveryTabId != null
  };

  const second = factory(storage); // fresh page session, NO reseed: reads persisted bytes
  second.loadState();
  const afterReload = {
    guardArmed: second.guard !== null && second.guard.includes(MARKER),
    guardEqualsOriginalRaw: second.guard === raw,
    recoveryTabs: second.tabs.filter(t => t.name === 'workspace-recovery.json').length
  };

  second.tabs = second.tabs.filter(t => t.name !== 'workspace-recovery.json'); // close clean recovery tab
  second.tabs[0].content = 'edited after reload close';
  const storedBeforeBlockedPersist = storage.getItem('npp_studio_state_v1');
  second.persistState();
  const afterClose = {
    storedUnchanged: storage.getItem('npp_studio_state_v1') === storedBeforeBlockedPersist,
    storedContainsOriginal: storage.getItem('npp_studio_state_v1').includes(MARKER),
    backup: storage.getItem('npp_studio_state_v1_recovery'),
    blockedToast: second.toasts.some(t => t.includes('Autosave blocked')),
    blockedLog: second.errors.some(e => String(e[1]).includes('autosave blocked'))
  };
  results.scenarioA_deniedWrites = { before, afterReload, afterClose };
  assert.equal(before.guardArmed, true, 'A: first session guard armed');
  assert.equal(before.storedContainsOriginal, true, 'A: first-session autosave embeds raw');
  assert.equal(before.recoveryTabIdPersisted, true, 'A: durable recoveryTabId recorded');
  assert.equal(afterReload.guardArmed, true, 'A: guard re-armed after unseeded reload');
  assert.equal(afterReload.guardEqualsOriginalRaw, true, 'A: re-armed guard equals original raw');
  assert.equal(afterReload.recoveryTabs, 1, 'A: recovery tab reopened');
  assert.equal(afterClose.storedContainsOriginal, true, 'A: destructive autosave blocked, original intact');
  assert.equal(afterClose.storedUnchanged, true, 'A: workspace not replaced');
  assert.equal(afterClose.backup, null, 'A: no false backup claim');
  assert.equal(afterClose.blockedToast, true, 'A: accurate blocked toast');
  assert.equal(afterClose.blockedLog, true, 'A: accurate error log');
}

// ---------- Scenario B: control — recovery-key backup succeeds ----------
{
  const storage = mkStorage(false);
  const corruptRaw = '{"broken recoverable control workspace';
  storage.setItem('npp_studio_state_v1', corruptRaw);

  const first = factory(storage);
  first.loadState(); // corrupt -> backup write succeeds -> guard NOT armed
  const bootBackup = storage.getItem('npp_studio_state_v1_recovery');
  first.tabs[0].content = 'edited control session';
  first.persistState();

  const second = factory(storage);
  second.loadState(); // unseeded reload of app-persisted bytes
  const afterReload = {
    guardArmed: second.guard !== null,
    backup: storage.getItem('npp_studio_state_v1_recovery'),
    recoveryTabs: second.tabs.filter(t => t.name === 'workspace-recovery.json').length
  };
  second.tabs = second.tabs.filter(t => t.name !== 'workspace-recovery.json');
  second.tabs[0].content = 'ordinary edit after closing recovery tab';
  second.persistState();
  const afterClose = {
    storedUpdated: storage.getItem('npp_studio_state_v1').includes('ordinary edit after closing recovery tab'),
    recoveryTabGone: !storage.getItem('npp_studio_state_v1').includes('workspace-recovery.json'),
    backupRetained: storage.getItem('npp_studio_state_v1_recovery') === corruptRaw,
    blockedToast: second.toasts.some(t => t.includes('Autosave blocked'))
  };
  results.scenarioB_control = { bootBackup, afterReload, afterClose };
  assert.equal(bootBackup, corruptRaw, 'B: backup written on first load');
  assert.equal(afterReload.guardArmed, false, 'B: guard NOT armed when backup verifiably retained');
  assert.equal(afterClose.storedUpdated, true, 'B: ordinary autosave proceeds after close');
  assert.equal(afterClose.backupRetained, true, 'B: original stays recoverable via key');
  assert.equal(afterClose.blockedToast, false, 'B: no unnecessary block');
}

// ---------- Scenario C: edge — after reload, quota freed later; last-chance backup clears guard ----------
{
  const storage = mkStorage(true);
  storage.setItem('npp_studio_state_v1', raw);
  const first = factory(storage);
  first.loadState();
  first.tabs[0].content = 'edited';
  first.persistState();
  const second = factory(storage);
  second.loadState();
  assert.equal(second.guard !== null, true, 'C: guard re-armed after reload');
  // quota freed: allow recovery writes now, sharing the same backing store
  const permissive = mkStorage(false);
  permissive._values = storage._values;
  const third = factory(permissive);
  third.loadState();
  assert.equal(third.guard !== null, true, 'C: guard re-armed in third session');
  third.tabs = third.tabs.filter(t => t.name !== 'workspace-recovery.json'); // last retained copy closed
  third.tabs[0].content = 'edit after quota freed';
  third.persistState(); // last-chance backup now succeeds -> guard clears, autosave proceeds
  results.scenarioC_quotaFreed = {
    backupWritten: storage.getItem('npp_studio_state_v1_recovery') === raw,
    guardCleared: third.guard === null,
    autosaveProceeded: storage.getItem('npp_studio_state_v1').includes('edit after quota freed'),
    blockedToast: third.toasts.some(t => t.includes('Autosave blocked'))
  };
  assert.equal(results.scenarioC_quotaFreed.backupWritten, true, 'C: last-chance backup succeeded');
  assert.equal(results.scenarioC_quotaFreed.guardCleared, true, 'C: guard cleared after real backup');
  assert.equal(results.scenarioC_quotaFreed.autosaveProceeded, true, 'C: autosave proceeds once backup exists');
  assert.equal(results.scenarioC_quotaFreed.blockedToast, false, 'C: no spurious block');
}

// ---------- Scenario D: regression — plain workspace, no recovery tab, no guard ----------
{
  const storage = mkStorage(true);
  const clean = JSON.stringify({
    activeTabId: 'a',
    tabs: [{ id: 'a', name: 'a.txt', content: 'hello', savedContent: 'hello', mode: 'text', dirty: false, bookmarks: [] }],
    tabSize: 2, lineEnding: 'CRLF', macroActions: []
  });
  storage.setItem('npp_studio_state_v1', clean);
  const s1 = factory(storage);
  s1.loadState();
  s1.tabs[0].content = 'changed';
  s1.persistState();
  const s2 = factory(storage);
  s2.loadState();
  results.scenarioD_plain = {
    guardAfterReload: s2.guard,
    persistedUpdate: storage.getItem('npp_studio_state_v1').includes('changed'),
    blockedToast: s2.toasts.some(t => t.includes('Autosave blocked'))
  };
  assert.equal(s2.guard, null, 'D: no guard on ordinary reload');
  assert.equal(results.scenarioD_plain.persistedUpdate, true, 'D: ordinary autosave unaffected');
}

console.log(JSON.stringify(results, null, 2));
console.log('ALL QAQC PROBE ASSERTIONS PASSED');
```
