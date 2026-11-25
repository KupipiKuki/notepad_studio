# Notepad Studio — wp/phase1 correction re-audit

Review date: November 24, 2026 (America/New_York).

**Decision: HOLD bounded batch acceptance.** The branch transition is correct, the correction suite has successful Ubuntu CI evidence, and the original R01/R03/R04 changes are present. R02 still has a reload-lifecycle gap reproduced with the exact candidate load/persist functions. This is a function-level reproduction, not a new integrated-browser failure claim.

## Candidate and branch status

| Item | Verified state |
| --- | --- |
| wp/phase1 head | `388c6afadc85b5c12046217a5cba77dc1e1ed4c5` |
| Application blob | `dd935ed7d956d6da92a94d26d0f327fd2c9c980f` (148,488 Git-reported bytes) |
| wp/phase0 frozen head | `a2f1acb8d6ba01df418101f869be6ce68a006b28` |
| main baseline | `2437b1ceee9a5b5d32755440e74c504b2211fee2` |
| Phase 1 ancestry | Four commits ahead of frozen phase0, zero behind |
| Local checkout used previously | Still on older local wp/phase0 at 690cfc8; it was NOT used as the new candidate |
| Scope of this review | Immutable remote wp/phase1 source, correction/transition records, spec, workflow, CI metadata, isolated exact-function probe |

No source, repository branch, test or workflow was changed. The review wrote only reproducible scratch evidence and this report outside the checkout.

## CI and reported tests

The correction record reports **26 passed, 0 failed, 0 skipped** on Windows (13 scenarios × Chromium/Firefox), replacing the earlier local correction attempt's 28-test count. This is a different pushed correction batch; the local 690cfc8 work was not the frozen remote phase0 source.

GitHub Actions run [45525662464](https://github.com/KupipiKuki/notepad_studio/actions/runs/45525662464) was independently checked:

- Event: push; branch wp/phase1.
- Tested commit: `3c30b5d1e25ed5935e54660ef8166302cff3696e`.
- Job and every step concluded success, including npm ci, browser installation, remediation tests and artifact upload.
- Runner configured as ubuntu-latest; tests scoped to the committed remediation spec on Chromium/Firefox.
- The only change from that tested commit to head 388c6af is the correction-record documentation. Application, spec and workflow are identical.

This confirms the intended Linux CI environment now runs successfully and supports the R04 correction. It is not a claim that this reviewer independently reran all 26 browser tests. The browser process exited at launch in the current restricted runtime (Windows exit 3221225506); no fresh browser-suite result is claimed.

## Per-finding disposition

| Finding | Current evidence | Disposition |
| --- | --- | --- |
| R01 — dropped entries | loadState now marks null sanitizer results as repairs; regression present in the successfully run CI suite | Correction present; exact dropped-entry preservation case covered by committed tests |
| R02 — failed recovery backup | Honest failure feedback, recovery tab and same-session guard are present; same-session regression and quota fixture exist | **Incomplete: guard not restored after reload; see R02-RL below** |
| R03 — wrong-document fallback | All three native failure fallbacks pass original tab + contentSnapshot to saveActiveFile; Save As and existing-handle regressions assert requested filename/bytes and dirty state | Correction present with committed CI coverage; native OS permission/write UI remains unvalidated |
| R04 — absolute paths/CI | Spec resolves relative to its own location using pathToFileURL; workflow includes wp/phase1 and the intended spec/browser matrix | Intended Ubuntu execution independently confirmed successful |
| Full Phase 1/G1 | Correction record explicitly leaves P09/P17 open | Not complete; no full G1 acceptance |

## R02-RL — remaining P0 recovery lifecycle gap

Source at head 388c6af:

- Application L3079 initializes `recoveryGuardRaw = null` for each new page session.
- L3082–3098 protects persistence only when that session guard is armed.
- L3188–3192 recognizes a recovery key or open tab holding the raw payload.
- L3242–3254 arms the guard only during a repair in the current load.
- A previously persisted workspace containing a valid recovery tab loads without repair, so the guard is not re-armed.

### Independently reproduced sequence

The test executes the candidate's exact createTab, sanitizer, loadState, preservation, workspace-building and persistence functions. UID, storage and UI/log boundaries are synthetic. A new function context represents a fresh page session; it reads the previously saved bytes without reseeding.

1. Seed a workspace with one valid tab and one object-valued malformed content containing RELOAD_RECOVERY_MARKER. Deny writes to the recovery key.
2. First load repairs the malformed content, creates workspace-recovery.json, and arms recoveryGuardRaw.
3. Edit the valid tab, then persist. The stored workspace contains the original raw payload inside the recovery tab. This is the intended successful first-session preservation.
4. Create a fresh session and load those persisted bytes. Tabs are now structurally valid; recoveryGuardRaw stays null even though the recovery key is absent and the recovery tab is the only retained copy.
5. Remove that clean recovery tab, then persist. The original marker disappears from the stored workspace. Recovery key remains null. No blocked-autosave toast or log occurs.

Observed result:

```json
{
  "method": "Exact candidate functions with synthetic storage; no browser integration claim",
  "before": {
    "guardArmed": true,
    "backup": null,
    "storedContainsOriginal": true
  },
  "afterReload": {
    "guardArmed": false,
    "recoveryTabs": 1
  },
  "afterClose": {
    "storedContainsOriginal": false,
    "backup": null,
    "errors": [],
    "toasts": []
  }
}
```

The probe removes the tab from the model directly. It does not claim to test browser pointer handling. Source inspection shows why the scenario is reachable: createTab marks the recovery tab clean, the repaired persisted tab retains matching content/savedContent on reload, and ordinary closeTab permits closing clean tabs. The candidate's own same-session denied-write test already defines closing the last recovery tab as a condition that must block destructive autosave.

**Impact:** a reload removes the protection that the correction promises for the last retained recovery copy. The same preservation requirement must hold across sessions, not only before the first reload. This remains a P0 data-recovery blocker for bounded acceptance.

### Coverage gap in the current reload regression

Spec L47–54 installs a context.addInitScript that writes the original seed/raw workspace on every navigation. The genuine-quota test calls page.reload at L412. That navigation resets storage to the original fixture before app bootstrap, so the test exercises initial recovery again rather than reopening the workspace that the app actually persisted.

The denied-recovery-write test at L439 covers closing the recovery tab in the same session, but not after an unseeded reload. Passing CI therefore does not contradict this lifecycle failure.

### Required correction and retest

- Preserve or reconstruct recovery-pending protection across reloads while the recovery tab is the only copy. The implementation may use durable recovery metadata or an equivalent design; a session-only flag is insufficient.
- Do not let closing/editing the last retained raw copy enable replacement autosave without an actual retained backup or an explicit, reviewed discard policy.
- Seed isolated browser storage once; do not rewrite it on reload.
- Add the exact sequence: recovery-key writes denied → repair → successful autosave embedding raw → unseeded reload → close last recovery tab → edit/autosave. Assert the original remains accessible or the destructive autosave is blocked, with accurate feedback.
- Include a successful-backup control case so ordinary close/autosave is not unnecessarily blocked.
- Retest the frozen corrected candidate on Chromium/Firefox and rerun configured CI. Keep native OS and remaining Phase 1 deferrals explicit.

## Workflow position

The repository organization is now clear: wp/phase0 is the frozen held candidate; wp/phase1 is the correction track; main remains the immutable baseline. The current correction record correctly proposes bounded batch acceptance rather than declaring G1.

Next step is to fix and independently reverify R02-RL plus the reload-test seeding issue. Once that bounded correction cycle is accepted, continue the remaining Phase 1 scope (notably P09 and P17). Phase 2 and migration/architecture gates were not assessed in this review.

The older Phase1_Implementation_Record is historical documentation of the first batch; the active correction narrative is Notepad_Studio_wp_phase1_Correction_Record.md. Its continued mention of wp/phase0 is historical context, not evidence that the new branch setup failed.

## Sources

- [Candidate persistence and recovery](https://github.com/KupipiKuki/notepad_studio/blob/388c6afadc85b5c12046217a5cba77dc1e1ed4c5/scripts/notepad-studio.html#L3077)
- [Repair-specific guard initialization](https://github.com/KupipiKuki/notepad_studio/blob/388c6afadc85b5c12046217a5cba77dc1e1ed4c5/scripts/notepad-studio.html#L3242)
- [Spec initialization](https://github.com/KupipiKuki/notepad_studio/blob/388c6afadc85b5c12046217a5cba77dc1e1ed4c5/tests/phase1-save-recovery.spec.js#L47)
- [Current reload test](https://github.com/KupipiKuki/notepad_studio/blob/388c6afadc85b5c12046217a5cba77dc1e1ed4c5/tests/phase1-save-recovery.spec.js#L412)
- [Correction record](https://github.com/KupipiKuki/notepad_studio/blob/388c6afadc85b5c12046217a5cba77dc1e1ed4c5/docs/remediation/Notepad_Studio_wp_phase1_Correction_Record.md)
- [Transition record](https://github.com/KupipiKuki/notepad_studio/blob/388c6afadc85b5c12046217a5cba77dc1e1ed4c5/docs/audit/Notepad_Studio_Project_Audit_wp_phase1_Transition.md)

## Reproducible isolated probe

Run the following as a .cjs file with Node. It asserts the observed failure, not the desired fixed behavior. Candidate function bodies are embedded verbatim; the fixture and doubles are declared separately. The same probe was run both in the orchestration JavaScript runtime and Node v24 on the available host; both produced the result above.

```javascript
const assert=require('node:assert/strict');
// Exact functions retrieved from wp/phase1 commit 388c6af, blob dd935ed7d956d6da92a94d26d0f327fd2c9c980f.
// Synthetic storage, UID and UI boundaries. No browser integration claim.
const candidateFunctions="  function createTab(name, content, mode) {\n    const fileName = name || 'untitled.txt';\n    const docMode = mode || detectMode(fileName);\n    return {\n      id: uid(),\n      name: fileName,\n      content: content || '',\n      savedContent: content || '',\n      mode: docMode,\n      dirty: false,\n      cursor: { line: 0, ch: 0 },\n      scroll: { left: 0, top: 0 },\n      history: null,\n      bookmarks: []\n    };\n  }\n  function detectMode(filename) {\n    const ext = (filename || '').split('.').pop().toLowerCase();\n    return EXT_MAP[ext] || 'text';\n  }\n  function buildWorkspaceData() {\n    return {\n      activeTabId: activeTabId,\n      wordWrap: wordWrap,\n      tabSize: tabSize,\n      lineEnding: lineEnding,\n      macroActions: macroActions,\n      tabs: tabs.map(function(t) {\n        return {\n          id: t.id,\n          name: t.name,\n          content: t.content,\n          savedContent: t.savedContent,\n          mode: t.mode,\n          dirty: t.dirty,\n          bookmarks: Array.isArray(t.bookmarks) ? t.bookmarks : []\n        };\n      }),\n      showSymbolsActive: showSymbolsActive,\n      rulerMode: rulerMode\n    };\n  }\n  function persistState() {\n    if (recoveryGuardRaw !== null && !isRecoveryPayloadRetained(recoveryGuardRaw)) {\n      // Last chance to retain the original outside the workspace key\n      if (preserveRecoveryPayload(recoveryGuardRaw)) {\n        recoveryGuardRaw = null;\n      } else {\n        logError('Storage', 'Workspace autosave blocked: the original saved state could not be backed up. Keep the workspace-recovery.json tab (or use Download Workspace Backup) before closing it.', '');\n        if (!recoveryBlockedWarningShown) {\n          recoveryBlockedWarningShown = true;\n          showToast('Autosave blocked: the original data would be lost. Keep or export the workspace-recovery.json tab.');\n        }\n        return;\n      }\n    }\n    try {\n      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildWorkspaceData()));\n      storageWarningShown = false;\n    } catch (e) {\n      logError('Storage', 'Failed to persist workspace state: ' + e.message, '');\n      if (!storageWarningShown) {\n        storageWarningShown = true;\n        showToast('Storage warning: browser could not save the workspace. Use Download Workspace Backup (Command Palette) to keep a copy.');\n      }\n    }\n  }\n  function preserveRecoveryPayload(raw) {\n    try {\n      localStorage.setItem(RECOVERY_KEY, raw);\n      return true;\n    } catch (e) {\n      logError('Storage', 'Recovery backup could not be stored by the browser: ' + ((e && e.message) ? e.message : e), '');\n      return false;\n    }\n  }\n  function isRecoveryPayloadRetained(raw) {\n    try {\n      if (localStorage.getItem(RECOVERY_KEY) === raw) return true;\n    } catch (e) {}\n    return tabs.some(function(t) { return t && t.content === raw; });\n  }\n  function pushRecoveryTab(raw) {\n    const exists = tabs.some(function(t) {\n      return t.name === 'workspace-recovery.json' && t.content === raw;\n    });\n    if (!exists) tabs.push(createTab('workspace-recovery.json', raw, 'json'));\n  }\n  function coercePersistedString(value) {\n    if (value == null) return '';\n    if (typeof value === 'string') return value;\n    if (typeof value === 'number' || typeof value === 'boolean') return String(value);\n    return '';\n  }\n  function sanitizePersistedTab(rawTab, usedIds) {\n    if (!rawTab || typeof rawTab !== 'object' || Array.isArray(rawTab)) return null;\n    let repaired = false;\n\n    let id = rawTab.id;\n    if (typeof id !== 'string' || !id || usedIds.has(id)) {\n      id = uid();\n      repaired = true;\n    }\n    let name = rawTab.name;\n    if (typeof name !== 'string' || !name.trim()) {\n      name = 'untitled.txt';\n      repaired = true;\n    }\n    const content = coercePersistedString(rawTab.content);\n    const savedContent = coercePersistedString(rawTab.savedContent);\n    if (content !== rawTab.content || savedContent !== rawTab.savedContent) repaired = true;\n\n    let mode = rawTab.mode;\n    if (typeof mode !== 'string' || PERSISTED_MODES.indexOf(mode) === -1) {\n      mode = detectMode(name);\n      repaired = true;\n    }\n\n    const bookmarkLines = [];\n    if (Array.isArray(rawTab.bookmarks)) {\n      rawTab.bookmarks.forEach(function(b) {\n        const line = Math.floor(Number(b));\n        if (Number.isFinite(line) && line >= 0) bookmarkLines.push(line);\n      });\n      if (bookmarkLines.length !== rawTab.bookmarks.length) repaired = true;\n    } else if (rawTab.bookmarks != null) {\n      repaired = true;\n    }\n\n    const tab = createTab(name, content, mode);\n    tab.id = id;\n    tab.savedContent = savedContent;\n    tab.dirty = content !== savedContent;\n    tab.bookmarks = bookmarkLines;\n    return { tab: tab, repaired: repaired };\n  }\n  function loadState() {\n    let raw = null;\n    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }\n\n    if (raw) {\n      let parsed = null;\n      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }\n\n      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.tabs) && parsed.tabs.length) {\n        const usedIds = new Set();\n        const sanitizedTabs = [];\n        let repairedSomething = false;\n        parsed.tabs.forEach(function(rawTab) {\n          const result = sanitizePersistedTab(rawTab, usedIds);\n          if (result) {\n            usedIds.add(result.tab.id);\n            sanitizedTabs.push(result.tab);\n            if (result.repaired) repairedSomething = true;\n          } else {\n            // R01: a dropped entry is destructive normalization — it is a repair\n            repairedSomething = true;\n          }\n        });\n\n        if (sanitizedTabs.length) {\n          tabs = sanitizedTabs;\n          wordWrap = !!parsed.wordWrap;\n          tabSize = [2, 4, 8].indexOf(parsed.tabSize) !== -1 ? parsed.tabSize : 2;\n          lineEnding = parsed.lineEnding === 'LF' ? 'LF' : 'CRLF';\n          macroActions = Array.isArray(parsed.macroActions)\n            ? parsed.macroActions.filter(function(a) { return typeof a === 'string'; })\n            : [];\n          showSymbolsActive = !!parsed.showSymbolsActive;\n          rulerMode = parsed.rulerMode === 1 || parsed.rulerMode === 2 ? parsed.rulerMode : 0;\n          activeTabId = typeof parsed.activeTabId === 'string' && usedIds.has(parsed.activeTabId)\n            ? parsed.activeTabId\n            : tabs[0].id;\n\n          if (repairedSomething) {\n            // R02: only claim a retained backup when the recovery key write\n            // verifiably succeeded; otherwise keep the raw payload inside the\n            // workspace and guard it from replacement autosave.\n            if (preserveRecoveryPayload(raw)) {\n              logError('Storage', 'Saved workspace contained invalid entries; they were repaired. A backup of the original state was kept.', raw.slice(0, 100));\n              showToast('Workspace state was repaired; original backup stored in recovery key.');\n            } else {\n              recoveryGuardRaw = raw;\n              pushRecoveryTab(raw);\n              logError('Storage', 'Saved workspace contained invalid entries; they were repaired, but the browser refused the recovery-key backup. The original data is kept in the workspace-recovery.json tab — do not close it without exporting. Autosave is blocked while the original is not backed up.', raw.slice(0, 100));\n              showToast('Workspace repaired; recovery backup failed — original preserved as workspace-recovery.json tab.');\n            }\n          }\n          return;\n        }\n\n        // R02: track failed key writes on every recovery path\n        if (!preserveRecoveryPayload(raw)) recoveryGuardRaw = raw;\n        logError('Storage', 'Saved workspace contained no usable documents. Starter tabs were restored and the original data was preserved for recovery.', raw.slice(0, 100));\n        showToast('Saved workspace could not be loaded; original data preserved as workspace-recovery.json tab.');\n      } else if (parsed === null) {\n        if (!preserveRecoveryPayload(raw)) recoveryGuardRaw = raw;\n        logError('Storage', 'Saved workspace data is corrupt and could not be parsed. Starter tabs were restored and the original data was preserved for recovery.', raw.slice(0, 100));\n        showToast('Saved workspace is unreadable; original data preserved as workspace-recovery.json tab.');\n      } else {\n        if (!preserveRecoveryPayload(raw)) recoveryGuardRaw = raw;\n        logError('Storage', 'Saved data is not a valid workspace state. Starter tabs were restored and the original data was preserved for recovery.', raw.slice(0, 100));\n        showToast('Saved data is not a valid workspace; original data preserved as workspace-recovery.json tab.');\n      }\n    }\n\n    tabs = getStarterTabsData().map(function(st) {\n      return createTab(st.name, st.content, st.mode);\n    });\n    activeTabId = tabs[0].id;\n\n    if (raw) {\n      // P03: surface the unusable payload as an editable, savable tab instead of discarding it\n      pushRecoveryTab(raw);\n    }\n  }";
const globals="let tabs=[],activeTabId=null,wordWrap=false,tabSize=2,lineEnding='CRLF',macroActions=[],showSymbolsActive=false,rulerMode=0,recoveryGuardRaw=null,recoveryBlockedWarningShown=false,storageWarningShown=false;let i=0;const uid=()=> 'new-'+(++i),EXT_MAP={txt:'text',json:'json'},STORAGE_KEY='npp_studio_state_v1',RECOVERY_KEY=STORAGE_KEY+'_recovery',PERSISTED_MODES=['text','javascript','json','python','htmlmixed','xml','css','markdown','yaml','sql','text/x-csrc','shell'];const errors=[],toasts=[];const logError=(...a)=>errors.push(a),showToast=m=>toasts.push(m),getStarterTabsData=()=>[{name:'starter.txt',content:'starter',mode:'text'}];";

const factory=new Function('localStorage',globals+'\n'+candidateFunctions+'\nreturn {loadState,persistState,get tabs(){return tabs},set tabs(v){tabs=v},get guard(){return recoveryGuardRaw},errors,toasts};');
const raw=JSON.stringify({activeTabId:'good',tabs:[{id:'good',name:'good.txt',content:'good',savedContent:'good',mode:'text',dirty:false,bookmarks:[]},{id:'bad',name:'bad.txt',content:{text:'RELOAD_RECOVERY_MARKER'},savedContent:'',mode:'text',bookmarks:[]}],tabSize:2,lineEnding:'CRLF',macroActions:[]});
const values=new Map([['npp_studio_state_v1',raw]]);
const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(k.endsWith('_recovery'))throw Error('recovery write denied');values.set(k,v)}};
const first=factory(storage);first.loadState();first.tabs[0].content='edited';first.persistState();
const before={guardArmed:first.guard===raw,backup:storage.getItem('npp_studio_state_v1_recovery'),storedContainsOriginal:storage.getItem('npp_studio_state_v1').includes('RELOAD_RECOVERY_MARKER')};
const second=factory(storage);second.loadState(); // genuinely reload existing persisted bytes: NO fixture reseed
const afterReload={guardArmed:second.guard!==null,recoveryTabs:second.tabs.filter(t=>t.name==='workspace-recovery.json').length};
second.tabs=second.tabs.filter(t=>t.name!=='workspace-recovery.json'); // clean tab can be closed by the UI
second.persistState();
const result={method:'Exact candidate functions with synthetic storage; no browser integration claim',before,afterReload,afterClose:{storedContainsOriginal:storage.getItem('npp_studio_state_v1').includes('RELOAD_RECOVERY_MARKER'),backup:storage.getItem('npp_studio_state_v1_recovery'),errors:second.errors,toasts:second.toasts}};
assert.equal(before.storedContainsOriginal,true);
assert.equal(afterReload.guardArmed,false);
assert.equal(result.afterClose.storedContainsOriginal,false);
console.log(JSON.stringify(result,null,2));

```

