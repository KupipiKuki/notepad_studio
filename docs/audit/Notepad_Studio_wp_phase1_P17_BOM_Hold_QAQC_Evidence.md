# Notepad Studio — QA/QC evidence report for the wp/phase1 P17 BOM hold follow-up

Review date: November 26, 2026 (America/New_York; report generated 2026-11-26T01:39:20Z).

**Decision: PASS — the P17 hold is closed.** The follow-up batch (`3bb06f6`, docs `fe1c2f3`) implements exactly the required correction: the UTF-8 BOM branch of `decodeFileBuffer` now validates the post-BOM body with a fatal decode and emits the same data-loss warning on invalid UTF-8, and a committed regression covers the BOM + invalid-UTF-8 fixture (BOM preserved, U+FFFD shown, warning toast + durable log, byte-exact re-export asserting the advertised loss). The regression was independently shown to fail against the pre-fix code. Full suite passes locally (46/46) and the claimed CI run was verified via the GitHub API.

## Candidate and branch status

| Item | Verified state |
| --- | --- |
| Local checkout | `wp/phase1` @ `fe1c2f326aeb4bdf57e0563fe835a8075536949a`, clean working tree (the fail-without-fix probe swapped in the pre-fix app file and restored it from a byte-for-byte backup; `git status` clean afterwards) |
| Remediation commit | `3bb06f60bdef6e474a6e8ae4a6f75d9d1e6282ee` (2026-11-25 19:38:59 -0500) — app +10/-2, spec +35, record +18 |
| Docs-only follow-up | `fe1c2f326aeb4bdf57e0563fe835a8075536949a`, records the CI run link |
| Hold base | `649b7719aeb7887c19b8a489cf4f9508a3fd83e2` (P09/P17 completion batch; its app blob `ef8561a…` is the pre-fix code used for the negative control) |
| App blob at `3bb06f6` and at HEAD | `86f6d0acb5c378fd6dd73ecca7e89eb6fe4543f4` (identical) |
| Spec blob at `3bb06f6` | `e1cdb17ba6c75be74f9083880444ebd2b4c795d5` (8 P17/P09 scenarios in this file now, 23 total with the save-recovery spec) |
| Remote existence | `3bb06f6…` confirmed via GitHub API (`get_commit`): app +10/-2, spec +35, record +18 |

## The hold and the correction

**Hold (valid):** in the pre-fix BOM branch, `text = '\uFEFF' + new TextDecoder('utf-8').decode(bytes.subarray(3))` — a non-fatal decode, so invalid UTF-8 after a BOM was silently replaced with U+FFFD and never produced the "not valid UTF-8" data-loss warning. The existing fixtures (plain invalid UTF-8, BOM-only, binary) did not cover BOM + invalid body.

**Correction (`3bb06f6`):** the BOM branch now decodes the body with `new TextDecoder('utf-8', { fatal: true })`; on failure it falls back to the non-fatal decode (U+FFFD placeholders) **and pushes the same data-loss warning** used by the plain-UTF-8 path, while still preserving the BOM as U+FEFF (`scripts/notepad-studio.html:3551-3562`). The binary heuristic downstream is unchanged and still applies to the decoded text.

**Regression (`tests/phase1-split-encoding.spec.js:212`):** fixture `EF BB BF` + `63 61 66 E9 0A` (BOM + Latin-1 "caf"+E9+LF) asserts: BOM preserved (`charCodeAt(0) === 0xFEFF`), body `caf\uFFFD\n`, toast contains "not valid UTF-8", error count non-zero, and the downloaded save is byte-exact `EF BB BF` + `caf` + `EF BF BD` + `0A` (LF selected) — the advertised loss, now reported.

## Verification evidence

1. **Local integrated run (independently rerun in this checkout), exact CI command:**
   `npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox --reporter=line` → **46 passed / 0 failed / 0 skipped** (23 scenarios × 2 browsers; the new BOM regression included).
2. **Regression validity (fail-without-fix), independently reproduced:** with the pre-fix app file (`git show 649b771:scripts/notepad-studio.html`) temporarily in place, `P17: invalid UTF-8 after a BOM still triggers the data-loss warning` **failed** on Chromium; with HEAD restored it **passed** (1 passed). The file was restored from a byte-for-byte backup and the tree verified clean.
3. **CI verification via the GitHub API:** run [45730238080](https://github.com/KupipiKuki/notepad_studio/actions/runs/45730238080) — event `push`, branch `wp/phase1`, head_sha `3bb06f60bdef…`, run_number 9, workflow `.github/workflows/playwright.yml`, status `completed`, conclusion `success`, 2026-11-26T00:39:04Z→00:41:06Z; job `test` conclusion `success` with every step `success` (npm ci, browser install, `Run Playwright tests` over both specs on chromium+firefox, artifact upload). Matches the record added in `fe1c2f3`.

## Disposition

| Item | Result |
| --- | --- |
| BOM-prefixed UTF-8 payload validated (fatal decode, warning on loss) | Confirmed in code and by the passing regression on both browsers |
| Regression for the BOM + invalid-UTF-8 fixture | Present at spec L212; fails on pre-fix code, passes on fixed code |
| No regression to prior behavior | 46/46 locally (save-recovery spec unchanged: 15 scenarios; split/encoding spec now 8 scenarios) × 2 browsers; CI green |
| BOM byte fidelity preserved | Asserted by both the original BOM round-trip test (L157) and the new test (BOM kept in doc and in save) |

## Residual non-claims

- The native `showOpenFilePicker` path still uses `file.text()` (`:3955`) and remains outside the decode pipeline — unchanged deferral from the P09/P17 record.
- UTF-16 BOM branches decode non-fatally (lone surrogates can still become U+FFFD silently); the hold under review scoped the correction to BOM-prefixed UTF-8. Flagged as a possible future hardening, not a blocker for this batch.
- WebKit and the other out-of-scope Phase 0 findings remain unvalidated; no G1 claim.

## Sources

- [Corrected BOM branch](https://github.com/KupipiKuki/notepad_studio/blob/fe1c2f326aeb4bdf57e0563fe835a8075536949a/scripts/notepad-studio.html#L3551)
- [New regression](https://github.com/KupipiKuki/notepad_studio/blob/3bb06f60bdef6e474a6e8ae4a6f75d9d1e6282ee/tests/phase1-split-encoding.spec.js#L212)
- [Updated record](https://github.com/KupipiKuki/notepad_studio/blob/fe1c2f326aeb4bdf57e0563fe835a8075536949a/docs/remediation/Notepad_Studio_Phase1_P09_P17_Record.md)
- [CI run 45730238080](https://github.com/KupipiKuki/notepad_studio/actions/runs/45730238080) and its [API record](https://api.github.com/repos/KupipiKuki/notepad_studio/actions/runs/45730238080)
- [Prior P09/P17 QA/QC evidence](https://github.com/KupipiKuki/notepad_studio/blob/fe1c2f326aeb4bdf57e0563fe835a8075536949a/docs/audit/Notepad_Studio_wp_phase1_P09_P17_QAQC_Evidence.md)
