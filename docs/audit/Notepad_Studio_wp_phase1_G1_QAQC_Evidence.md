# Notepad Studio — QA/QC evidence report for the wp/phase1 G1 batch

Review date: November 26, 2026 (America/New_York; report generated 2026-11-26T12:51:13Z).

**Decision: PASS — the G1 batch (`7a39b47`, docs `c08c4ec`) is verified.** The last open Phase 1 checklist item (native open path bypassing the P17 policy) is closed by a single shared open pipeline used by file input, drag/drop and the `showOpenFilePicker` path. Three new native-path regressions exist, fail against the pre-fix app and pass on the fixed app; the full committed suite passes locally (52/52) and the claimed configured Ubuntu CI run was verified via the GitHub API. The record's G1 checklist disposition maps correctly onto `notepad_studio_remediation_plan.md` §4. This supports accepting the Phase 1 G1 gate **as scoped by the plan** — see non-claims.

## Candidate and branch status

| Item | Verified state |
| --- | --- |
| Local checkout | `wp/phase1` @ `c08c4ec04882ffe6913fb15a447c7ec9723a5c87`, clean working tree (the fail-without-fix probe swapped in the pre-fix app file and restored it from a byte-for-byte backup; `git status` clean afterwards) |
| Code commit | `7a39b4732b2cdfee6d3c37aafbe7c3ecb13ade6b` "Phase 1 G1: shared open pipeline for every open path, G1 evidence record" (2026-11-25 22:22:36 -0500) |
| Docs-only follow-up | `c08c4ec04882ffe6913fb15a447c7ec9723a5c87` (2026-11-25 22:44:33 -0500), records the CI run link |
| Batch base | `fe1c2f326aeb4bdf57e0563fe835a8075536949a` (P17 BOM hold follow-up, PASS) |
| App blob at `7a39b47` and at HEAD | `b19f9396e1ed468cbdd24becff9e639f065abdc0` |
| Spec blob at `7a39b47` | `f90065d8b86ebc671c67bb6df86b40c55a4ab018` (11 scenarios; save-recovery spec still 15 — 26 total) |
| Remote existence | `c08c4ec…` confirmed via GitHub API (`get_commit`, expected message) |

## What was reviewed

### 1. Static review of the delta (`git diff fe1c2f3..7a39b47`)

- New `openFileWithPolicy(file, attachHandle)` (`scripts/notepad-studio.html:3594-3616`) is now the single open pipeline: 2 MiB size guard with log+toast and no tab creation, `file.arrayBuffer()` + `decodeFileBuffer` verified decode (UTF-8/UTF-16 BOM handling, fatal-decode lossy warning, binary heuristic), infos/warnings surfaced as toast + durable log, optional native-handle attachment via `fileHandles`.
- `handleFiles` (file input + drag/drop) now delegates to it (`:3618-3625`) with error handling; the native picker path in `openFileNativeOrFallback` (`:3971-3980`) no longer calls `file.text()` — it awaits `openFileWithPolicy(file, handle)`. Grep confirms **no remaining `readAsText`/`file.text()` open path**; the P17 policy cannot be bypassed by choosing a different open route.
- Behavior parity on the input path: same guard, same decode, same surfacing order (warnings toast last).

### 2. New regressions (`tests/phase1-split-encoding.spec.js:295-380`)

The picker is replaced with synthetic in-page handles (API-boundary doubles, disclosed as not the real OS picker UI):

- `P17 native open: the picker path decodes through the verified pipeline` (L315) — BOM + Latin-1 E9 fixture: BOM preserved (`0xFEFF`), body `caf\uFFFD\n`, "not valid UTF-8" toast + non-zero error count, native handle attached, save writes `\uFEFFcaf\uFFFD\r\n` (CRLF policy) through `createWritable`, `savedContent` keeps the honest un-normalized snapshot, `dirty=false`, status `Saved`.
- `P17 native open: oversized files are refused with the same feedback` (L346) — 3 MB fixture: no tab, limit toast, log entry, workspace untouched.
- `P17 native open: valid UTF-8 opens cleanly with no false warnings` (L369) — control: clean decode, ordinary "Created" toast, `0 Errors`.

### 3. Verification evidence (all independently rerun)

1. **Local full suite, exact CI command:** `npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox --reporter=line` → **52 passed / 0 failed / 0 skipped** (26 scenarios × 2 browsers).
2. **Fail-without-fix:** with the pre-fix app (`git show fe1c2f3:scripts/notepad-studio.html`) temporarily in place, the two native-path regressions **failed** on Chromium and the clean control passed (2 failed / 1 passed); with HEAD restored all three **pass** (3 passed) and the tree was verified clean.
3. **CI via GitHub API:** run [45748514671](https://github.com/KupipiKuki/notepad_studio/actions/runs/45748514671) — event `push`, branch `wp/phase1`, head_sha `7a39b4732b2c…`, run_number 12, workflow `.github/workflows/playwright.yml`, `completed`/`success`, 2026-11-26T03:22:40Z→03:24:51Z; job `test` conclusion `success`, every step `success` (npm ci, chromium+firefox install, `Run Playwright tests` over both specs, artifact upload). Matches the record added in `c08c4ec`.

### 4. G1 checklist disposition vs. plan §4

Plan gate G1 (`notepad_studio_remediation_plan.md:78`): "No silent loss or false clean state in tested save/cancel/permission/quota/split-edit scenarios. Exact bytes and pre/post states match for all supported file formats and line endings." The record's §2 table maps each §4 work item to implementation + regression + prior QA/QC; I spot-checked the mapping: save-state honesty (P01/P11), async-write snapshots (P02/R03), one encoding/line-ending policy (P11), storage recovery (P03/R01/R02/R02-RL), schema validation (P16), split-pane lifecycle (P09), encoding/binary/size warnings on **every open path** (P17, this batch), dirty-close confirmation (closeTab + R02-RL blocked autosave). Each row cites committed scenarios that exist in the specs (15 + 11) and were green in the local run above.

## Disposition

- G1 batch code, regressions, local suite (52/52), negative control, and CI run all verified. **PASS.**
- Minor documentation nit (non-blocking): the record's change register says "17 scenarios in this spec" for the split/encoding spec; the actual count is 11 (15 save-recovery + 11 split/encoding = 26 total, which is what the record's verification section correctly states). Suggest fixing the register line in a future docs touch-up.

## Explicit non-claims (carried over, unchanged)

- Synthetic in-page picker handles test the API boundary, not the real Windows picker UI, OS permission grants, or true OS disk writes.
- WebKit unvalidated; UTF-16 without BOM outside policy; >2 MiB opens refused by policy.
- Phase 2+ findings (P04–P08, P10, P12–P15, P18–P21) and architecture gates B01/B02/A3 remain open and outside G1.
- Per project rule, this report supports G1 acceptance; it does not self-declare the gate.

## Sources

- [Shared open pipeline](https://github.com/KupipiKuki/notepad_studio/blob/c08c4ec04882ffe6913fb15a447c7ec9723a5c87/scripts/notepad-studio.html#L3594) and [native path call site](https://github.com/KupipiKuki/notepad_studio/blob/c08c4ec04882ffe6913fb15a447c7ec9723a5c87/scripts/notepad-studio.html#L3971)
- [Native-path regressions](https://github.com/KupipiKuki/notepad_studio/blob/7a39b4732b2cdfee6d3c37aafbe5c3ecb13ade6b/tests/phase1-split-encoding.spec.js#L315)
- [G1 evidence record under review](https://github.com/KupipiKuki/notepad_studio/blob/c08c4ec04882ffe6913fb15a447c7ec9723a5c87/docs/remediation/Notepad_Studio_Phase1_G1_Evidence.md)
- [Plan §4 / Gate G1](https://github.com/KupipiKuki/notepad_studio/blob/c08c4ec04882ffe6913fb15a447c7ec9723a5c87/notepad_studio_remediation_plan.md#L78)
- [CI run 45748514671](https://github.com/KupipiKuki/notepad_studio/actions/runs/45748514671) and its [API record](https://api.github.com/repos/KupipiKuki/notepad_studio/actions/runs/45748514671)
- Prior QA/QC evidence: [R02-RL](https://github.com/KupipiKuki/notepad_studio/blob/c08c4ec04882ffe6913fb15a447c7ec9723a5c87/docs/audit/Notepad_Studio_wp_phase1_R02RL_QAQC_Evidence.md), [P09/P17](https://github.com/KupipiKuki/notepad_studio/blob/c08c4ec04882ffe6913fb15a447c7ec9723a5c87/docs/audit/Notepad_Studio_wp_phase1_P09_P17_QAQC_Evidence.md), [P17 BOM hold](https://github.com/KupipiKuki/notepad_studio/blob/c08c4ec04882ffe6913fb15a447c7ec9723a5c87/docs/audit/Notepad_Studio_wp_phase1_P17_BOM_Hold_QAQC_Evidence.md)
