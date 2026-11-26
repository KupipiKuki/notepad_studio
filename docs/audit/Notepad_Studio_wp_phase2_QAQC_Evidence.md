# Notepad Studio — QA/QC evidence report for the wp/phase2 candidate

Review date: November 26, 2026 (America/New_York; report generated 2026-11-26T17:41:00Z).

**Decision: PASS — the Phase 2 candidate (`aec6ed6`, docs `85a5858` on `wp/phase2`) is verified against `docs/remediation/Notepad_Studio_Phase2_Implementation_Record.md`.** The shared occurrence engine, DOM-safe result rendering, recoverable macro policy, bookmark handling and error-log rewrite are in place; persistence code is untouched; the full committed suite passes locally (118/118); representative regressions were shown to fail on the G1 baseline; and the claimed configured Ubuntu CI run was verified via the GitHub API. This supports G2 review per the handoff — per project rule this report does not self-declare the gate.

## Candidate and branch status

| Item | Verified state |
| --- | --- |
| Branch / HEAD | `wp/phase2` @ `85a58589ebe2bdef696f1b5ffca2d54fe104d78b`, clean working tree (negative-control swap restored from byte-for-byte backup; `git status` clean) |
| Candidate commit | `aec6ed60e496fa2a4201f88e1e1d1fd253c42a89` (2026-11-26) — app +718/-214 lines, 2 new specs, workflow, record |
| Docs-only follow-up | `85a5858…`, records the CI run link |
| Baseline (handoff parent) | `71075ac`; app blob `3393b0f2acd0a2662f3467adcc84ed1c041eb9db` — matches the record's stated G1 baseline blob |
| Candidate app blob | `c2db0232d91627f7090c8961b6e962212864f294` — matches the record |
| New spec blobs | `phase2-search-replace.spec.js` = `5c43d83a…` (18 scenarios), `phase2-textfx-macro-errors.spec.js` = `2310b4ca…` (11 scenarios); G1 specs 15 + 15 unchanged (30 total with them) |
| Workflow blob | `ee3b6fa4…` — triggers on `wp/phase2`, runs all four specs on chromium+firefox |
| Handoff doc | `docs/Notepad_Studio_Phase2_Coder_Handoff.md` present |

## What was reviewed

### 1. Static review of the delta (`git diff 71075ac..aec6ed6`)

- **P06/P08 engine**: `findOccurrences` (`:2679`) is the single occurrence engine; `expandRegexReplacement` (`:2834`), `buildLiteralReplacement` (`:2858`), `replaceMatch` (`:2872`), `replaceAllMatches` (`:2897`), `parseExtendedEscapes` (`:2626`) implement the stated regex/literal/extended contracts.
- **P07 rendering**: `renderSearchResults` (`:3116`) builds rows with `createElement`/`createTextNode`; highlights are source-range spans; ±60-char excerpts with explicit `…`; rows navigate true `{line, ch}` coordinates and identity is the tab ID. `innerHTML` appears only as a list-clearing idiom (`:3138`), never with query or source text.
- **B01 freshness**: `invalidateSearchResults` (`:3207`) clears groups and rows together and reports a truthful zero; hooks in both editor change handlers, query change, `closeTab`, `renameTab`.
- **P12 macros**: `playMacro` (`:2466`) stops at first failure with step/action reporting and `try/finally` recording restore.
- **P13 bookmarks**: `applyTransformedText` (`:2371`) remaps bookmarks through whole-document transforms.
- **P15 error log**: `renderErrorLogUI` (`:1743`) is listener-driven (`addEventListener` closures, `innerHTML=''` clear only).
- **G1 compatibility**: the diff contains **zero** lines touching `STORAGE_KEY`/`RECOVERY_KEY`/`persistState`/`loadState`/`buildWorkspaceData`/`recoveryGuard*`/`sanitizePersistedTab` (grep of the diff) — persistence schema and recovery guards untouched, matching the record's rollback claim (§7: candidate writes only the existing schema; the G1 specs also run green unchanged on this candidate, 30/30 within the 118).

### 2. Local integrated run (independently rerun in this checkout, exact CI command)

`npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js tests/phase2-search-replace.spec.js tests/phase2-textfx-macro-errors.spec.js --project=chromium --project=firefox --reporter=line` → **118 passed / 0 failed / 0 skipped (3.0m)** — 59 scenarios × 2 browsers, matching the record exactly (15 + 15 G1 + 18 search/replace + 11 TextFX/macro/errors).

### 3. Fail-without-fix (negative control, independently reproduced)

With the G1 baseline app (`git show 71075ac:scripts/notepad-studio.html`) temporarily in place, the representative regressions **P2-01, P2-12, P2-20, P2-22 all failed** on Chromium (4 failed), matching the record's claim that representative Phase 2 regressions fail on the baseline. With the candidate restored, all 4 **pass** (4 passed); tree verified clean afterwards.

### 4. CI verification via the GitHub API

Run [45858617482](https://github.com/KupipiKuki/notepad_studio/actions/runs/45858617482): event `push`, branch `wp/phase2`, head_sha `aec6ed60e496…`, run_number 18, workflow `.github/workflows/playwright.yml`, status `completed`, conclusion `success`, 2026-11-26T16:25:23Z→16:28:39Z; job `test` conclusion `success` with every step `success` (npm ci, chromium+firefox install, `Run Playwright tests` over all four specs, artifact upload). The workflow at HEAD indeed triggers on `wp/phase2` and runs the four-spec matrix (diff verified). The remote commit `aec6ed6` was confirmed via the app connector with the expected message.

## Disposition per finding

| Finding | QC result |
| --- | --- |
| P06 occurrence model shared by all consumers | `findOccurrences` single engine; P2-01 fails on baseline, passes on candidate |
| P07 safe snippet rendering | Element/text-node build verified in source; P2-12/P2-13 green on both browsers |
| P08 query/replace/navigation/extended escapes | P2-03..P2-11, P2-15, P2-16, P2-23 green |
| P12 recoverable macros | P2-20/P2-21a–d green; P2-20 fails on baseline |
| P13 bookmark remap + last-line fix | P2-17a–c, P2-18, P2-19 green |
| P15 listener-driven error rows + exact-message copy | P2-22 green; fails on baseline |
| B01 freshness/full-replacement rendering | P2-02, P2-14 green; `invalidateSearchResults` hooks verified in both change handlers, close/rename |
| G1 compatibility / rollback | Persistence diff empty; all 30 G1 scenarios green on the candidate within the 118 |
| Suite + CI claims | 118/118 local; CI run 45858617482 success verified via API |

## Explicit non-claims (carried over verbatim from the record, confirmed accurate)

- Synthetic picker handles / no real Windows picker UI, OS permission grants, or true native OS disk writes.
- WebKit not validated; UTF-16 without BOM unsupported; >2 MiB opens refused by policy; UTF-8-save policy unchanged.
- Phase 3+ findings (P04–P05, P09 remainder beyond Phase 1 scope, P10, P14, P18–P21) and architecture gates remain open; G2 is proposed, not self-declared.

## Sources

- [Candidate app](https://github.com/KupipiKuki/notepad_studio/blob/aec6ed60e496fa2a4201f88e1e1d1fd253c42a89/scripts/notepad-studio.html) — [findOccurrences](https://github.com/KupipiKuki/notepad_studio/blob/aec6ed60e496fa2a4201f88e1e1d1fd253c42a89/scripts/notepad-studio.html#L2679), [renderSearchResults](https://github.com/KupipiKuki/notepad_studio/blob/aec6ed60e496fa2a4201f88e1e1d1fd253c42a89/scripts/notepad-studio.html#L3116), [playMacro](https://github.com/KupipiKuki/notepad_studio/blob/aec6ed60e496fa2a4201f88e1e1d1fd253c42a89/scripts/notepad-studio.html#L2466)
- [Phase 2 specs](https://github.com/KupipiKuki/notepad_studio/tree/aec6ed60e496fa2a4201f88e1e1d1fd253c42a89/tests)
- [Implementation record under review](https://github.com/KupipiKuki/notepad_studio/blob/85a58589ebe2bdef696f1b5ffca2d54fe104d78b/docs/remediation/Notepad_Studio_Phase2_Implementation_Record.md)
- [Coder handoff](https://github.com/KupipiKuki/notepad_studio/blob/85a58589ebe2bdef696f1b5ffca2d54fe104d78b/docs/Notepad_Studio_Phase2_Coder_Handoff.md)
- [CI run 45858617482](https://github.com/KupipiKuki/notepad_studio/actions/runs/45858617482) and its [API record](https://api.github.com/repos/KupipiKuki/notepad_studio/actions/runs/45858617482)
- Prior Phase 1 QA/QC evidence: [G1](https://github.com/KupipiKuki/notepad_studio/blob/85a58589ebe2bdef696f1b5ffca2d54fe104d78b/docs/audit/Notepad_Studio_wp_phase1_G1_QAQC_Evidence.md), [P17 BOM hold](https://github.com/KupipiKuki/notepad_studio/blob/85a58589ebe2bdef696f1b5ffca2d54fe104d78b/docs/audit/Notepad_Studio_wp_phase1_P17_BOM_Hold_QAQC_Evidence.md), [P09/P17](https://github.com/KupipiKuki/notepad_studio/blob/85a58589ebe2bdef696f1b5ffca2d54fe104d78b/docs/audit/Notepad_Studio_wp_phase1_P09_P17_QAQC_Evidence.md), [R02-RL](https://github.com/KupipiKuki/notepad_studio/blob/85a58589ebe2bdef696f1b5ffca2d54fe104d78b/docs/audit/Notepad_Studio_wp_phase1_R02RL_QAQC_Evidence.md)
