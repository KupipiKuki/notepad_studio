# Notepad Studio — Phase 2 coder handoff

Prepared November 26, 2026 (America/New_York).
Status: implementation handoff; **Phase 2 has not been implemented or accepted by this document**.

## 1. Start here

Implement **Phase 2 — correct search, replace and transformation** from the remediation plan, covering **P06, P07, P08, P12, P13 and P15**, plus **B01 stale search-result rows** where it overlaps search freshness. Preserve the accepted Phase 1 behavior and the single-HTML-file application distribution.

Use the accepted G1 source below. Work on a separate branch, recommended name **wp/phase2**. This handoff does not create that branch, change any repository files, merge Phase 1, or start the implementation.

| Baseline item | Pinned identity |
| --- | --- |
| Repository | KupipiKuki/notepad_studio |
| Accepted parent branch | wp/phase1 |
| Accepted parent commit | `9589f09aa50b2d5afb8784059431ff67c2737cfd` |
| Application | `scripts/notepad-studio.html` |
| Application Git blob | `3393b0f2acd0a2662f3467adcc84ed1c041eb9db` |
| Save/recovery spec blob | `ab5ec9cc2715b8a816505a758467e74879368d28` |
| Split/encoding spec blob | `421b9a2c2b202b27414f546e132859bb74e4a6d5` |
| Accepted CI | https://github.com/KupipiKuki/notepad_studio/actions/runs/45827805830 — exact head above; decoded job log records 60 passed |
| Historical original main | `2437b1ceee9a5b5d32755440e74c504b2211fee2`, app blob `d29dfa5785ba62e89ced8386dd022dbec5b42890` |

**G1 PASS** was independently recorded at 9589f09 for the documented browser/API-boundary test scope. The malformed UTF-16 hold is closed. Earlier HOLD documents are historical; they do not override this later decision. The formal record is [Notepad_Studio_G1_Acceptance.md](https://chatgpt.com/library?file_id=libfile_78279bf4cfd081919596299d5cd8999b&account_id=personal). If it is not yet tracked in the repository, include the supplied acceptance record unchanged under docs/audit as historical evidence.

The parent branch was independently checked while preparing this handoff and still pointed to 9589f09. A local folder may still be on an older wp/phase0 checkout: verify it rather than assuming its contents are the accepted source.

### First coder actions

1. Read applicable AGENTS.md instructions, `notepad_studio_remediation_plan.md` §5, the formal G1 decision and the latest Phase 1 records.
2. Verify clean/dirty working-tree state, remote and local branch identities, parent ancestry and source blob. Preserve unrelated work; do not reset or clear browser data to obtain a clean test.
3. Create an isolated Phase 2 branch/worktree from 9589f09. If wp/phase2 already exists, inspect it and its ancestry; do not overwrite it. If the intended parent has advanced, record the divergence and retain the accepted reference rather than silently changing the baseline.
4. Compute SHA-256 from canonical Git source bytes and retain an immutable baseline reference. Windows CRLF working-file hashes can differ from the LF Git blob; record both if used, and label them correctly.
5. Run the existing two Phase 1 specs on Chromium/Firefox before changes. The accepted reference has 30 scenarios × two browsers = **60 tests**. Any mismatch/failure must be understood before it is called a regression of the new work.
6. Reproduce the Phase 2 findings against this parent with fixed fixtures. Record source-confirmed, browser-reproduced, not-reproduced and uncertain outcomes separately.

## 2. Scope and boundaries

| Finding | Required Phase 2 outcome | Evidence already known; reproduce at parent before fixing |
| --- | --- | --- |
| P06 | All occurrences counted and navigable across open tabs | `needle needle needle` previously gave one All Tabs hit while single-tab count gave three |
| P07 | Accurate, safe snippet text/highlights built from source text and match ranges | Entity escaping followed by regex replacement distorted `&` and missed `<`/`>` highlights; one synthetic HTML-string fixture did not execute, which is not a general safety clearance |
| P08 | Consistent search/count/navigation/replacement semantics for case, word, extended and regex modes | Whole-word literal selected Replace did nothing; zero-width `(?=a)` on aaa counted one but replaced three; literal replacement has an unrelated 10,000 guard |
| P12 | Recoverable macro failures and restored recording state with accurate completion feedback | Normal invalid JSON/Base64/URI transforms catch their errors: recording-state failure was not reproduced for those inputs, but replay still reported all steps played; unexpected exceptions remain a source risk |
| P13 | Stable bookmarks, per-tab undo and edit semantics for touched search/TextFX/macro operations | Ordinary tab undo/bookmark isolation passed in Phase 0; do not assume it is broken. Extend checks for document-changing operations and same-tab split synchronization |
| P15 | Listener-driven error Copy/Dismiss with exact message fidelity and handled failures | Multiline Copy generated an invalid inline JS string; global Copy/Dismiss functions already exist, so a missing-handler claim is incorrect |
| B01 | Replace or clear every previous search result; invalidate stale results after edits/query changes | Repeating a search accumulated rows; Clear set badge to zero but left clickable old rows |

These are existing findings and evidence pointers, not a claim that new browser tests were run while writing this handoff. The accepted source was re-inspected at the pinned commit.

**Out of scope:** true visual/unified diff and patch generation (Phase 3, P04/P05); full split/diff performance and retention program (P14); Studio Bus protocol/deduplication (P10/P21); print truncation B02; server/launcher/modular extraction and architecture gates; unrelated layout redesign, dependency upgrades or storage migrations. B01/B02 are additional baseline findings, not architecture gate names.

P13 overlaps Phase 3. Phase 2 owns undo/bookmark stability affected by search, replacement, TextFX and macros, plus regression protection for the accepted split behavior. A broad split-history redesign belongs to Phase 3 unless a localized change is necessary to make a Phase 2 operation correct; record that dependency and its regression coverage explicitly.

## 3. Source map at 9589f09

Line numbers are navigation aids only; verify function names after edits.

| Area | Starting points in scripts/notepad-studio.html |
| --- | --- |
| Error rows / globals | renderErrorLogUI L1734; window.dismissError / window.copyErrorText immediately above |
| Tab history / accepted split sync | selectTab L1942; syncSplitViewIfSameTab L2159; both editor change handlers |
| Selection and transformations | getTargetTextRange L2272; applyTransformedText L2280; runTextFxAction L2290 |
| Macro replay and error paths | playMacro L2327; formatJson L2404; base64Convert L2418; urlConvert L2440 |
| Query and replacement | getSearchQuery L2484; updateSearchResults L2521; findNext L2548; replaceMatch L2570; replaceAllMatches L2601 |
| Bookmarks | bookmarkAllSearchMatches L2697 and related bookmark actions |
| Multi-tab results | findInAllOpenTabs L2797; renderSearchResults L2840; clearSearchResults L2915 |
| Accepted persistence | buildWorkspaceData, recovery guard/load helpers; persistState L3115 |

[Pinned application](https://github.com/KupipiKuki/notepad_studio/blob/9589f09aa50b2d5afb8784059431ff67c2737cfd/scripts/notepad-studio.html)

## 4. Required behavior and implementation guidance

### A. One query contract and occurrence model

Normalize query mode/flags once and use compatible occurrence semantics for counts, forward/back navigation, All Tabs, bookmark matches and Replace All. Matching is against original document text; retain tab ID, absolute offsets and CodeMirror from/to coordinates. CodeMirror ch values are UTF-16 code-unit offsets, not displayed grapheme counts.

- Preserve literal, match-case, whole-word, extended and regex controls. A whole-word literal may use a regex internally; that must not accidentally turn its replacement text into regex replacement syntax.
- Literal replacement treats `$1`, `$&` and similar sequences literally. Regex replacement supports the documented JavaScript capture/replacement behavior consistently in single Replace and Replace All.
- Keep regex `g` and case behavior consistent across consumers. At this parent regex mode uses g/gi without an implicit m flag. Retain that contract unless a necessary change is explicitly documented and covered. Multiline matches expressed by the pattern must still work. Do not silently use different anchor semantics in CodeMirror navigation and JS replacement.
- Match selection against valid occurrences in the **full document context**. Selecting cat inside scatter does not make it a whole word; lookbehind/lookahead must retain their surrounding context.
- Define non-overlapping matches against an immutable input snapshot. Replacement text must not be searched again during the same Replace All; replacing a with aa is one replacement for a one-character input.
- Advance zero-length matches safely without skipping other positions on the same line. Count, navigation and replacement must agree; no infinite loops or arbitrary newline jumps.
- Invalid regex or empty search state must not retain old actionable results or mutate text. Distinguish invalid query feedback from a valid zero-result query.
- Remove silent/inconsistent numeric cutoffs. Counts and replacements must be exact for the fixed supported-size fixtures. A deliberately bounded rendered result list may be documented, but expose truncation clearly and preserve truthful total counts and full operation semantics.

### B. Safe, fresh result rendering

Use text nodes and element/listener APIs for snippets, filenames and messages. Apply highlights from ranges in the original source text; never run a query over escaped entities or concatenate source into executable HTML/inline JS.

Replace the complete previous result set on every search. Clear removes result groups **and rows**, counts and actionable state. Repeated searches must not accumulate rows/listeners.

Use current live-editor/model content, including secondary edits. Results must be updated or explicitly invalidated when content, query/options, tabs or document identity changes. Clearing/invalidation is acceptable for this batch if accurately communicated; stale rows/counts must not appear current or navigate obsolete coordinates. Use tab IDs, not filenames, as identity; duplicate filenames are permitted.

Keep navigation coordinates independent of snippet truncation. For a hit past the first 200 characters, show a meaningful excerpt with correct highlight offsets, or explicitly identify the truncation while retaining the true hit coordinate. Clicking a result must select the intended current tab and original-document match range.

### C. Replacement, TextFX, undo and bookmarks

One Replace All, one TextFX command, and one macro replay should each be one logical undoable operation on the affected document. Verify using real CodeMirror history; editor.operation alone is not proof. Undo/Redo must not cross into an unrelated tab or discard earlier unrelated history.

Preserve the existing TextFX targeting rule: nonempty selection means that selected text; no selection means the whole document. Preserve unrelated prefix/suffix exactly. Do not silently expand partial selections to whole lines. For a transform that requires a different range, document/test that behavior before presenting it as compatible.

Cover all existing TextFX actions: ascending/descending sort, duplicate removal, whitespace trim, blank-line removal, upper/lower/title/camel case, JSON format/minify, UTF-8 Base64 encode/decode, URL encode/decode. Retain the accepted Unicode behavior. Assert cursor/selection/bookmark positions where they remain meaningful; deleted bookmark lines must not leave invalid markers or corrupt another tab.

Maintain correct model content and dirty state after changes, Undo/Redo, tab switching and same-tab split edits. Do not replace the shared document model or disable G1 synchronization to make an undo test pass.

### D. Macro failure policy

Default policy for this batch: **stop at the first failed action**, report the step index/action and cause, and make earlier mutations recoverable with one Undo. A fully rolled-back transaction is also acceptable if it preserves history/state and is explicitly documented/tested. Never report all steps completed after a failure.

Restore the prior recording flag and recording UI in try/finally, on both recognized transform failure and unexpected exceptions. Replaying while recording must not append replayed actions to macroActions. Preserve the recorded action list through replay and valid reload.

JSON/Base64/URI helpers currently catch their own errors. Introduce a reliable internal success/failure signal or equivalent orchestration; adding only try/finally to playMacro will not detect those caught failures. Validate unknown restored action names at replay time with useful feedback; do not silently erase original stored macro data. No destructive macro schema migration is part of this handoff.

### E. Error Copy/Dismiss

Generate error rows with safe text content and addEventListener or equivalent listener properties; remove inline handler strings. Copy the exact original message, including newlines, quotes, backslashes, ampersands, entity-like text and Unicode. Dismiss removes only its intended entry, including after rerenders. Check existing global callers before removing/renaming compatibility wrappers.

Handle missing/rejected clipboard APIs without an unhandled rejection or false Copied success. Test listener routing separately from real OS clipboard permission; a boundary double proves message fidelity, not actual clipboard access.

## 5. Required fixture and regression matrix

Unless stated otherwise, document contents below are JSON-string notation: decode escapes before seeding. Search/replacement UI strings in backticks are the literal field contents. Coordinates are zero-based CodeMirror coordinates; visible line labels remain one-based.

| ID | Fixture / operation | Required assertion |
| --- | --- | --- |
| P2-01 | `"needle needle needle"`, literal needle | 3 occurrences at (0,0), (0,7), (0,14); single-tab and All Tabs counts agree; all occurrences addressable |
| P2-02 | Same search twice, then Clear | No accumulated results; Clear leaves zero groups/rows/hits and no stale click targets |
| P2-03 | `"Cat cat scatter cat"`, whole-word cat | Case-insensitive starts 0,4,16; case-sensitive starts 4,16. The embedded cat in scatter is excluded |
| P2-04 | `"cat cat"`, whole-word on, regex off; select first cat; replace DOG | `"DOG cat"`; replace is not skipped. Selecting cat within scatter is not a valid whole-word replacement |
| P2-05 | `"ab12 ab34"`, regex `(ab)(\d+)`, replacement `$2-$1` | `"12-ab 34-ab"`; same capture semantics in selected Replace and Replace All |
| P2-06 | Literal replacement containing `$1`, `$&`, quotes and backslashes | Exact literal output when regex is off; documented regex expansion only when regex is on |
| P2-07 | `"aaa"`, regex `(?=a)`, replacement X | Count/navigation find 3 original zero-width occurrences; Replace All yields `"XaXaXa"`, count 3, no hang |
| P2-08 | Empty document, regex `^$`, replacement X; plus anchors/end-of-document cases | Empty-doc case is one valid match and becomes `"X"`; remaining cases obey the declared common regex contract |
| P2-09 | `"a\nb"`, extended find `\n`, extended replace `\t` | Exactly `"a\tb"`; exercise literal backslash/extended escape combinations separately |
| P2-10 | `"ab\ncd\nab"`, regex `ab\ncd`, replacement X | One match from (0,0) to (1,2); result `"X\nab"` |
| P2-11 | `"😀a😀a"`, literal a | Positions ch=2 and ch=5 on line 0; correct navigation/highlight; no split surrogate pair |
| P2-12 | Query `&`, `<`, `>`, quotes, `amp`, regex captures over entity-like/synthetic HTML source | Snippet text stays faithful; highlights correspond to source ranges; synthetic handler strings do not execute; no entity-fragment corruption |
| P2-13 | Hit after character 300 in a long line; duplicate filenames across two tabs | Correct original cursor/selection coordinates and tab ID despite truncated excerpt and identical names |
| P2-14 | Edit primary/secondary while results open; change query/flags; close/rename a hit tab; Undo/Redo | Updated or explicitly invalidated results/counts; no stale row navigation or retained closed-tab references |
| P2-15 | 1,500 occurrences on one line; 10,050 literal replacements within supported document sizes | Exact total/replacement output; no silent 999/10,000 boundary behavior; any visual truncation labeled truthfully |
| P2-16 | `"a"`, literal find a, Replace All aa | Exactly `"aa"`, one replacement; inserted text is not rematched |
| P2-17 | Selection-only TextFX with unchanged prefix/suffix; repeat whole-document mode | All 15 existing actions have representative exact-output assertions, including Unicode Base64/URL and JSON failure cases |
| P2-18 | Replace All/TextFX on tab A; independent edit on B; return to A; Undo/Redo | Single logical undo per action, correct prior text/dirty state, independent B history; same-tab split remains coherent |
| P2-19 | Bookmarks before/inside/after changed or deleted lines, tab round trip | Defined line movement/removal; no stale markers or cross-tab corruption; ordinary accepted bookmark behavior retained |
| P2-20 | Macro actions to-upper → format-json → remove-blank-lines on `"not json\n\n"` | Step 2 fails; step 3 is not run; default recoverable result `"NOT JSON\n\n"`; one Undo restores the original; no false three-step success |
| P2-21 | Valid macro, invalid Base64/URI, unexpected thrown action, unknown restored action; recording on/off; reload | Correct failure step/outcome; recording restored; no self-recording; action list/persistence intact; recoverable text/history |
| P2-22 | Error Copy/Dismiss for multiline, `'`, `"`, backslash, `&`, entity-like text and non-ASCII; clipboard rejection | Exact copied message once per click; correct dismissal after rerender; handled failure with no false success or inline JS |
| P2-23 | Invalid regex; no matches; query cleared; context-sensitive lookbehind/whole-word selection | No text mutation from invalid query; honest empty/error state; selection matches validated in full-document context |

Use independent expected values/constant fixtures or well-defined native JS regex behavior as an oracle. Do not derive every expected result from the helper under test or declare a pass because its own count agrees with itself. Fix the no-fix control to the frozen G1 source or deliberately disable only the relevant behavior, then restore and verify clean source identity. Retain evidence that each newly fixed defect fails without the fix where practical; not every fixture needs its own mutation experiment.

## 6. G1 compatibility that must remain intact

Run both existing specs unchanged in their intended assertions:

- `tests/phase1-save-recovery.spec.js` — 15 scenarios.
- `tests/phase1-split-encoding.spec.js` — 15 scenarios.

Protect original-tab native save snapshots and fallback bytes; honest download/dirty state; recovery preservation and guard metadata across **unseeded** reload; malformed model preservation; same-tab split sync; shared open-size/encoding policy; UTF-8 BOM and malformed UTF-8/UTF-16 warning behavior. Avoid gratuitous edits to accepted save/open/recovery code.

Keep the existing storage keys and schemas compatible: npp_studio_state_v1 (including recoveryTabId), npp_studio_state_v1_recovery, npp_theme, gemini_studio_transfer_queue_v1, and gemini_studio_bus. Restore valid saved tabs, macros and bookmarks without clearing them. Search metadata should normally be transient; no persisted schema change is required here.

Carry forward the G1 limits verbatim in handoffs: native Windows picker/permission UI and true native OS writes unvalidated; WebKit/full four-browser matrix not established; unmarked UTF-16 unsupported; >2 MiB opens refused; invalid-input/UTF-16 conversion follows the explicit UTF-8-save policy. Do not relabel those as newly passed because Phase 2 tests are green.

## 7. Test implementation and CI

Suggested new specs: `tests/phase2-search-replace.spec.js` and `tests/phase2-textfx-macro-errors.spec.js`, with deterministic fixtures under `tests/fixtures/phase2/` if useful. Other names are fine if the handoff maps them clearly.

Required baseline matrix: real Chromium and Firefox, **file URLs and loopback HTTP** for Phase 2 behaviors where the environment supports them. Report each actual origin/browser result. Genuine DOM highlighting, CodeMirror selection/history, listener clicks and editor changes must be browser-tested; function mocks alone cannot establish G2. Distinguish API-boundary clipboard tests from actual clipboard grants. Native picker UI and Safari are not silently added to this batch's acceptance scope.

- Resolve app paths relative to the checkout/spec, using pathToFileURL for file launches. Never hardcode C:/Git or test another checkout inadvertently.
- Fresh isolated contexts; synthetic documents only. Seed storage once. A page.reload must reopen app-persisted bytes, never rerun a fixture write that hides persistence bugs.
- Retain page errors/console failures, exact before/after text, match ranges and relevant DOM state; use safe synthetic strings in screenshots/logs.
- Expand existing CI push triggers for wp/phase2 and run **both G1 specs plus the Phase 2 specs** on Chromium/Firefox. Keep upstream example.spec.js/external-site examples outside the remediation evidence command. Install only the claimed browser matrix unless more coverage is deliberately added.
- Existing tests may be adapted for intentional UI changes only with a documented rationale that preserves their original safety assertions. Do not weaken assertions, skip failing cases or change expected output merely to match the implementation.

Suggested explicit suite command, if the proposed filenames are used:

```text
npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js tests/phase2-search-replace.spec.js tests/phase2-textfx-macro-errors.spec.js --project=chromium --project=firefox
```

Parameterize the new specs for both origins and label results. Record actual totals; do not predeclare a Phase 2 test count. The carried G1 suite contributes 60 results in its existing matrix, not 60 newly validated OS operations.

## 8. Recommended change batches

1. Reproduce and freeze semantics/fixtures; implement common query/occurrence model and safe count/navigation/replace behavior (P06/P08).
2. Implement source-range snippet rendering, complete result replacement/clearing and live freshness (P07/B01).
3. Correct transformation/undo/bookmark behavior touched by those operations, implement recoverable macro failure signaling and listener-driven error actions (P12/P13/P15).
4. Run cumulative G1 + Phase 2 regression, inspect the full diff, freeze one candidate and assemble QA/QC handoff.

This order is implementation guidance; localized backward-compatible choices are the coder's responsibility. Do not expand to a diff engine, protocol migration or new architecture to solve these findings. Use Markdown Studio work as verification ideas only; no blanket patch porting into Notepad's CodeMirror model.

## 9. Deliverables and review sequence

Coder delivers focused source commits, committed tests/fixtures, CI update, and `docs/remediation/Notepad_Studio_Phase2_Implementation_Record.md` containing:

- Exact parent/candidate commits and app/test blobs; canonical SHA-256; change register mapping P/B IDs to functions and regressions. Continue existing D identifiers if used, checking the repository to avoid collisions.
- Chosen search/anchor/replacement/selection/undo/macro policies, compatibility decisions, and precise supported/unsupported behavior.
- Before/after reproductions, exact expected/actual results, actual browser versions/origins/timestamps, commands, counts and evidence paths. Keep failed/blocked/unrun outcomes visible.
- Baseline-to-candidate diff review and portable test instructions. Record storage-key/schema and dependency changes, or explicit none.
- Rollback: restoring the accepted G1 app must still reopen candidate-saved synthetic documents/preferences/macros/bookmarks. Test in an isolated context without reseeding on rollback/reload; preserve the raw stored payload for comparison.

Then QA/QC independently reruns the frozen candidate and writes `docs/audit/Notepad_Studio_wp_phase2_QAQC_Evidence.md`, identifying its code SHA and code-identical docs-only successors separately. Verify the actual configured CI run/head/logs, not just a green badge or a copied implementation claim.

The independent auditor then makes the G2 decision. Coder completion, QA PASS and CI green are evidence inputs; they do not self-declare G2. Do not change the frozen candidate during review without issuing a new identity and updated evidence.

### G2 exit criteria

The plan's G2 gate is: **exact match coordinates/counts and replacement output for all fixtures, no injected markup from search results, stable bookmarks and undo semantics, and recoverable macro failures.**

For acceptance, the in-scope P06–P08/P12–P13/P15/B01 records must be fixed or disproved with evidence; required supported-matrix tests must pass on the same candidate, G1 assertions must remain green, and no severe unexplained regression may remain. A blocked required G2 scenario stays unverified and requires explicit disposition; it never becomes a pass through omission. Previously declared G1 environmental limits remain separately visible.

## 10. Primary references

- [Remediation plan, Phase 2/G2](https://github.com/KupipiKuki/notepad_studio/blob/9589f09aa50b2d5afb8784059431ff67c2737cfd/notepad_studio_remediation_plan.md#L80)
- [Pinned G1 application](https://github.com/KupipiKuki/notepad_studio/blob/9589f09aa50b2d5afb8784059431ff67c2737cfd/scripts/notepad-studio.html)
- [Phase 0 evidence and findings](https://github.com/KupipiKuki/notepad_studio/blob/9589f09aa50b2d5afb8784059431ff67c2737cfd/docs/audit/Notepad_Studio_Phase0_Review.md)
- [G1 consolidated record and UTF-16 follow-up](https://github.com/KupipiKuki/notepad_studio/blob/9589f09aa50b2d5afb8784059431ff67c2737cfd/docs/remediation/Notepad_Studio_Phase1_G1_Evidence.md)
- [G1 acceptance decision](https://chatgpt.com/library?file_id=libfile_78279bf4cfd081919596299d5cd8999b&account_id=personal)
- [Accepted exact-head CI](https://github.com/KupipiKuki/notepad_studio/actions/runs/45827805830)
