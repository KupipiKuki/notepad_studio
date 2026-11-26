# Notepad Studio — Phase 2 implementation record

Implementation date: November 26, 2026 (America/New_York). Evidence timestamps use UTC.
Branch: `wp/phase2`, created from the G1-accepted `wp/phase1` lineage per the coder handoff.
Scope: Phase 2 — correct search, replace and transformation (P06, P07, P08, P12, P13, P15, B01), per `docs/Notepad_Studio_Phase2_Coder_Handoff.md`. No G2 self-declaration; QA/QC and the independent auditor decide the gate.

## 1. Baseline identity

| Item | Value |
| --- | --- |
| Handoff parent | `9589f09aa50b2d5afb8784059431ff67c2737cfd` (G1-accepted) |
| Branch start | `3c736fa` (parent + docs-only G1 acceptance document; app blob identical to parent) |
| App blob at parent (per handoff, verified) | `3393b0f2acd0a2662f3467adcc84ed1c041eb9db` |
| Canonical SHA-256 of the G1 app blob | `354c56f39dae914c6e43c57d4d4e65398f84e123227ac0fd20df3adfac695628` |
| Pristine baseline suite (both G1 specs, chromium+firefox) | **60 passed / 0 failed** — run before any change |
| Candidate app blob (this batch) | `c2db0232d91627f7090c8961b6e962212864f294` |

## 2. Policies chosen (handoff §4 decisions)

- **Occurrence model**: one `findOccurrences(text, query)` engine drives every consumer (single-tab count, forward/back navigation, Replace, Replace All, All Tabs, Mark Lines). Non-overlapping occurrences over an immutable text snapshot; zero-width regex matches advance per `String.matchAll` semantics (one code unit, no skipped positions, no cutoffs); coordinates are zero-based CodeMirror `{line, ch}` UTF-16 code-unit positions with absolute offsets retained.
- **Regex contract**: `g`/`gi` flags, no implicit multiline flag (patterns may express multiline matches via `\n`); identical anchors for navigation and replacement; invalid regex is a distinct `invalid` query state ("Invalid regex") separated from a valid zero-result query ("No matches").
- **Replacement semantics**: user-regex mode uses exact JS `String.replace` token semantics (`$$`, `$&`, $`, $', `$1..$99`, `$<name>`) in single Replace (via a faithful `expandRegexReplacement`) and Replace All (via the engine itself); whole-word literal mode uses an internal `\b…\b` regex for occurrence semantics but keeps replacement text literal (no accidental `$`-expansion); literal mode never re-searches inserted text (single pass over the snapshot); no silent numeric cutoffs (the 999 count cap and 10,000 replacement guard are removed; counts are exact at the tested scale).
- **Whole-word selection rule**: a selection is replaceable only when it IS a valid occurrence of the current query in full-document context (selecting `cat` inside `scatter` is not a valid whole-word replacement).
- **Snippets (P07)**: rows are built from element APIs and text nodes; highlights come from match ranges on the original source text — the query never runs over escaped entities and no source text is parsed as HTML/JS; excerpts show ±60 characters around the hit with `…` markers when truncated while the row keeps and navigates the true coordinates; result identity is the tab ID (duplicate filenames safe).
- **Freshness (B01)**: every render fully replaces groups **and** rows; All-Tab rows are invalidated on any content change (primary or secondary pane), query/flag change, tab close and rename, and never outlive the query; the single-tab count is recomputed after edits while the find panel is open.
- **Undo/bookmarks (P13)**: Replace All, TextFX and macro replay each apply as one logical undoable operation (`editor.operation` around a single document change; undo restores the prior text in one step); whole-document transforms remap bookmarks by unchanged line content (sorts/blank-line removal shift them; deleted content drops its bookmark; markers are not resurrected by undo — defined policy, model re-synced so persisted `tab.bookmarks` never claims invalid lines); split edits to a non-active tab clamp persisted bookmark indices to the new line count; per-tab history isolation is unchanged.
- **Macro policy (P12)**: stop at the first failed action; report the step index and action name; earlier mutations stay recoverable with one Undo; recording flag restored in `try/finally` on every path; replay never records itself; unknown restored action names are reported durably and never erase stored data; JSON/Base64/URI helpers now return a success signal to replay (they already logged/toasted their own failures).
- **Error actions (P15)**: rows built with element APIs + `addEventListener` closures; Copy sends the exact original message (multiline, quotes, backslashes, ampersands, Unicode) through a promise-aware clipboard path with explicit failure/no-availability feedback; Dismiss removes only its own entry across rerenders; `window.dismissError`/`window.copyErrorText` compatibility wrappers retained.
- **Extended escapes (P08)**: strict left-to-right parsing; a doubled backslash keeps the following character literal.

## 3. Change register

| Finding | App changes (`scripts/notepad-studio.html`) | Regressions |
| --- | --- | --- |
| P06 | `findOccurrences` shared engine; `findInAllOpenTabs` rewritten over per-tab occurrences (every occurrence on every line, not one hit per line); `renderSearchResults` badges/counts from the same data | P2-01 (single-tab vs All-Tabs counts agree; every row navigates), origin matrix |
| P07 | `renderSearchResults` rewritten with element/text-node building and source-range highlight spans (no `innerHTML` snippets, no escaped-entity re-query); ±60-char excerpt with explicit `…` truncation | P2-12, P2-13 |
| P08 | `getSearchQuery` (typed query objects incl. `invalid`), `updateSearchResults` (exact counts, honest states), `findNext` (occurrence-based navigation with zero-width advance guard), `expandRegexReplacement`, `buildLiteralReplacement`, `replaceMatch` (selection validated in full-document context), `replaceAllMatches` (single-pass, no cutoffs), `parseExtendedEscapes` (left-to-right) | P2-03..P2-11, P2-15, P2-16, P2-23 |
| P12 | `runTextFxAction` validates the action set and returns success; JSON/Base64/URL transforms return signals; `playMacro` stops at the first failure, reports step/action, single-undo recovery, `try/finally` recording restore | P2-20, P2-21a–d |
| P13 | `applyTransformedText` remaps bookmarks through whole-document transforms; `deleteBookmarkedLines` last-line fix (deletes the line with its newline instead of leaving text+marker); primary change handler refreshes the bookmark model on line-structure changes and invalidates search results; secondary (split) change handler gains the same hooks plus bookmark clamping for non-active tabs | P2-17a–c, P2-18, P2-19 |
| P15 | `renderErrorLogUI` DOM/listener rewrite; `window.copyErrorText` promise-aware with handled rejection/unavailability | P2-22 |
| B01 | `invalidateSearchResults` + full-replacement rendering; hooks in both change handlers, `updateSearchResults` (query change), `closeTab`, `renameTab`; `clearSearchResults` now removes rows as well | P2-02, P2-14 |

No storage keys or schemas changed; no dependencies changed (single-HTML distribution preserved); all Phase 1 save/open/recovery/guard code untouched except the two change handlers' additive hooks and `closeTab`/`renameTab` invalidation calls.

## 4. Verification performed

Windows 11, Node v24.20.0, Playwright 1.65.1, Chromium and Firefox.

- Cumulative committed suite (the exact CI command): `npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js tests/phase2-search-replace.spec.js tests/phase2-textfx-macro-errors.spec.js --project=chromium --project=firefox` — **118 passed / 0 failed / 0 skipped** (59 scenarios × 2 browsers: 15 + 15 accepted G1 scenarios unchanged and green, 18 search/replace scenarios, 11 TextFX/macro/error scenarios). G1 assertions remain green on the same candidate.
- Origin matrix: the core occurrence/navigation/snippet contract is asserted on both the `file://` launch origin and the loopback HTTP origin (see the `origin matrix` scenario); all other scenarios run on `file://`, consistent with the G1 suite.
- Fail-without-fix control: against the committed G1 baseline app (handoff commit `71075ac`), 9 of 10 representative Phase 2 regressions fail — P2-01 (one-hit All-Tabs counting), P2-02 (accumulated rows), P2-04 (dead whole-word Replace), P2-07 (zero-width count mismatch), P2-12 (entity-distorted snippets), P2-19 (stale/invalid bookmark model, last-line deletion defect), P2-20 (false macro success), P2-21c (silent unknown actions), P2-22 (inline-JS copy). P2-17b passes on the baseline as a control (the codec behaviors it covers were already correct). After restoring the corrected app, all pass.
- A standalone function-level probe of the occurrence engine (exact `findOccurrences`/`expandRegexReplacement`/`buildLiteralReplacement` bodies under Node) passed the P2-01/03/05/07/08/10/11/15/16 fixture expectations before browser runs.
- Configured CI (`ubuntu-latest`, workflow now triggers on `wp/phase2` and runs all four specs on chromium+firefox) reran on push of this candidate: GitHub Actions run [45858617482](https://github.com/KupipiKuki/notepad_studio/actions/runs/45858617482) (`Playwright Tests`, event `push`, branch `wp/phase2`, head `aec6ed6`) completed with conclusion `success`, including `Run Playwright tests` (`npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js tests/phase2-search-replace.spec.js tests/phase2-textfx-macro-errors.spec.js --project=chromium --project=firefox`). Playwright exits non-zero on any failed test, so the successful step is direct evidence that all 118 tests (59 scenarios × 2 browsers) passed in the intended Linux environment. The `playwright-report` artifact was uploaded from that run.

## 5. Findings disproved / not changed

- P13's ordinary per-tab undo/bookmark isolation was already correct at the parent (Phase 0 evidence) and required no change beyond the model-refresh hooks above.
- `showToast` timing, toast supersession order, and the record-start macro reset (`toggleMacroRecording` clears `macroActions` when a new recording begins) are pre-existing documented behaviors, unchanged; the P2-21 fixtures were designed around them.
- Recording executes actions as they are captured (record-as-you-go); the P2-20/P2-21b replay baselines account for this, and the handoff's seeded-macro expectation is covered via stored state.

## 6. G1 compatibility (per handoff §6)

- Both G1 specs run unchanged with all 30 scenarios green on this candidate.
- Recovery preservation, durable recovery guard across unseeded reloads, malformed model handling, same-tab split sync, the shared open pipeline with size/encoding policy and the UTF-8/UTF-16 warning behavior are untouched (additive hooks only in the two editor change handlers, `closeTab`, `renameTab`).
- Storage keys/schemas unchanged: `npp_studio_state_v1` (incl. `recoveryTabId`), `npp_studio_state_v1_recovery`, `npp_theme`, `gemini_studio_transfer_queue_v1`, `gemini_studio_bus`. No persisted search metadata was introduced.
- Carried G1 limits verbatim: native Windows picker/permission UI and true native OS writes unvalidated; WebKit/full four-browser matrix not established; UTF-16 without a BOM unsupported; >2 MiB opens refused; conversion follows the explicit UTF-8-save policy. Phase 2 green tests do not relabel these.

## 7. Rollback

Restoring the G1 app (`3393b0f2…`) must reopen candidate-saved synthetic documents/preferences/macros/bookmarks: the candidate writes only the existing schema; the earlier G1 records verified schema-compatible reopening, and this batch changed no persistence code. QA/QC should still re-verify a candidate-saved workspace (edited tabs, bookmarks array, `macroActions`) under the restored G1 app in an isolated context without reseeding.

## 8. Change register (files)

| File | Change |
| --- | --- |
| `scripts/notepad-studio.html` | Shared occurrence engine; query/replace/navigation rewrite; DOM-safe result rendering + freshness hooks; TextFX success signals; recoverable macro policy; bookmark remap + last-line deletion fix; listener-driven error rows/copy |
| `tests/phase2-search-replace.spec.js` | New: 18 committed scenarios (P2-01..P2-16, P2-23, origin matrix) |
| `tests/phase2-textfx-macro-errors.spec.js` | New: 11 committed scenarios (P2-17a/b/c, P2-18..P2-22) |
| `.github/workflows/playwright.yml` | `wp/phase2` triggers; all four specs on chromium+firefox |
| `docs/remediation/Notepad_Studio_Phase2_Implementation_Record.md` | This record |
