# Notepad Studio — Remediation and Improvement Implementation Plan

Date: November 8, 2026  
Status: **Planning only — source inspected; no application code changed or browser checks executed**  
Repository: [KupipiKuki/notepad_studio](https://github.com/KupipiKuki/notepad_studio)  
Current baseline: `main` at `2437b1ceee9a5b5d32755440e74c504b2211fee2`  
Reviewed file: [`scripts/notepad-studio.html`](https://github.com/KupipiKuki/notepad_studio/blob/main/scripts/notepad-studio.html)  
Git blob SHA: `d29dfa5785ba62e89ced8386dd022dbec5b42890`  
File: approximately 3,939 lines, 137,785 GitHub-reported blob bytes; **SHA-256 must be computed from an immutable baseline in Phase 0**.  
Related plans: [Markdown Studio](https://github.com/KupipiKuki/markdown_studio/blob/vibe/code_revisions/markdown_studio_remediation_plan.md) and [Notebook Studio](https://github.com/KupipiKuki/notebook_studio/blob/vibe/remediation-plan/notebook_studio_remediation_plan.md).

## 1. Objective, baseline and execution rules

Make Notepad Studio safe for editing, saving, searching, transforming, comparing and transferring text while preserving its **single-HTML-file distribution**, existing documents, browser-local workspace and established features. Keep the current desktop-style IDE user experience, unless fixing a documented defect requires a focused change.

**Already implemented in `main`:** merged PRs #1–#5 provide initial correctness and macro persistence, bookmarking, search across tabs, live split diff, synchronized scrolling, whitespace marks, ruler, native disk APIs, cross-studio transfers, command palette, examples and exported diff. Do not recreate these. `vibe/stage1-fixes-8a03ed` is already an ancestor of `main` (seven commits behind); use `main` as source of truth.

- Make focused edits on a separate implementation branch; never overwrite the baseline or clear localStorage as a routine test/rollback measure.
- Preserve support for local `file://` launch and HTTP origin where the relevant browser APIs permit it. Treat unsupported/permission-denied APIs as documented environmental constraints.
- Automatically fix localized, backward-compatible defects, assigning `D001` etc. and recording change and regression evidence. Do not silently introduce new features, a module/bundler migration, destructive storage changes, or a cross-suite protocol break.
- Freeze each gate's candidate, distinguish source-observed behavior from browser-reproduced bugs, and record every failed/blocked/unrun test. A syntax pass or jsdom mock never substitutes for genuine interactive/browser/download validation.
- Keep user data and sensitive files out of screenshots/logs; test in isolated profiles with synthetic files.
- Do not claim fixes, compatibility or security validation until the corresponding tests actually run.

## 2. Findings register (source-level review)

Evidence terminology: **source-confirmed implementation** means the code path exists; **risk** means outcome requires a browser or file round-trip test. All links point to the frozen baseline commit. Prioritize potential data loss and misleading output first.

| ID | Priority | Source finding | Verification focus |
| --- | --- | --- | --- |
| P01 | P0 | **Saved indicator and disk success can diverge:** `saveActiveFile` marks `savedContent`, clears dirty and persists state before initiating a Blob download ([L3243–3269](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3243-L3269)); a programmatic download click does not prove the user retained the file. Native save only clears after write/close, but fallback marks it saved locally without distinguishing fallback from disk. | Denied downloads, picker failure, cancel, controlled disk writes; exact saved vs unsaved statuses. |
| P02 | P0 | **Native write races with subsequent edits:** `saveFileNativeOrFallback` captures `const content = editor.getValue()` then `await`s write and close and unconditionally clears `tab.dirty` ([L3637–3688](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3637-L3688)). New edits during pending I/O can be mislabeled saved. | Delay native close; edit while saving, switch tab, close and reopen, verify persisted byte snapshot and dirty flag. |
| P03 | P0 | **Workspace load silently resets on invalid persisted JSON:** `loadState` swallows errors and creates starter tabs ([L3081–3107](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3081-L3107)). A subsequent autosave could replace recoverable broken storage. Persist errors log/toast but offer no recovery action ([L3052–3079](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3052-L3079)). | Corrupted data, quota limits, malformed tabs, recoverable backup, no silent overwrite. |
| P04 | P1 | **Export Diff is not a true unified edit diff:** `exportDiffFile` compares equal-index lines and emits a single whole-file hunk ([L3198–3240](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3198-L3240)). An insertion near the start is reported as many replacements; patch applicability needs proof. | Validate output using `git apply --check`, `patch --dry-run`, reconstructed text, insert/delete/reorder/multiple hunks. |
| P05 | P1 | **Live diff misattributes shifted blocks:** `runDiffComparison` compares lines by row position ([L2904–2939](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L2904-L2939)), so additions/deletions may appear as modified lines. | Fixture with single inserted/deleted line and multiline shifted segments; compare to correct edit algorithm and side-by-side visuals. |
| P06 | P1 | **Find in all tabs undercounts matches:** it calls `match`/`indexOf` once for each line ([L2777–2818](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L2777-L2818)) rather than collecting every match. | Repeated substrings per line, regex matches, case/whole-word/extended modes, exact hit count and locations. |
| P07 | P1 | **Search-result markup transforms escaped text using a regex:** snippet text is escaped and then `replace(hitRe, '<span...>$1</span>')` is assigned as `innerHTML` ([L2848–2874](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L2848-L2874)). Escape transformations can change matching and markup semantics; potential safe-output concern requires tests. | Search for `&`, `<`, `>`, quotes, text matching entities, regex capture groups and zero-width patterns; build DOM from text nodes instead. |
| P08 | P1 | **Regex search and replacement edge cases:** `getSearchQuery`, `updateSearchResults`, `replaceMatch`, `replaceAllMatches` ([L2464–2613](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L2464-L2613)) mix CodeMirror cursors with JS regex operations, cap results (999) and replacements (10,000), and use different zero-width handling. | Anchors, lookahead, zero-width, capture references, multiline, selection replacement, overlapping hits, large files, undo grouping and accurate truncated-count UI. |
| P09 | P1 | **Split-pane edits can be lost on reference reload:** `secondaryEditor` is editable and updates the referenced tab's content ([L1839–1854](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L1839-L1854)), while `populateSplitTabSelect` reloads secondary content ([L2127–2151](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L2127-L2151)). Validate same-tab, other-tab, active tab transitions and dirty/bookmark state. | Edit secondary pane, switch/split/close tabs, save active/secondary, compare all tab contents byte-for-byte. |
| P10 | P1 | **Cross-studio messages can duplicate or be falsely reported delivered:** queue plus BroadcastChannel are both used ([L3694–3757](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3694-L3757)), messages have no durable consumed-ID register, payload schema/limits or acknowledgment, and send always shows success. | Two receiver tabs, broadcast plus focus, replays, storage quota, oversized payloads, offline receiver, wrong target, version compatibility. |
| P11 | P1 | **Native and fallback save differ in line endings:** `saveActiveFile` applies chosen `CRLF`/`LF` conversion ([L3242–3258](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3242-L3258)); native write uses `editor.getValue()` without the same conversion ([L3643–3669](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3643-L3669)). | Exact bytes with CRLF, LF, mixed endings, native save/Save As/download; preserve explicit intended policy. |
| P12 | P1 | **Macro replay has weak rollback and failure isolation:** `playMacro` runs a sequence of document-changing TextFX actions with state toggled manually around `editor.operation` ([L2270–2321](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L2270-L2321)); no `try/finally` restores recording state if an action throws. | Invalid JSON/base64/URI transform, failure halfway through, undo, persistence after reload, selection handling. |
| P13 | P2 | **Bookmarks and undo state need cross-tab synchronization checks:** primary editor snapshots per-tab cursor, history and gutter markers in `selectTab` ([L1940–2005](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L1940-L2005)); split editor modifies the same tab outside this primary history path. | Tab round trips, split edits, bookmark line shifts, deletion, reopen, and per-document undo isolation. |
| P14 | P2 | **Line-level diff repeatedly iterates every line:** `clearDiffHighlights` walks whole documents, followed by full `runDiffComparison` after 250ms debounce ([L2904–2946](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L2904-L2946)). | 10k/100k-line fixtures; render time, responsiveness, stale runs and retained mark/scroll objects. |
| P15 | P2 | **Copy error handling interpolates text in inline JS:** error-log `onclick` string assembly ([L1768–1783](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L1768-L1783)) risks malformed attributes with quotes or special content. Inspect the actual global handlers before asserting they are missing (Markdown R04 does not automatically apply). | Exact message copy/dismiss and event listener coverage using quotes, backslashes and safe synthetic HTML strings. |
| P16 | P2 | **Workspace persistence lacks strict model validation:** `loadState` accepts `parsed.tabs` and restored macro actions/bookmarks largely as-is ([L3052–3107](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3052-L3107)). | Malformed/legacy object fields, duplicate IDs, invalid modes, oversized files and stale macros. |
| P17 | P2 | **Raw file reading assumes UTF-8 text without encoding detection or size controls:** fallback `FileReader.readAsText` ([L3272–3279](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3272-L3279)) and native `file.text()` ([L3623–3633](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3623-L3633)). | UTF-8 BOM, non-UTF8, binary, huge files, decoding errors and fidelity on round trip; declare supported encodings. |
| P18 | P2 | **Shortcut and dialog coverage needs browser validation:** CodeMirror binds Ctrl shortcuts, macros, bookmarks ([L1809–1825](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L1809-L1825)); palette uses F1/Ctrl+Shift+K ([L3887–3896](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3887-L3896)). | Cross-platform ctrl/meta keys, input focus, Escape, accessibility, shortcut collisions, CodeMirror vs window handling. |
| P19 | P2 | **Dependency/CDN and offline assumptions:** single HTML app loads many CodeMirror modules and Google Fonts from network ([L8 onward](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L8-L50)). | `file://` vs localhost, disabled network, failed CDN, defensive initialization and documented browser support. |
| P20 | P2 | **Automated browser testing is not committed:** `main` tree contains only `LICENSE`, `README.md`, `scripts/notepad-studio.html`; PR summaries cite syntax and limited jsdom smoke tests, not end-to-end file/diff validation. | Add reproducible Playwright/CI harness without changing distribution format. |
| P21 | P2 | **User feedback can be optimistic in unsupported API paths:** save/download and cross-studio send show success after initiating rather than receiving acknowledgment, while localStorage transfer errors are swallowed ([L3708–3729](https://github.com/KupipiKuki/notepad_studio/blob/2437b1c/scripts/notepad-studio.html#L3708-L3729)). | Clipboard/permission/cancel/storage failures; distinguish queued, delivered, downloaded, failed, saved. |

Every finding must be confirmed or disproved in Phase 0. `P0/P1/P2` denotes potential priority, not confirmed exploit status.

## 3. Phase 0 — Immutable baseline and functional reproduction

**Work**
- [ ] Preserve an immutable original `scripts/notepad-studio.html` and verify commit, Git blob and computed SHA-256 (distinct identifiers). Inventory pinned library versions, environment and binary/text handling.
- [ ] Inventory all ribbon menus, buttons, dialogs, dropdowns, command palette entries, shortcuts, TextFX actions, search modes, bookmarks, split view, scroll syncing, macros, native/fallback I/O, Studio Bus and export options.
- [ ] Establish Playwright Chrome/Edge browser tests and Firefox as secondary where available. Record *actual* Windows coverage rather than assuming it. Test `file://` and HTTP origins.
- [ ] Create fixed fixtures: mixed line endings, UTF-8 BOM/non-ASCII, empty and long documents, 10k+ lines, duplicate lines, many regex occurrences on one line, zero-width patterns, split edit, shifted diff, quotes/entities, malformed saved state, quota exhausted and two simultaneous receiver tabs.
- [ ] Capture before-state screenshots, console errors and exact bytes without exposing personal files.

**Gate G0:** Baseline intact, test control inventory complete, each P finding has evidence or an explicit unverified flag, and launch/browser limitations are recorded.

## 4. Phase 1 — Saving, recovery and data integrity (P01–P03, P09, P11, P16–P17)

**Work**
- [ ] Separate “workspace auto-saved to browser”, “download initiated”, “native file write completed”, “disk save failed” and “unsaved external changes”. Do not mark a file saved merely because a Blob download click fired.
- [ ] Use immutable text/version snapshots during async native writes. After completing write, keep dirty if current editor text differs from saved snapshot. If tabs switch mid-write, complete status against the original tab.
- [ ] Make native and fallback save use one explicit encoding/line-ending policy, ideally preserving original line endings unless user requests conversion; clarify what editor text has normalized.
- [ ] Treat storage load failures as recovery mode. Preserve raw recoverable payload for download/repair rather than resetting and overwriting it on next autosave.
- [ ] Validate persistence schema and legacy data; preserve original data, macro actions and bookmarks while safely migrating in memory.
- [ ] Ensure split-pane edited text survives selection, tab close, toolbar save, disk save, crash/reload and scope-sensitive actions.
- [ ] Warn about unsupported/binary encodings and large files; test every open path and true download/file write bytes.
- [ ] Add recovery or confirmation where closing dirty or deleted tabs could discard the only valid copy.

**Gate G1:** No silent loss or false clean state in tested save/cancel/permission/quota/split-edit scenarios. Exact bytes and pre/post states match for all supported file formats and line endings.

## 5. Phase 2 — Correct search, replace and transformation (P06–P08, P12–P13, P15)

**Work**
- [ ] Use one search-query normalization and occurrence iterator for single-tab, multi-tab, bookmark matches and Replace All where semantics align; preserve case/word/regex/extended modes.
- [ ] Capture *all* matches on each line and correct totals; handle zero-length regex safely and make truncation explicit.
- [ ] Build highlighted snippets with text nodes and safe span elements rather than regex replacement into escaped HTML; preserve indices when highlighted output is truncated.
- [ ] Distinguish search over current live editors from persisted tab snapshots; update or invalidate stale cross-tab results after document changes.
- [ ] Validate regex replacement captures, zero-width, backslash escapes, multiline and Unicode, including large files and single-step undo where intended.
- [ ] Ensure TextFX affects selection or whole document as documented, preserves unrelated text and cursor/bookmark positions where feasible.
- [ ] Make macro replay transactional or recoverable, use `try/finally` for recording-state restoration, capture failure step and ensure user can undo.
- [ ] Convert error-log Copy/Dismiss from inline handler string generation to listener-driven actions; test quotes and special characters.

**Gate G2:** Exact match coordinates/counts and replacement output for all fixtures, no injected markup from search results, stable bookmarks and undo semantics, and recoverable macro failures.

## 6. Phase 3 — Real diff and split-editor reliability (P04–P05, P09, P13–P14)

**Work**
- [ ] Replace row-index comparison with a genuine line-sequence diff (LCS/Myers or proven compact library) supporting additions, removals, replacements and multiple disjoint hunks.
- [ ] Use one canonical diff model for both visual highlighting and `.diff` export; clearly define primary/reference direction and filename escaping/format.
- [ ] Generate valid unified hunks with accurate old/new ranges, context lines and newline-at-EOF semantics. Check exported patch can reconstruct the expected target, not merely look plausible.
- [ ] If true patch generation isn't supported for a fixture, fail explicitly; never label an unvalidated line-by-line comparison as portable patch.
- [ ] Keep split editor and primary editor state synchronized without overwriting unsaved edits, history, focus, cursor and scroll.
- [ ] Make sync scroll stable for different line counts and extremely long files; cancel stale debounce/marker work when views close or tabs change.
- [ ] Profile large docs, set performance budgets and avoid recalculating entire diff on every cursor movement.

**Gate G3:** Visual diff matches canonical model, generated patches apply correctly to exact baseline fixtures, split edits and scroll survive 50 open/close/switch cycles without lost content or retained listener growth.

## 7. Phase 4 — File I/O, cross-studio protocol and user feedback (P01, P10–P11, P17, P19, P21)

**Work**
- [ ] Test browser picker, drag-and-drop, text input, save/Save As, Blob fallback, denied permissions and cancellation distinctly.
- [ ] Add bounded file sizes, encoding policies and meaningful feedback on invalid binary input; validate filenames and requested extensions.
- [ ] Reuse a versioned Studio Bus payload contract with `notebook_studio` and `markdown_studio` including sender, target, language normalization, ID, schemaVersion, content size, timestamp, dedupe and acknowledgments.
- [ ] Handle queue expiry, storage failures, multiple open receivers and at-most-once UI insertion per message ID. Distinguish queued vs delivered status.
- [ ] Preserve backwards compatibility with existing `gemini_studio_bus` and transfer queue, with explicit migration/test before altering protocol.
- [ ] Inspect peer implementations before assuming Notepad ↔ Markdown ↔ Notebook work across origins; BroadcastChannel/localStorage require compatible origin/partition.
- [ ] Check that a send-selection command captures the latest selected text and code language, and that a send-tab operation does not accidentally send stale or unsaved source.

**Gate G4:** File round trips are byte-correct within documented supported formats; transfer across actual peers delivers one intended document per ID without false acknowledgment; failures are reported accurately.

## 8. Phase 5 — Full controls, UX, accessibility and performance (P13–P21)

**Work**
- [ ] Complete pointer/keyboard control matrix for menus, TextFX, run macro, bookmarks, Find All Tabs, diff, ruler, symbols, Go To, split, sidebar, export, status controls, palette and examples.
- [ ] Validate focus, accessible labels, aria status/live regions, keyboard Escape, tab order, modal focus restoration and screen-reader behaviors.
- [ ] Test responsive widths, zoom, long filenames, themes, scrollbar/gutter containment and side-by-side layouts, recording before/after screenshots.
- [ ] Verify CodeMirror add-ons are pinned and load with meaningful errors when CDN is missing; do not imply full offline support if dependencies require network.
- [ ] Introduce browser E2E tests, static JS check, fixtures, exact-byte file tests, diff patch verification and CI with reproducible environment notes.
- [ ] Review performance with 10k/100k lines, many tabs, hundreds of bookmarks, large search counts, repeated diff toggles and long macros. Document memory retention and responsiveness.

**Gate G5:** Every inventoried control passes, fails with actionable evidence or is explicitly blocked. No severe accessibility/layout regressions; all portable outputs are verified.

## 9. Phase 6 — Final regression, diff, audit and handoff

**Work**
- [ ] Freeze one final candidate and rerun all prior gates and required environments on it.
- [ ] Review full baseline-to-final diff and verify no unrelated reformatting, removed controls, storage-key drift or accidental changes.
- [ ] Generate complete per-finding audit, change/function/line mapping, unified patch, final source, checksums and evidence index. Test patch applicability and reconstruct final source byte-for-byte.
- [ ] Document backward-compatible rollback (keep saved files/workspace), blocked tests, accepted deferrals and remaining nonportable features.
- [ ] Never mark a browser/environment blocked test passed; retain original failure evidence and retest trace.

**Gate G6:** All P0 issues resolved or disproved with evidence, all required gates passed, no unexplained regressions, all P/D records disposed, and artifact links/checksums validated.

## 10. Suite alignment: Markdown Studio and Notebook Studio

| Related plan theme | Notepad Studio equivalent | Coordination |
| --- | --- | --- |
| Markdown G0–G6 gates and immutable baseline | Same evidence/test/patch discipline | Reuse checksums, fixtures, browser matrix and audit structure. |
| Markdown R05/R15 stable source and latest-request rendering | Notepad live-editor snapshots, diff updates, split-pane lifecycle | Commit only results that belong to current tab/version. |
| Markdown R09 memory/listener growth | Notepad diff highlights, search drawers and split scroll handlers | Require repeat-cycle leak tests. |
| Markdown R10–R12 insertion correctness | Notepad TextFX, macros, search/replace | Assert exact bytes and supported selection behavior. |
| Markdown R13/R14 export determinism | Notepad native/fallback save, unified diff and file download | Snapshot before async I/O; verify files and failures. |
| Notebook N04/N05 state integrity | Notepad P01–P03/P09 | Shared save-state concepts, but different editor models. |
| Notebook N10 Studio Bus duplicates | Notepad P10 | Treat protocol changes as one coordinated suite compatibility milestone. |
| Notebook N16 browser testing | Notepad P20 | Reuse browser harness where useful, keep app itself single HTML. |

Do **not** transfer Markdown Studio Mermaid-specific issues or Notebook Studio runtime-execution concerns to a plain-text editor without independent source/runtime evidence.

## 11. Evidence and delivery structure

Suggested repository output (the deliverable HTML remains a single-file app):

```text
notepad_studio_remediation/
  baseline/notepad-studio.original.html
  final/notepad-studio.html
  tests/fixtures/
  tests/e2e/
  reports/notepad_studio_remediation_audit.md
  reports/notepad_studio_code_diff_report.md
  reports/notepad_studio.patch
  evidence/index.md
  evidence/phase-0/ ... phase-6/
  evidence/checksums.sha256
```

Every test record: stable test ID, P/D IDs and gate, source hash and commit, environment/browser/version/origin, exact fixture, steps, expected vs actual, timestamp with zone, pass/fail/blocked/unrun status, evidence paths, retest result and current disposition. Use synthetic data. Before/after screenshots are necessary for visual claims but never substitute for exact source/file assertions.

Final audit requirements: executive result, hashes/dates, complete finding and minor-fix register, validated code changes, control/browser coverage, diff/patch applicability proof, dependency updates or explicit none, remaining risks, environment limits and rollback instructions. Do not invent evidence or tests at planning stage.

## 12. First implementation checkpoint

Start with **Phase 0** and the P0 data-integrity path in **Phase 1**. The first change batch should provide immutable baseline evidence, save/write/version consistency fixes, corrupt-state recovery checks and the G0/G1 audit. Next tackle the P1 true-diff and search-count correctness, coordinating shared Studio Bus changes with Notebook Studio rather than changing Notepad alone.

## 13. Review boundaries

This plan is based on the current `main` source, branch ancestry, PR history and the two suite remediation plans. The review did not execute the application, re-open generated files, run Playwright, test Windows browsers or perform a vulnerability exploit. Priorities are triage, not proof of production incidents. Code remains untouched by this plan commit.
