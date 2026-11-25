# Notepad Studio — Project audit: wp/phase0 state and wp/phase1 branch transition

Audit date: November 24, 2026 (America/New_York). Evidence timestamps use UTC.

**Decision: `wp/phase0` remains on HOLD and is frozen as the independently audited candidate. Corrective Phase 1 work moves to a new branch `wp/phase1`, cut from `wp/phase0` @ `a2f1acb`. No further commits are to be added to `wp/phase0`.**

This audit records the repository/branch state, the acceptance status of the `wp/phase0` batch, and the handoff to `wp/phase1`. It is a planning/coordination record; it changes no application code.

## 1. Branch inventory

| Branch | Head | Status |
| --- | --- | --- |
| `main` | `2437b1ceee9a5b5d32755440e74c504b2211fee2` | Untouched baseline; immutable Phase 0 reference (application Git blob `d29dfa5785ba62e89ced8386dd022dbec5b42890`) |
| `wp/phase0` | `a2f1acb8d6ba01df418101f869be6ce68a006b28` | Clean, in sync with `origin/wp/phase0`; frozen after the independent audit |
| `wp/phase1` | `a2f1acb8d6ba01df418101f869be6ce68a006b28` | Created by this audit from `wp/phase0`; target branch for the correction cycle |

Remote branches at audit time: `origin/main`, `origin/wp/phase0`, `origin/vibe/remediation-plan`, `origin/vibe/stage1-fixes-8a03ed`. No `wp/phase1` existed before this audit, locally or on origin.

## 2. What `wp/phase0` contains (vs `main` @ `2437b1c`)

```
a2f1acb Documentation cleanup (independent audit of wp/phase0)
799e38a Phase 0 implementation progress (Playwright harness, CI workflow, Phase 0 audit doc)
98e079e docs: auditor-facing code review of the Phase 1 implementation batch
6d3e2e1 Phase 1 (P0 data integrity): honest save state, native-write races, corrupt-state recovery
6e25cdc docs: unified server-centered suite architecture gates and migration roadmap
354cc9e docs: source-grounded Notepad Studio remediation plan
```

Naming note: although the branch is called `wp/phase0`, its only code commit (`6d3e2e1`) is the **first Phase 1 batch** — save/write/state consistency (P01, P02, P03), line-ending policy (P11), persisted-model sanitation (P16) — as the independent audit explicitly records. The branch therefore carries Phase 0 baseline/evidence plus a Phase 1 change batch.

## 3. Acceptance status of `wp/phase0`: HOLD

Per `docs/remediation/Notepad_Studio_wp_phase0_Independent_Audit.md`: the committed regression suite passes 16/16 (8 scenarios × Chromium + Firefox, Playwright 1.65.1, Windows), but independent probes reproduce four unresolved findings:

| ID | Severity | Finding | Required before acceptance |
| --- | --- | --- | --- |
| R02 | **P0** | Failed recovery backup is falsely reported as stored; subsequent autosave then deletes the original payload under genuine localStorage quota pressure (reproduced in Chromium and Firefox with a real `QuotaExceededError`) | Propagate backup success/failure; never claim preservation without a retained copy; keep the original workspace key intact when no recovery copy can be stored; guard replacement autosave until preservation is assured; add genuine quota / denied-backup-write regressions |
| R01 | P1 | Dropped invalid tab-list entries do not trigger recovery preservation — the original payload is silently discarded during repair | Treat dropped entries and other destructive normalization as repairs; preserve the full raw payload via a verified recovery path; cover mixed valid/invalid tab arrays together with R02 |
| R03 | P1 | Native-save failure fallbacks call `saveActiveFile()` with no original tab/snapshot, so the fallback downloads the *active* tab instead of the requested save (wrong-tab filename and bytes confirmed in both browsers, for both Save-As-picker and established-handle paths) | Carry original document identity/name/content snapshot through failure fallbacks as well as success paths; add regressions asserting exact original-document download name/bytes and both tabs' dirty states |
| R04 | P1 | Committed spec hardcodes `file:///C:/Git/notepad_studio/...` paths while the committed workflow runs `npx playwright test` on `ubuntu-latest` — the committed CI/test package cannot run as configured | Resolve the application file from the repository/test location, derive the file URL portably, and rerun the committed workflow configuration in its intended environment |

Gate disposition: **hold the batch and G1 acceptance**. G1 cannot be inferred from the branch name or the passing targeted spec. Remaining Phase 1 scope outside the batch — notably **P09 and P17** — stays open as already declared. The passing committed suite's evidence (honest fallback dirty state, exact CRLF bytes, edit-during-native-write and picker-tab-switch success paths, picker cancellation, malformed-JSON recovery with backup available, model repair fixture) remains credited.

## 4. Next steps (handoff for the correction cycle, on `wp/phase1`)

1. Fix **R02, R01, R03** in `scripts/notepad-studio.html` and extend `tests/phase1-save-recovery.spec.js` with the required regressions (mixed valid/invalid entries, genuine quota and explicit recovery-write denial, Save-As/handle failures after tab switches with exact name/bytes and dirty-state assertions).
2. Fix **R04**: make the spec resolve the application file relative to the repository and make the committed workflow runnable in its intended environment.
3. Freeze one corrected candidate and retest per the audit's §5: the eight committed scenarios unchanged on Chromium and Firefox, plus the new probes, plus a location-independent harness with successful configured CI execution.
4. Only then: bounded G1 acceptance for this batch, or continue with the remaining Phase 1 items (P09, P17) on `wp/phase1`. Do not relabel unvalidated environments (native Windows picker UI, real OS writes, WebKit, full four-browser matrix) as passes.
5. Keep `wp/phase0` frozen as the audited candidate and `main` @ `2437b1c` as the immutable baseline; per the remediation plan, make focused edits on a separate implementation branch and never overwrite the baseline.

## 5. Action taken by this audit

- Created branch `wp/phase1` at `a2f1acb` (the `origin/wp/phase0` head) and checked it out; working tree clean.
- Committed this audit document on `wp/phase1` and pushed the branch to `origin`.
- No commits, tags, or file changes were made to `wp/phase0` or `main`; no application code, tests, or workflow files were modified.

## 6. Sources

- `notepad_studio_remediation_plan.md` — phase definitions, gates G0–G6, findings P01–P21
- `docs/audit/Notepad_Studio_Phase0_Review.md` — Phase 0 baseline and reproduction evidence
- `docs/remediation/Notepad_Studio_Phase1_Implementation_Record.md` — first Phase 1 batch scope and change register
- `docs/audit/Notepad_Studio_Phase1_Code_Review.md` — QA review of batch `6d3e2e1` (16/16 spec, verdict: none of its residual notes block)
- `docs/remediation/Notepad_Studio_wp_phase0_Independent_Audit.md` — independent audit, decision HOLD, findings R01–R04, retest requirements
- Git: `git log main..wp/phase0`, `git branch -a`, `git status` at audit time
