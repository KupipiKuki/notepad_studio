# Notepad Studio — Phase 0 baseline and browser reproduction review

Updated November 18, 2026 (America/New_York), following addition of the local checkout and Playwright environment. **Read-only review completed; G0 evidence is ready for review. No independent gate sign-off, remediation acceptance, or implementation is claimed.** All 21 plan findings have evidence or explicit unverified subcases. Newly reproduced observations are recorded separately.

This revision supersedes the earlier environment-blocked report. The Node runtime can access the installed browsers, network dependencies and loopback HTTP. The earlier shell-runtime failures were environmental limitations, not evidence that the installed browsers were missing from the machine. No app code, Git refs, dependencies, or user documents were changed by this review.

## 1. Baseline and checkout verification

The plan was read first on `vibe/remediation-plan`. Tests then used the current, unmodified Notepad source. Both pre-test and post-test Git status show the same branch and user-supplied untracked Playwright setup; no tracked file changes.

| Item | Verified identity |
| --- | --- |
| Checkout | `C:\Git\notepad_studio` |
| Branch / HEAD | `main` / `2437b1ceee9a5b5d32755440e74c504b2211fee2` |
| Plan branch / commit | `vibe/remediation-plan` / `6e25cdcbb0245cd04f476e0bdf97fbf9f35e826f` |
| Plan blob | `1681a295c5f77e5e677c5a441c4dca59f2c8edb6` |
| Application | `scripts/notepad-studio.html` |
| Exact Git blob | `d29dfa5785ba62e89ced8386dd022dbec5b42890` |
| Canonical Git byte count / SHA-256 | 137,785 / `962e4a66da5c95965a0101a2cf5ce17dcc72241e51a648c2849609eca4c6cc89` |
| Windows checkout byte count / SHA-256 | 141,723 / `f68350a90c31042fff7fd4050307f75dcdc0fe2036f5288a9912a7c9bc187213` |
| Line-ending reconciliation | Working file has CRLF; normalizing CRLF to LF produces the exact expected Git blob. Both forms remained unchanged. |
| Existing untracked setup, preserved | `.github/`, `.gitignore`, `package-lock.json`, `package.json`, `playwright.config.js`, `tests/` |

The planning workspace remains separate from the checkout. Evidence, downloaded synthetic outputs and review scripts were written only under its `phase0-scratch` directory. A canonical byte-verified source copy from the initial review remains there. Actual browser runs used the checkout file for file URLs and its unchanged bytes served on an isolated temporary loopback origin for HTTP. Temporary servers and review browsers were closed at completion.

Pinned application: https://github.com/KupipiKuki/notepad_studio/blob/2437b1ceee9a5b5d32755440e74c504b2211fee2/scripts/notepad-studio.html

Pinned plan: https://github.com/KupipiKuki/notepad_studio/blob/6e25cdcbb0245cd04f476e0bdf97fbf9f35e826f/notepad_studio_remediation_plan.md

## 2. Actual browser coverage and methods

Windows, Playwright 1.65.1. Fresh isolated contexts with synthetic documents were used. No personal profile or saved user workspace was accessed or cleared. CDN dependencies were fetched normally; no substitute editor, DOM mock, or patched application was used in the browser run.

| Browser | Version | File launch | HTTP launch | Search regression subset on both origins |
| --- | --- | --- | --- | --- |
| Chromium | 159.0.8154.6 | 2 editors; no page/request errors | 2 editors; no page/request errors | Executed |
| Chrome | 157.0.8103.80 | 2 editors; no page/request errors | 2 editors; no page/request errors | Executed |
| Edge | 157.0.4341.60 | 2 editors; no page/request errors | 2 editors; no page/request errors | Executed |
| Firefox | 159.0 | 2 editors; no page/request errors | 2 editors; no page/request errors | Executed |

The detailed save, recovery, split, diff, encoding, macro, bookmark, quota and peer scenarios ran in **Chromium on HTTP**. The eight-origin/browser search subset covered occurrence counts, repeated/cleared results, whole-word replacement, zero-width counts/replacement and regex captures. The six Chromium/Chrome/Edge print cases covered both origins. These are not full functional passes for every browser/origin combination.

Evidence methods:

- **Integrated browser:** actual CodeMirror instance, actual application state and handlers. Editor fixture values were set through CodeMirror's API; application controls were activated through their real DOM handlers. Selected keyboard, pointer tab-switch and modal flows were exercised. This is not a complete pointer/accessibility matrix.
- **Controlled browser boundary:** native picker/write promises, suppressed downloads and transfer failures were injected at API boundaries while running the real app. These prove state logic; they do not validate the native Windows picker UI or permission grants.
- **Actual portable output:** Playwright downloads were saved and inspected as bytes; a downloaded `.diff` was checked with real `git apply --check`. Browser-generated PDFs were independently read with PyMuPDF.
- **Source-only / still unverified:** explicitly called out in the findings register. Initial extracted-function evidence remains corroboration; it is not counted as browser acceptance.

An initial harness attempt incorrectly waited for the hidden secondary editor to become visible; it was corrected to wait for attachment. A later replacement test attempted to fill a hidden Replace field; the corrected cross-browser run opened Replace with Ctrl+H. These test-harness errors are not app findings. Their original records remain in the local evidence trail; the successful supplemental executions supersede those attempts.

## 3. Findings register

All source lines refer to the pinned Notepad baseline. “Not reproduced” applies only to the tested scenario and does not close all related risks.

| ID | Current disposition | Evidence and remaining limits |
| --- | --- | --- |
| P01 | Reproduced with integrated browser fault injection | Suppress anchor activation, edit, click Save: stored `dirty=false`, indicator `Saved`, toast `Saved & downloaded a.txt (CRLF)` despite no download. Picker `AbortError` subcase **did not reproduce loss**: content stayed dirty and zero downloads occurred. Real native permission/OS cancellation UI remains unverified. L3243. |
| P02 | Reproduced; additional wrong-tab variant | Delay native close, edit again, finish write: written/saved snapshot is old, live text is new, yet dirty=false and indicator Saved. Separately, switch tabs while Save As picker is pending: second tab's text is written; the original tab is renamed and receives the second text as `savedContent` while its own content remains different and dirty=false. API boundaries were controlled; native OS file writes unverified. L3637. |
| P03 | Reproduced in actual recovery/autosave flow | Malformed raw JSON survives initial load, but starter tabs appear without recovery UI; the first synthetic edit/autosave replaces the corrupt payload. A genuine browser quota failure produced a storage warning/log, retained 500,017 live characters, and left the older 20-character stored document. Quota error reporting works; no recovery action was found. L3052/L3081. |
| P04 | Reproduced with an actual downloaded diff | Primary `a\nb\nc\n`, reference `a\nX\nb\nc\n`; both tabs named fixture.txt to avoid filename ambiguity. Exact downloaded output fails `git apply --check` on exact primary bytes. Row-index output and trailing empty split line are recorded. Initial function test also failed for missing newline at EOF. Do not infer every possible diff fails. L3198. |
| P05 | Reproduced in real CodeMirror | One inserted X shifts b/c; both shifted rows are marked modified and final secondary c removed. Correct sequence edit is one insertion. Real line marker classes and a local screenshot retained. L2914. |
| P06 | Reproduced in all 8 browser/origin cases | `needle needle needle`: single-document count is 3; Find All Tabs badge is 1 and one result coordinate is returned. L2777. |
| P07 | Reproduced in the integrated search drawer | Searching `&` in `&` shows `&amp;`; `<`/`>` receive no hit highlight; entity-fragment search distorts the snippet. Synthetic `<img ...>` remained text and did not execute in the tested case. No general injection/security clearance is claimed. Separate stale-row finding B01 below. L2820. |
| P08 | Reproduced in all 8 cases; capture replacement passed | Whole-word enabled, regex disabled, selected needle: Replace leaves text unchanged. Regex `(?=a)` on aaa reports 1 match, while Replace All produces XaXaXa and reports 3. `(ab)(\d+)` with `$2-$1` correctly produces `12-ab 34-ab`. Multiline/selection/large-count/undo/overlap combinations remain unverified. L2464/L2550/L2581. |
| P09 | Loss NOT reproduced in tested split lifecycle | Edit inactive b in secondary pane, switch to b then back to a, wait for autosave and reload: b retains `SECONDARY EDIT` with dirty=true; a remains unchanged. Same-tab split/save/close and broader lifecycle combinations remain unverified. L1839/L2127. |
| P10 | Duplicate replay reproduced; current Markdown round trip passed | Post the same BroadcastChannel ID twice: receiver creates two replay.txt tabs. No durable dedupe. Actual Notepad→two Markdown receiver pages delivers latest selected text once to each; Markdown→Notepad returns latest edited text; queue ends empty. Specific queue-plus-focus timing races, Notebook peer and file-origin peer compatibility remain unverified. L3714/L3732. |
| P11 | Reproduced with actual fallback download bytes | CRLF selected, editor text alpha LF beta. Controlled native write receives `616c7068610a62657461`; actual saved download is `616c7068610d0a62657461`, no download error. Mixed-ending and real native OS round trips remain unverified. L3243/L3637. |
| P12 | Proposed invalid-input recording-state failure NOT reproduced | Real invalid JSON, malformed URI and invalid Base64 actions log their errors. Replay completes and restores recording=true; content remains invalid input, though toast optimistically says Played macro (3 steps). Lack of try/finally remains source-observed; unexpected uncaught exceptions, partial transformations and undo rollback remain uncertain. L2307/L2384/L2398/L2420. |
| P13 | Ordinary tab undo/bookmark isolation passed | Edit a0→a1; switch b, edit b0→b1, undo gives b0; return to a retains a1 and bookmark; undo gives a0. Split-edited histories, shifted/deleted bookmark lines and repeated reload cases remain unverified. L1940. |
| P14 | Full traversal measured; no leak verdict | Real comparison toggle to next frame: 10k lines 146 ms; 100k lines 1,145 ms in one Chromium HTTP run. Single-run wall-clock observation, no established budget or statistical benchmark. Repeated-cycle memory/listener retention and stale-run behavior remain uncertain. L2904/L2914. |
| P15 | Multiline Copy failure reproduced; handlers exist | Real global error log receives line1/newline/line2. Inline Copy click raises `Invalid or unexpected token` and never calls the copy spy. Both global Copy and Dismiss functions exist; Dismiss removes the target row (a newly logged click error remains). Full clipboard-permission and quote/backslash coverage unverified. L1706/L1711/L1734. |
| P16 | Malformed model causes actual bootstrap error | Duplicate IDs with numeric content and invalid mode/bookmark load without schema rejection. CodeMirror initialization path throws `e.split is not a function`. Raw malformed storage remains in the tested case. Legacy schemas/oversize models remain unverified. L3081. |
| P17 | Exact byte fidelity problems reproduced | UTF-8 BOM removed on read; non-ASCII text survives but LF becomes selected CRLF on save. Latin-1 byte E9 decodes as U+FFFD and re-exports EF BF BD; binary FF/FE/80 similarly replaced. No unsupported-encoding/binary warning observed. Large-file input limits and native open path remain unverified. L3272/L3610. |
| P18 | Selected controls/keyboard flows passed; full matrix open | Palette contains 20 entries; filter/Enter opens Go To; line 2 goes to zero-based line 1. Ctrl+F opens Find; Escape closes it. Preference controls/reload tested separately. Full platform modifier/focus/accessibility/shortcut-collision coverage unverified. |
| P19 | Controlled offline failure reproduced; online launch passed | With fresh offline context, file launch yields zero editors and `CodeMirror is not defined`. Online all 8 launch cases work with pinned CDN dependencies. App is not self-contained offline. Bootstrap fails before setupEvents installs its global error interceptors. |
| P20 | Pinned-tree finding confirmed; local setup now present | Immutable main tree has only LICENSE, README and application source. User-added untracked Playwright setup now exists and was reused. Nothing was committed or added to the repository by this review. |
| P21 | False send-success reproduced in real app with API faults | Force both storage setItem and BroadcastChannel post to throw; Send To still says Sent a.txt to MARKDOWN Studio, without surfacing an error. Ordinary peer delivery passes as P10; unsupported/clipboard/native OS paths remain partly unverified. |

## 4. Additional independently reproduced observations

| ID | Observation | Evidence / scope |
| --- | --- | --- |
| B01 | Search-result rows remain stale after repeat and Clear | In every browser/origin case, one search creates 1 row, repeat creates 2 while badge stays 1; Clear changes badge to 0 but leaves 2 clickable rows. `renderSearchResults` removes groups but not old result rows. This is independent evidence for freshness concerns, not a transplanted Markdown issue. |
| B02 | Long-document browser PDF output truncates content | Synthetic 240-line document, each line uniquely marked. Chromium/Chrome/Edge, file and HTTP: all 6 generated PDFs have one page and only markers 001–037; 038–240 absent. Print DOM viewport is 0–37, body overflow hidden, editor height ~585 px versus 5,029 px content. PDFs independently read with PyMuPDF. Browser PDF pipeline verified; native Windows printer dialogs, real printer output and Firefox paginated output unverified. |

These are baseline observations for the remediation scope review, not assigned fixes. No D-number implementation record was created.

## 5. Persistence, exports, transfer and Markdown verification ideas

Normal synthetic persistence round trip passed for content, dirty state, wrap=true, tab size=4, EOL=LF, symbols=true, ruler=80 and light theme. The unchanged baseline reopened them. Corrupt-state and quota scenarios have the distinct outcomes in P03; ordinary reload success does not resolve those defects.

Portable outputs were assessed as real text/download bytes, applicable diff files and long-document PDF content. No Mermaid, SVG, PNG or HTML export requirement was imported into this plain-text editor. There is no identified app-specific Print control/function/CSS; the browser print route exists and its truncation was independently reproduced.

The actual Markdown peer was the local unmodified application at HEAD `92b635c2aa6499687e573b5f67ba7809d3d10007`, source Git blob `567402aac4d087dd1695309fd2a561c8d033de9d`. This is the reviewed migration candidate source identified in the Markdown final handoff. It was served on the same temporary HTTP origin as Notepad, without patching either app. Both Markdown receiver pages received exactly `LATEST SELECTION`; a fresh Markdown edit returned `LATEST MARKDOWN TO NOTEPAD`. This validates those specific latest-text routes, not replay safety, all message schemas or cross-origin compatibility.

Notebook Studio was not available as a local peer in this run. No Notebook compatibility verdict is made. No Markdown patches or code changes were ported.

## 6. Controls and flow inventory

Complete static control list, select options, palette definitions and primary shortcut map are appended. The 78 static button/input/select/action elements are supplemented by generated controls and clickable status areas.

| Area | Inventoried behavior | Actual coverage |
| --- | --- | --- |
| Files | New/Open/Examples/Save/Save As; multi-file hidden input, native handles, download fallback, drag/drop | New/save/Save As/file input/actual downloads checked; OS picker UI and drag/drop pointer flow unverified |
| Tabs/explorer | Select, close, dirty-close confirmation, rename, new tab, explorer, outline, stats | Selection/switch/new/persistence checked; full close/rename/outline matrix unverified |
| TextFX/macros | 15 transformations, JSON/Dedupe shortcuts, selection/document scope, record/play | Invalid JSON/URL/Base64 replay checked; all transform exact outputs/undo unverified |
| Search | Case/whole-word/extended/regex; next/previous, replace/all, count; all tabs/results, Mark Lines, clear/close | Detailed search subset across 8 cases; broader regex/multiline/limits open |
| Bookmarks | Gutter click, toggle, next/previous, mark matches, copy/delete/clear | Gutter signal and ordinary tab restoration checked; clipboard/deletion/shifts open |
| Split/diff | Split toggle/reference select; editable secondary; comparison; export diff; synchronized scroll | Edit/switch/reload/diff classes/actual export checked; scroll and 50-cycle retention open |
| View/status | Theme, wrap, whitespace/EOL marks, ruler off/80/120, zoom 70–200%, sidebar, EOL LF/CRLF, indent 2/4/8, language | Preference subset persisted/reopened; responsive layouts/zoom/gutters open |
| Dialogs/palette/errors | Go To Line, validation, Enter/Escape; 20 palette commands/filter/arrows/Enter/Escape; error Copy/Dismiss/Clear; search drawers | Selected keyboard/modal flow and multiline Copy/Dismiss checked; complete pointer/focus/accessibility open |
| Persistence | npp_studio_state_v1, npp_theme; transfer queue gemini_studio_transfer_queue_v1; channel gemini_studio_bus | Normal reload, corruption, malformed model, real quota, HTTP peer/replay checked |
| Outputs/print | Native/download text, unified diff, browser-native print | Actual downloads/Git applicability/PDF text checked; native OS writes/printer UI/Firefox pagination open |

CodeMirror core/addons/modes/keymap are pinned to 5.65.16, with 25 script and 3 CSS CDN loads; Google Fonts also requires network. Distribution remains one HTML app file. No source dependency changes were made.

## 7. G0 review decision and remaining uncertainty

**Baseline identity, control inventory, supported launch matrix and per-finding evidence/dispositions are now established. G0 is ready for review under the plan's evidence-or-explicit-unverified standard.** This is not a claim that all findings are closed or that every browser/control passes. There are confirmed P0 data-integrity defects. Implementation has not started.

Remaining explicit unverified work includes native Windows picker/write/permission behavior; several same-tab split/history/bookmark/save/close variants; full regex/undo/large-count coverage; Notebook and file-origin peer transfers; queue/focus race timing; 50-cycle memory/scroll retention; formal performance budgets; full pointer/accessibility/responsive coverage; Firefox/native Windows paginated printing; native open encoding/large-file limits. These remain open in their finding/phase records and must not be presented as passes.

Phase 0 reproduction failures should inform the Phase 1 scope, especially false-clean save state, wrong-tab Save As snapshots and corrupt-state recovery. B01/B02 require scope disposition. This report makes no implementation approval request and no architectural AG0/MG gate decision.

## 8. Evidence index and reproduction notes

All local paths below are relative to `phase0-scratch/`:

| Artifact | Purpose |
| --- | --- |
| browser-run/browser-evidence.json | Initial harness attempt; hidden-secondary wait error, superseded |
| browser-run2/browser-evidence.json | Eight launch cases and detailed Chromium HTTP scenarios; one hidden Replace-field harness error superseded by supplement |
| browser-run2/supplement-evidence.json | Eight cross-browser/origin search runs; actual two-receiver Markdown round trip; print DOM/PDF capture |
| browser-run2/final-evidence.json | Actual downloaded patch/Git check, picker cancellation, preference reload, genuine quota failure, final checkout/source identity |
| browser-run2/print-inspection.json | Independent PDF extraction of first print sample |
| browser-run2/print-matrix.json | Six independent Chromium/Chrome/Edge PDF marker checks |
| browser-run2/actual-patch-check/actual.diff | Unmodified UI download, checked by Git against fixture.txt |
| browser-run2/fallback-CRLF.txt, utf8.txt, latin1.txt, binary.txt | Actual browser-downloaded bytes |
| browser-run2/shifted-diff.png and print-*.pdf | Local visual/output evidence; excluded from this text artifact |
| browser-review.cjs, browser-supplement.cjs, browser-final-checks.cjs | Browser reproduction harnesses, appended below |

The raw evidence and harnesses are embedded below so this report is reviewable without relying on a transient test log. Timestamps in evidence are UTC. Harnesses use fresh contexts and temporary origins; only synthetic scratch files are written. No screenshot is included in the saved report. The evidence includes known harness errors and their successful replacements rather than silently classifying them as app failures or deleting the attempts.


## Appendix A — Static control inventory

| # | Tag / ID or action | Label / title | Options |
| --- | --- | --- | --- |
| 1 | INPUT fileInput |  |  |
| 2 | BUTTON btnNewFile | New Document (Ctrl+N) |  |
| 3 | BUTTON btnOpenFile | Open File(s) (Ctrl+O) |  |
| 4 | BUTTON btnLoadExamples | Load Starter Demo Files (welcome.txt, demo.js, package.json) |  |
| 5 | BUTTON btnSaveFile | Save Active File (Ctrl+S) |  |
| 6 | BUTTON btnSaveAs | Save As... (Ctrl+Shift+S) |  |
| 7 | BUTTON btnToggleSplit | Toggle Side-by-Side Reference Split View |  |
| 8 | BUTTON btnToggleFind | Find & Replace (Ctrl+F / Ctrl+H) |  |
| 9 | BUTTON btnToggleSidebar | Toggle Sidebar (Ctrl+B) |  |
| 10 | BUTTON btnCommandPalette | Command Palette (F1 / Ctrl+Shift+K) |  |
| 11 | BUTTON btnThemeToggle | Toggle Light / Dark Theme |  |
| 12 | BUTTON btnUndo | Undo (Ctrl+Z) |  |
| 13 | BUTTON btnRedo | Redo (Ctrl+Y) |  |
| 14 | BUTTON btnTextFxMenu | ✨ TextFX Tools ▾ |  |
| 15 | DIV sort-asc | Sort Lines (A → Z) |  |
| 16 | DIV sort-desc | Sort Lines (Z → A) |  |
| 17 | DIV remove-duplicates | Remove Duplicate Lines |  |
| 18 | DIV trim-whitespace | Trim Leading/Trailing Space |  |
| 19 | DIV remove-blank-lines | Remove Empty Lines |  |
| 20 | DIV to-upper | UPPERCASECtrl+U |  |
| 21 | DIV to-lower | lowercaseCtrl+L |  |
| 22 | DIV to-title | Title Case |  |
| 23 | DIV to-camel | camelCase |  |
| 24 | DIV format-json | Beautify JSON |  |
| 25 | DIV minify-json | Minify JSON |  |
| 26 | DIV base64-encode | Base64 Encode (UTF-8) |  |
| 27 | DIV base64-decode | Base64 Decode (UTF-8) |  |
| 28 | DIV url-encode | URL Encode |  |
| 29 | DIV url-decode | URL Decode |  |
| 30 | BUTTON btnFormatJsonFast | Quick Format JSON |  |
| 31 | BUTTON btnRemoveDuplicatesFast | Quick Remove Duplicate Lines |  |
| 32 | BUTTON btnMacroRecord | Start / Stop Recording TextFX Macro |  |
| 33 | BUTTON btnMacroPlay | Play Recorded Macro (Ctrl+Shift+P) |  |
| 34 | BUTTON btnSendToMenu | Send the active tab (or selection) to another Studio |  |
| 35 | BUTTON btnBookmarksMenu | 🔖 Bookmarks ▾ |  |
| 36 | DIV toggle-bookmark | Toggle Bookmark (Ctrl+F2) |  |
| 37 | DIV next-bookmark | Next Bookmark (F2) |  |
| 38 | DIV prev-bookmark | Previous Bookmark (Shift+F2) |  |
| 39 | DIV bookmark-matches | Bookmark All Search Matches |  |
| 40 | DIV copy-bookmarked | Copy Bookmarked Lines |  |
| 41 | DIV delete-bookmarked | Delete Bookmarked Lines |  |
| 42 | DIV clear-bookmarks | Clear All Bookmarks |  |
| 43 | BUTTON btnShowSymbols | Show Whitespace / EOL Symbols |  |
| 44 | BUTTON btnColumnRuler | Toggle 80/120 Column Ruler |  |
| 45 | BUTTON btnToggleWrap | Toggle Word Wrap (Alt+Z) |  |
| 46 | BUTTON btnGotoLine | Go to Line (Ctrl+G) |  |
| 47 | BUTTON btnComment | Toggle Comment (Ctrl+/) |  |
| 48 | BUTTON btnZoomOut | Zoom Out |  |
| 49 | BUTTON btnZoomIn | Zoom In |  |
| 50 | BUTTON btnAddTab | New Document |  |
| 51 | BUTTON btnCloseSidebar | ✕ |  |
| 52 | INPUT frFindInput |  |  |
| 53 | BUTTON frCaseBtn | Match Case |  |
| 54 | BUTTON frWordBtn | Match Whole Word |  |
| 55 | BUTTON frExtBtn | Extended Mode (\n, \r, \t) |  |
| 56 | BUTTON frRegexBtn | Regular Expression |  |
| 57 | BUTTON frFindPrev | Find Previous (Shift+Enter) |  |
| 58 | BUTTON frFindNext | Find Next (Enter) |  |
| 59 | BUTTON frClose | Close (Esc) |  |
| 60 | INPUT frReplaceInput |  |  |
| 61 | BUTTON frReplace | Replace |  |
| 62 | BUTTON frReplaceAll | All |  |
| 63 | BUTTON frFindAllTabs | Search across all open documents |  |
| 64 | BUTTON frBookmarkMatches | Bookmark every line matching the current query |  |
| 65 | SELECT splitTabSelect |  |  |
| 66 | BUTTON btnCompareDiff | Toggle Live Diff Comparison |  |
| 67 | BUTTON btnExportDiff | Export Unified Diff (.diff) between Primary and Reference tabs |  |
| 68 | INPUT btnSyncSplitScroll |  |  |
| 69 | BUTTON btnCloseSplit | Close Split View |  |
| 70 | INPUT gotoLineInput |  |  |
| 71 | BUTTON btnCancelGoto | Cancel |  |
| 72 | BUTTON btnConfirmGoto | Go |  |
| 73 | BUTTON btnClearErrorLog | Clear all logged errors |  |
| 74 | BUTTON btnCloseErrorLog | Close Error Log (Esc) |  |
| 75 | BUTTON btnClearSearchResults | Clear all search results |  |
| 76 | BUTTON btnCloseSearchResults | Close Search Results |  |
| 77 | SELECT languageSelect | Select Syntax Language | text: Plain Text; javascript: JavaScript / TS; json: JSON; python: Python; htmlmixed: HTML; xml: XML; css: CSS; markdown: Markdown; yaml: YAML; sql: SQL; text/x-csrc: C / C++; shell: Shell / Bash |
| 78 | INPUT cmdPaletteInput |  |  |

Additional generated/non-button controls: Send To items `data-sendto=markdown/notebook`; tab select/close/double-click rename; explorer file rows; outline entries; bookmark gutter; clickable `statusPos`, `statusLineEndings`, `statusTabSize`, `statusSearchIndicator`, `statusErrorIndicator`; generated search result rows; error Copy/Dismiss; palette command rows; split scroll events. These supplement the 78 static elements above.

### Command palette source

```javascript
  const COMMANDS = [
    { title: 'New File', category: 'File', shortcut: 'Ctrl+N', action: function() { createNewTab(); } },
    { title: 'Open File', category: 'File', shortcut: 'Ctrl+O', action: function() { openFileNativeOrFallback(); } },
    { title: 'Save File', category: 'File', shortcut: 'Ctrl+S', action: function() { saveFileNativeOrFallback(false); } },
    { title: 'Save File As...', category: 'File', shortcut: 'Ctrl+Shift+S', action: function() { saveFileNativeOrFallback(true); } },
    { title: 'Toggle Split View', category: 'View', action: function() { document.getElementById('btnToggleSplit').click(); } },
    { title: 'Compare Diff', category: 'View', action: function() { toggleCompareDiff(); } },
    { title: 'Export Unified Diff (.diff)', category: 'View', action: function() { exportDiffFile(); } },
    { title: 'Load Starter Example Files', category: 'File', action: function() { loadStarterExamples(); } },
    { title: 'Find in All Tabs', category: 'Search', action: function() { openFindDialog(false); document.getElementById('frFindAllTabs').click(); } },
    { title: 'Toggle Bookmark', category: 'Bookmarks', shortcut: 'Ctrl+F2', action: function() { toggleBookmark(editor.getCursor().line); } },
    { title: 'Delete Bookmarked Lines', category: 'Bookmarks', action: function() { deleteBookmarkedLines(); } },
    { title: 'Format JSON', category: 'TextFX', action: function() { runTextFxAction('format-json'); } },
    { title: 'Remove Duplicate Lines', category: 'TextFX', action: function() { runTextFxAction('remove-duplicates'); } },
    { title: 'Toggle Whitespace Symbols', category: 'View', action: function() { toggleShowSymbols(); } },
    { title: 'Play Macro', category: 'Macro', shortcut: 'Ctrl+Shift+P', action: function() { playMacro(); } },
    { title: 'Send to Markdown Studio', category: 'Transfer', action: function() { sendSelectionOrTab('markdown'); } },
    { title: 'Send to Notebook Studio', category: 'Transfer', action: function() { sendSelectionOrTab('notebook'); } },
    { title: 'Toggle Light/Dark Theme', category: 'View', action: function() { document.getElementById('btnThemeToggle').click(); } },
    { title: 'Go to Line', category: 'Search', shortcut: 'Ctrl+G', action: function() { openGotoLineModal(); } },
    { title: 'Toggle Word Wrap', category: 'View', shortcut: 'Alt+Z', action: function() { toggleWordWrap(); } }
  ];


```

### Primary CodeMirror keymap

```javascript
      extraKeys: {
        'Ctrl-S': function() { saveFileNativeOrFallback(false); },
        'Ctrl-O': function() { openFileNativeOrFallback(); },
        'Ctrl-N': function() { createNewTab(); },
        'Ctrl-W': function() { closeTab(activeTabId); },
        'Ctrl-F': function() { openFindDialog(false); },
        'Ctrl-H': function() { openFindDialog(true); },
        'Ctrl-G': function() { openGotoLineModal(); },
        'Alt-Z': function() { toggleWordWrap(); },
        'Ctrl-/': function(cm) { cm.toggleComment(); },
        'Ctrl-U': function() { runTextFxAction('to-upper'); },
        'Ctrl-L': function() { runTextFxAction('to-lower'); },
        'Ctrl-Shift-P': function() { playMacro(); },
        'Ctrl-F2': function() { toggleBookmark(editor.getCursor().line); },
        'F2': function() { jumpToNextBookmark(false); },
        'Shift-F2': function() { jumpToNextBookmark(true); }
      }
    });


```

Additional shortcuts: window Ctrl/Meta+B sidebar; Save As advertises Ctrl+Shift+S but no explicit application handler was found (Sublime/browser behavior unverified); F1 or Ctrl/Meta+Shift+K palette; Escape for modal/drawers; Find input Enter/Shift+Enter/Escape; Replace input Enter/Escape; Go To Enter/Escape; palette arrows/Enter/Escape. CodeMirror keyMap is Sublime; upstream keymap supplies further editor commands whose actual browser conflicts remain untested.


## Raw evidence — browser-evidence.json

```json
[
  {
    "id": "launch-chromium-file",
    "at": "2026-11-19T02:45:34.113Z",
    "actual": {
      "version": "159.0.8154.6",
      "origin": "file",
      "url": "file:///C:/Git/notepad_studio/scripts/notepad-studio.html",
      "editors": 2,
      "errors": [],
      "failed": []
    }
  },
  {
    "id": "launch-chromium-http",
    "at": "2026-11-19T02:45:34.574Z",
    "actual": {
      "version": "159.0.8154.6",
      "origin": "http",
      "url": "http://127.0.0.1:54042",
      "editors": 2,
      "errors": [],
      "failed": []
    }
  },
  {
    "id": "launch-chrome-file",
    "at": "2026-11-19T02:45:35.654Z",
    "actual": {
      "version": "157.0.8103.80",
      "origin": "file",
      "url": "file:///C:/Git/notepad_studio/scripts/notepad-studio.html",
      "editors": 2,
      "errors": [],
      "failed": []
    }
  },
  {
    "id": "launch-chrome-http",
    "at": "2026-11-19T02:45:36.257Z",
    "actual": {
      "version": "157.0.8103.80",
      "origin": "http",
      "url": "http://127.0.0.1:54042",
      "editors": 2,
      "errors": [],
      "failed": []
    }
  },
  {
    "id": "launch-msedge-file",
    "at": "2026-11-19T02:45:37.492Z",
    "actual": {
      "version": "157.0.4341.60",
      "origin": "file",
      "url": "file:///C:/Git/notepad_studio/scripts/notepad-studio.html",
      "editors": 2,
      "errors": [],
      "failed": []
    }
  },
  {
    "id": "launch-msedge-http",
    "at": "2026-11-19T02:45:38.141Z",
    "actual": {
      "version": "157.0.4341.60",
      "origin": "http",
      "url": "http://127.0.0.1:54042",
      "editors": 2,
      "errors": [],
      "failed": []
    }
  },
  {
    "id": "launch-firefox-file",
    "at": "2026-11-19T02:45:40.247Z",
    "actual": {
      "version": "159.0",
      "origin": "file",
      "url": "file:///C:/Git/notepad_studio/scripts/notepad-studio.html",
      "editors": 2,
      "errors": [],
      "failed": []
    }
  },
  {
    "id": "launch-firefox-http",
    "at": "2026-11-19T02:45:40.927Z",
    "actual": {
      "version": "159.0",
      "origin": "http",
      "url": "http://127.0.0.1:54042",
      "editors": 2,
      "errors": [],
      "failed": []
    }
  },
  {
    "id": "P01-observed",
    "at": "2026-11-19T02:45:42.195Z",
    "actual": {
      "state": {
        "activeTabId": "a",
        "wordWrap": false,
        "tabSize": 2,
        "lineEnding": "CRLF",
        "macroActions": [],
        "tabs": [
          {
            "id": "a",
            "name": "a.txt",
            "content": "changed but no file",
            "savedContent": "changed but no file",
            "mode": "text",
            "dirty": false,
            "bookmarks": []
          },
          {
            "id": "b",
            "name": "b.txt",
            "content": "reference",
            "savedContent": "reference",
            "mode": "text",
            "dirty": false,
            "bookmarks": []
          }
        ],
        "showSymbolsActive": false,
        "rulerMode": 0
      },
      "indicator": "Saved",
      "toast": "Saved & downloaded a.txt (CRLF)",
      "suppressed": true
    }
  },
  {
    "id": "P01-download-suppressed",
    "at": "2026-11-19T02:45:42.196Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P02-observed",
    "at": "2026-11-19T02:45:42.776Z",
    "actual": {
      "written": "snapshot before write",
      "current": "EDIT DURING CLOSE",
      "state": {
        "activeTabId": "a",
        "wordWrap": false,
        "tabSize": 2,
        "lineEnding": "CRLF",
        "macroActions": [],
        "tabs": [
          {
            "id": "a",
            "name": "fixture.txt",
            "content": "EDIT DURING CLOSE",
            "savedContent": "snapshot before write",
            "mode": "text",
            "dirty": false,
            "bookmarks": []
          },
          {
            "id": "b",
            "name": "b.txt",
            "content": "reference",
            "savedContent": "reference",
            "mode": "text",
            "dirty": false,
            "bookmarks": []
          }
        ],
        "showSymbolsActive": false,
        "rulerMode": 0
      },
      "indicator": "Saved"
    }
  },
  {
    "id": "P02-delayed-native-close",
    "at": "2026-11-19T02:45:42.777Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P02-picker-observed",
    "at": "2026-11-19T02:45:43.484Z",
    "actual": {
      "written": "SECOND TAB CONTENT",
      "current": "SECOND TAB CONTENT",
      "state": {
        "activeTabId": "doc_w69a9gm",
        "wordWrap": false,
        "tabSize": 2,
        "lineEnding": "CRLF",
        "macroActions": [],
        "tabs": [
          {
            "id": "a",
            "name": "picked.txt",
            "content": "ORIGINAL TAB CONTENT",
            "savedContent": "SECOND TAB CONTENT",
            "mode": "text",
            "dirty": false,
            "bookmarks": []
          },
          {
            "id": "b",
            "name": "b.txt",
            "content": "reference",
            "savedContent": "reference",
            "mode": "text",
            "dirty": false,
            "bookmarks": []
          },
          {
            "id": "doc_w69a9gm",
            "name": "untitled3.txt",
            "content": "SECOND TAB CONTENT",
            "savedContent": "",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          }
        ],
        "showSymbolsActive": false,
        "rulerMode": 0
      }
    }
  },
  {
    "id": "P02-picker-tab-switch",
    "at": "2026-11-19T02:45:43.485Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P03-browser",
    "at": "2026-11-19T02:45:45.024Z",
    "actual": {
      "initial": "{broken recoverable workspace",
      "after": "{\"activeTabId\":\"doc_2f7fl92\",\"wordWrap\":false,\"tabSize\":2,\"lineEnding\":\"CRLF\",\"macroActions\":[],\"tabs\":[{\"id\":\"doc_2f7fl92\",\"name\":\"welcome.txt\",\"content\":\"synthetic edit after recovery\",\"savedContent\":\"==========================================================================\\nWelcome to Notepad++ Studio IDE 🚀\\nA fast, modern, polyglot code editor for web developers & power users.\\n==========================================================================\\n\\n✨ KEY FEATURES:\\n- 📑 Multi-Tab Document Workspace: Click '+' or press Ctrl+N\\n- 🪟 Dual-Pane Split View: Compare or reference any two tabs side-by-side\\n- 🔴 Macro Recorder: Record & replay multi-step TextFX pipelines (Ctrl+Shift+P)\\n- ⚡ Sublime Text Keybindings: Multi-cursor (Ctrl+D), duplicate lines, etc.\\n- 🎨 Syntax Highlighting: JS, JSON, Python, HTML, XML, CSS, SQL, Markdown, C/C++\\n- 🔍 Advanced Find & Replace: Case, Whole Word, Extended (\\\\n, \\\\t), Regex\\n- 🧹 Classic Notepad++ TextFX Tools: Deduplicate lines, sort, UTF-8 Base64\\n\\nSHORTCUT CHEATSHEET:\\n- Ctrl+S         Save active document (with CRLF/LF normalization)\\n- Ctrl+N         New document\\n- Ctrl+O         Open file(s)\\n- Ctrl+W         Close active tab\\n- Ctrl+F / H     Find & Replace\\n- Ctrl+G         Go to Line\\n- Ctrl+/         Toggle Comment\\n- Alt+Z          Toggle Word Wrap\\n- Ctrl+B         Toggle Sidebar Explorer\\n\",\"mode\":\"text\",\"dirty\":true,\"bookmarks\":[]},{\"id\":\"doc_k405myo\",\"name\":\"demo.js\",\"content\":\"// JavaScript Demonstration with Symbol Outline\\nclass DataPipeline {\\n  constructor(name) {\\n    this.name = name;\\n    this.buffer = [];\\n  }\\n\\n  async processQueue(items) {\\n    console.log(\\\"Processing batch of \\\" + items.length + \\\" items\\\");\\n    return items.map(x => ({ id: x.id, timestamp: Date.now() }));\\n  }\\n\\n  clear() {\\n    this.buffer = [];\\n  }\\n}\\n\\nfunction calculateChecksum(payload) {\\n  return btoa(JSON.stringify(payload)).slice(0, 16);\\n}\\n\",\"savedContent\":\"// JavaScript Demonstration with Symbol Outline\\nclass DataPipeline {\\n  constructor(name) {\\n    this.name = name;\\n    this.buffer = [];\\n  }\\n\\n  async processQueue(items) {\\n    console.log(\\\"Processing batch of \\\" + items.length + \\\" items\\\");\\n    return items.map(x => ({ id: x.id, timestamp: Date.now() }));\\n  }\\n\\n  clear() {\\n    this.buffer = [];\\n  }\\n}\\n\\nfunction calculateChecksum(payload) {\\n  return btoa(JSON.stringify(payload)).slice(0, 16);\\n}\\n\",\"mode\":\"javascript\",\"dirty\":false,\"bookmarks\":[]},{\"id\":\"doc_tvx1gxc\",\"name\":\"package.json\",\"content\":\"{\\n  \\\"name\\\": \\\"notepad-studio-ide\\\",\\n  \\\"version\\\": \\\"1.1.0\\\",\\n  \\\"description\\\": \\\"High-performance browser-based text editor with TextFX tools\\\",\\n  \\\"features\\\": [\\n    \\\"multi-tab\\\",\\n    \\\"split-view\\\",\\n    \\\"macro-recorder\\\",\\n    \\\"textfx\\\",\\n    \\\"extended-find-replace\\\",\\n    \\\"error-log-drawer\\\"\\n  ]\\n}\\n\",\"savedContent\":\"{\\n  \\\"name\\\": \\\"notepad-studio-ide\\\",\\n  \\\"version\\\": \\\"1.1.0\\\",\\n  \\\"description\\\": \\\"High-performance browser-based text editor with TextFX tools\\\",\\n  \\\"features\\\": [\\n    \\\"multi-tab\\\",\\n    \\\"split-view\\\",\\n    \\\"macro-recorder\\\",\\n    \\\"textfx\\\",\\n    \\\"extended-find-replace\\\",\\n    \\\"error-log-drawer\\\"\\n  ]\\n}\\n\",\"mode\":\"json\",\"dirty\":false,\"bookmarks\":[]}],\"showSymbolsActive\":false,\"rulerMode\":0}",
      "errors": []
    }
  },
  {
    "id": "P04-download-bytes",
    "at": "2026-11-19T02:45:45.876Z",
    "actual": {
      "filename": "a.txt-vs-b.txt.diff",
      "text": "--- a/a.txt\t(Primary Editor)\n+++ b/b.txt\t(Split Reference)\n@@ -1,4 +1,5 @@\n a\n-b\n+X\n-c\n+b\n-\n+c\n+\n"
    }
  },
  {
    "id": "P04-diff-download",
    "at": "2026-11-19T02:45:45.876Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P05-browser-markers",
    "at": "2026-11-19T02:45:46.411Z",
    "actual": [
      [
        {
          "line": 0,
          "text": "a",
          "class": "CodeMirror-activeline-background"
        },
        {
          "line": 1,
          "text": "b",
          "class": "diff-line-modified"
        },
        {
          "line": 2,
          "text": "c",
          "class": "diff-line-modified"
        }
      ],
      [
        {
          "line": 0,
          "text": "a",
          "class": ""
        },
        {
          "line": 1,
          "text": "X",
          "class": "diff-line-modified"
        },
        {
          "line": 2,
          "text": "b",
          "class": "diff-line-modified"
        },
        {
          "line": 3,
          "text": "c",
          "class": "diff-line-removed"
        }
      ]
    ]
  },
  {
    "id": "P05-shifted-diff",
    "at": "2026-11-19T02:45:46.466Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P06-browser-result",
    "at": "2026-11-19T02:45:47.190Z",
    "actual": {
      "toast": "Found 1 hit across 1 file",
      "badge": "1",
      "rows": [
        "Line 1: needle needle needle"
      ],
      "singleCount": "3 matches"
    }
  },
  {
    "id": "P06-all-tabs",
    "at": "2026-11-19T02:45:47.190Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P07-browser-results",
    "at": "2026-11-19T02:45:47.871Z",
    "actual": [
      {
        "text": "&",
        "query": "&",
        "row": [
          "Line 1: &amp;"
        ],
        "hits": [
          "&"
        ],
        "injected": false
      },
      {
        "text": "<",
        "query": "<",
        "row": [
          "Line 1: &amp;",
          "Line 1: <"
        ],
        "hits": [
          "&"
        ],
        "injected": false
      },
      {
        "text": ">",
        "query": ">",
        "row": [
          "Line 1: &amp;",
          "Line 1: <",
          "Line 1: >"
        ],
        "hits": [
          "&"
        ],
        "injected": false
      },
      {
        "text": "& amp",
        "query": "amp",
        "row": [
          "Line 1: &amp;",
          "Line 1: <",
          "Line 1: >",
          "Line 1: &amp; amp"
        ],
        "hits": [
          "&",
          "amp"
        ],
        "injected": false
      },
      {
        "text": "<img src=x onerror=window.injected=1>",
        "query": "img",
        "row": [
          "Line 1: &amp;",
          "Line 1: <",
          "Line 1: >",
          "Line 1: &amp; amp",
          "Line 1: <img src=x onerror=window.injected=1>"
        ],
        "hits": [
          "&",
          "amp",
          "img"
        ],
        "injected": false
      }
    ]
  },
  {
    "id": "P07-search-snippets",
    "at": "2026-11-19T02:45:47.872Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P08-search-replace",
    "at": "2026-11-19T02:45:58.542Z",
    "actual": {
      "error": "locator.fill: Timeout 10000ms exceeded.\nCall log:\n\u001b[2m  - waiting for locator('#frReplaceInput')\u001b[22m\n\u001b[2m    - locator resolved to <input type=\"text\" class=\"fr-input\" id=\"frReplaceInput\" placeholder=\"Replace with...\"/>\u001b[22m\n\u001b[2m    - fill(\"REPLACED\")\u001b[22m\n\u001b[2m  - attempting fill action\u001b[22m\n\u001b[2m    2 × waiting for element to be visible, enabled and editable\u001b[22m\n\u001b[2m      - element is not visible\u001b[22m\n\u001b[2m    - retrying fill action\u001b[22m\n\u001b[2m    - waiting 20ms\u001b[22m\n\u001b[2m    2 × waiting for element to be visible, enabled and editable\u001b[22m\n\u001b[2m      - element is not visible\u001b[22m\n\u001b[2m    - retrying fill action\u001b[22m\n\u001b[2m      - waiting 100ms\u001b[22m\n\u001b[2m    20 × waiting for element to be visible, enabled and editable\u001b[22m\n\u001b[2m       - element is not visible\u001b[22m\n\u001b[2m     - retrying fill action\u001b[22m\n\u001b[2m       - waiting 500ms\u001b[22m\n\n    at C:\\Users\\jmc53\\OneDrive\\Documents\\ChatGPT\\notepad_studio\\phase0-scratch\\browser-review.cjs:26:206\n    at async scenario (C:\\Users\\jmc53\\OneDrive\\Documents\\ChatGPT\\notepad_studio\\phase0-scratch\\browser-review.cjs:13:58)\n    at async module.exports (C:\\Users\\jmc53\\OneDrive\\Documents\\ChatGPT\\notepad_studio\\phase0-scratch\\browser-review.cjs:26:1)\n    at async C:\\Users\\jmc53\\OneDrive\\Documents\\ChatGPT\\notepad_studio\\.node_repl_cell_5.mjs:20:476"
    }
  },
  {
    "id": "P09-browser",
    "at": "2026-11-19T02:46:00.308Z",
    "actual": {
      "afterSwitch": "SECONDARY EDIT",
      "beforeReload": {
        "activeTabId": "a",
        "wordWrap": false,
        "tabSize": 2,
        "lineEnding": "CRLF",
        "macroActions": [],
        "tabs": [
          {
            "id": "a",
            "name": "a.txt",
            "content": "primary",
            "savedContent": "primary",
            "mode": "text",
            "dirty": false,
            "bookmarks": []
          },
          {
            "id": "b",
            "name": "b.txt",
            "content": "SECONDARY EDIT",
            "savedContent": "reference",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          }
        ],
        "showSymbolsActive": false,
        "rulerMode": 0
      },
      "afterReload": {
        "activeTabId": "a",
        "wordWrap": false,
        "tabSize": 2,
        "lineEnding": "CRLF",
        "macroActions": [],
        "tabs": [
          {
            "id": "a",
            "name": "a.txt",
            "content": "primary",
            "savedContent": "primary",
            "mode": "text",
            "dirty": false,
            "bookmarks": []
          },
          {
            "id": "b",
            "name": "b.txt",
            "content": "SECONDARY EDIT",
            "savedContent": "reference",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          }
        ],
        "showSymbolsActive": false,
        "rulerMode": 0
      },
      "secondary": "SECONDARY EDIT",
      "errors": []
    }
  },
  {
    "id": "P10-browser-replay",
    "at": "2026-11-19T02:46:01.274Z",
    "actual": {
      "tabs": [
        "a.txt",
        "b.txt",
        "replay.txt",
        "replay.txt"
      ]
    }
  },
  {
    "id": "P10-message-replay",
    "at": "2026-11-19T02:46:01.281Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P11-browser-bytes",
    "at": "2026-11-19T02:46:02.045Z",
    "actual": {
      "nativeHex": "616c7068610a62657461",
      "downloadHex": "616c7068610d0a62657461",
      "downloadError": null
    }
  },
  {
    "id": "P11-real-download",
    "at": "2026-11-19T02:46:02.045Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P12-browser-macro",
    "at": "2026-11-19T02:46:02.571Z",
    "actual": {
      "content": "%%%INVALID%%%",
      "recording": "ribbon-btn recording",
      "toast": "Played macro (3 steps)",
      "errors": [
        "JSON Parse Error: Unexpected token '%', \"%%%INVALID%%%\" is not valid JSON%%%INVALID%%%",
        "URI malformed%%%INVALID%%%",
        "Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.%%%INVALID%%%",
        "JSON Parse Error: Unexpected token '%', \"%%%INVALID%%%\" is not valid JSON%%%INVALID%%%",
        "URI malformed%%%INVALID%%%",
        "Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.%%%INVALID%%%"
      ]
    }
  },
  {
    "id": "P12-invalid-macro",
    "at": "2026-11-19T02:46:02.572Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P13-browser",
    "at": "2026-11-19T02:46:03.296Z",
    "actual": {
      "bUndo": "b0",
      "aBeforeUndo": "a1",
      "aUndo": "a0",
      "bookmarkRestored": true
    }
  },
  {
    "id": "P14-browser-timing",
    "at": "2026-11-19T02:46:06.583Z",
    "actual": {
      "timings": [
        {
          "lines": 10000,
          "toggleToFrameMs": 146
        },
        {
          "lines": 100000,
          "toggleToFrameMs": 1145
        }
      ],
      "note": "single-run wall-clock; not a leak or responsiveness budget result"
    }
  },
  {
    "id": "P14-large-diff",
    "at": "2026-11-19T02:46:06.584Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P15-browser",
    "at": "2026-11-19T02:46:07.093Z",
    "actual": {
      "multiline": [],
      "handlers": {
        "copy": "function",
        "dismiss": "function"
      },
      "errors": [
        "Failed to execute 'click' on 'HTMLElement': Invalid or unexpected token"
      ],
      "remaining": 1
    }
  },
  {
    "id": "P15-error-copy",
    "at": "2026-11-19T02:46:07.094Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P16-browser",
    "at": "2026-11-19T02:46:07.603Z",
    "actual": {
      "editors": 2,
      "errors": [
        "e.split is not a function"
      ],
      "raw": "{\"activeTabId\":\"dup\",\"tabs\":[{\"id\":\"dup\",\"name\":\"bad.txt\",\"content\":17,\"mode\":\"bad\",\"bookmarks\":[\"bad\"]},{\"id\":\"dup\",\"name\":\"also.txt\",\"content\":\"other\"}]}"
    }
  },
  {
    "id": "P17-browser-bytes",
    "at": "2026-11-19T02:46:08.754Z",
    "actual": [
      {
        "name": "utf8.txt",
        "inputHex": "efbbbf636166c3a920e697a5e69cace8aa9e20f09f92950a",
        "editorText": "café 日本語 💕\n",
        "outputHex": "636166c3a920e697a5e69cace8aa9e20f09f92950d0a",
        "toast": "Saved & downloaded utf8.txt (CRLF)"
      },
      {
        "name": "latin1.txt",
        "inputHex": "636166e90a",
        "editorText": "caf�\n",
        "outputHex": "636166efbfbd0d0a",
        "toast": "Saved & downloaded latin1.txt (CRLF)"
      },
      {
        "name": "binary.txt",
        "inputHex": "00fffe8000",
        "editorText": "\u0000���\u0000",
        "outputHex": "00efbfbdefbfbdefbfbd00",
        "toast": "Saved & downloaded binary.txt (CRLF)"
      }
    ]
  },
  {
    "id": "P17-file-open-roundtrips",
    "at": "2026-11-19T02:46:08.755Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P18-browser",
    "at": "2026-11-19T02:46:09.270Z",
    "actual": {
      "palette": 20,
      "cursor": {
        "line": 1,
        "ch": 0
      },
      "find": "find-replace-panel show",
      "findAfterEscape": "find-replace-panel",
      "errors": []
    }
  },
  {
    "id": "P18-controls-shortcuts",
    "at": "2026-11-19T02:46:09.271Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P21-browser",
    "at": "2026-11-19T02:46:09.767Z",
    "actual": {
      "toast": "Sent \"a.txt\" to MARKDOWN Studio!",
      "errors": []
    }
  },
  {
    "id": "P21-total-send-failure",
    "at": "2026-11-19T02:46:09.768Z",
    "actual": {
      "completed": true
    }
  },
  {
    "id": "P19-controlled-offline",
    "at": "2026-11-19T02:46:09.889Z",
    "actual": {
      "editors": 0,
      "errors": [
        "CodeMirror is not defined"
      ]
    }
  }
]
```

## Raw evidence — supplement-evidence.json

```json
[
  {
    "id": "search-chromium-file",
    "at": "2026-11-19T02:47:54.456Z",
    "actual": {
      "version": "159.0.8154.6",
      "find": {
        "badge": "1",
        "single": "3 matches",
        "rows": 1
      },
      "repeat": {
        "badge": "1",
        "rows": 2
      },
      "cleared": {
        "badge": "0",
        "rows": 2
      },
      "wholeWord": "needle needle needle",
      "zero": {
        "count": "1 match",
        "output": "XaXaXa",
        "toast": "Replaced 3 occurrences"
      },
      "capture": "12-ab 34-ab"
    }
  },
  {
    "id": "search-chromium-http",
    "at": "2026-11-19T02:47:55.037Z",
    "actual": {
      "version": "159.0.8154.6",
      "find": {
        "badge": "1",
        "single": "3 matches",
        "rows": 1
      },
      "repeat": {
        "badge": "1",
        "rows": 2
      },
      "cleared": {
        "badge": "0",
        "rows": 2
      },
      "wholeWord": "needle needle needle",
      "zero": {
        "count": "1 match",
        "output": "XaXaXa",
        "toast": "Replaced 3 occurrences"
      },
      "capture": "12-ab 34-ab"
    }
  },
  {
    "id": "search-chrome-file",
    "at": "2026-11-19T02:47:56.266Z",
    "actual": {
      "version": "157.0.8103.80",
      "find": {
        "badge": "1",
        "single": "3 matches",
        "rows": 1
      },
      "repeat": {
        "badge": "1",
        "rows": 2
      },
      "cleared": {
        "badge": "0",
        "rows": 2
      },
      "wholeWord": "needle needle needle",
      "zero": {
        "count": "1 match",
        "output": "XaXaXa",
        "toast": "Replaced 3 occurrences"
      },
      "capture": "12-ab 34-ab"
    }
  },
  {
    "id": "search-chrome-http",
    "at": "2026-11-19T02:47:56.993Z",
    "actual": {
      "version": "157.0.8103.80",
      "find": {
        "badge": "1",
        "single": "3 matches",
        "rows": 1
      },
      "repeat": {
        "badge": "1",
        "rows": 2
      },
      "cleared": {
        "badge": "0",
        "rows": 2
      },
      "wholeWord": "needle needle needle",
      "zero": {
        "count": "1 match",
        "output": "XaXaXa",
        "toast": "Replaced 3 occurrences"
      },
      "capture": "12-ab 34-ab"
    }
  },
  {
    "id": "search-msedge-file",
    "at": "2026-11-19T02:47:58.243Z",
    "actual": {
      "version": "157.0.4341.60",
      "find": {
        "badge": "1",
        "single": "3 matches",
        "rows": 1
      },
      "repeat": {
        "badge": "1",
        "rows": 2
      },
      "cleared": {
        "badge": "0",
        "rows": 2
      },
      "wholeWord": "needle needle needle",
      "zero": {
        "count": "1 match",
        "output": "XaXaXa",
        "toast": "Replaced 3 occurrences"
      },
      "capture": "12-ab 34-ab"
    }
  },
  {
    "id": "search-msedge-http",
    "at": "2026-11-19T02:47:58.965Z",
    "actual": {
      "version": "157.0.4341.60",
      "find": {
        "badge": "1",
        "single": "3 matches",
        "rows": 1
      },
      "repeat": {
        "badge": "1",
        "rows": 2
      },
      "cleared": {
        "badge": "0",
        "rows": 2
      },
      "wholeWord": "needle needle needle",
      "zero": {
        "count": "1 match",
        "output": "XaXaXa",
        "toast": "Replaced 3 occurrences"
      },
      "capture": "12-ab 34-ab"
    }
  },
  {
    "id": "search-firefox-file",
    "at": "2026-11-19T02:48:01.738Z",
    "actual": {
      "version": "159.0",
      "find": {
        "badge": "1",
        "single": "3 matches",
        "rows": 1
      },
      "repeat": {
        "badge": "1",
        "rows": 2
      },
      "cleared": {
        "badge": "0",
        "rows": 2
      },
      "wholeWord": "needle needle needle",
      "zero": {
        "count": "1 match",
        "output": "XaXaXa",
        "toast": "Replaced 3 occurrences"
      },
      "capture": "12-ab 34-ab"
    }
  },
  {
    "id": "search-firefox-http",
    "at": "2026-11-19T02:48:02.556Z",
    "actual": {
      "version": "159.0",
      "find": {
        "badge": "1",
        "single": "3 matches",
        "rows": 1
      },
      "repeat": {
        "badge": "1",
        "rows": 2
      },
      "cleared": {
        "badge": "0",
        "rows": 2
      },
      "wholeWord": "needle needle needle",
      "zero": {
        "count": "1 match",
        "output": "XaXaXa",
        "toast": "Replaced 3 occurrences"
      },
      "capture": "12-ab 34-ab"
    }
  },
  {
    "id": "actual-Markdown-peer-transfer",
    "at": "2026-11-19T02:48:05.087Z",
    "actual": {
      "peerIdentity": {
        "head": "92b635c2aa6499687e573b5f67ba7809d3d10007"
      },
      "receiving": {
        "first": "LATEST SELECTION",
        "second": "LATEST SELECTION",
        "firstTabs": 2,
        "secondTabs": 2
      },
      "returned": "LATEST MARKDOWN TO NOTEPAD",
      "queue": "[]"
    }
  },
  {
    "id": "print-long-document",
    "at": "2026-11-19T02:48:05.832Z",
    "actual": {
      "layout": {
        "lines": 240,
        "viewport": {
          "from": 0,
          "to": 37
        },
        "lastInDOM": false,
        "bodyOverflow": "hidden",
        "cmHeight": 584.609375,
        "scrollHeight": 5029
      },
      "pdfBytes": 510523,
      "note": "PDF created; text completeness must be independently inspected"
    }
  }
]
```

## Raw evidence — final-evidence.json

```json
[
  {
    "id": "actual-download-git-apply",
    "at": "2026-11-19T02:50:59.557Z",
    "actual": {
      "download": "--- a/fixture.txt\t(Primary Editor)\n+++ b/fixture.txt\t(Split Reference)\n@@ -1,4 +1,5 @@\n a\n-b\n+X\n-c\n+b\n-\n+c\n+\n",
      "input": "a\nb\nc\n",
      "expected": "a\nX\nb\nc\n",
      "passed": false,
      "stderr": "error: patch failed: fixture.txt:1\nerror: fixture.txt: patch does not apply\n"
    }
  },
  {
    "id": "native-picker-cancel",
    "at": "2026-11-19T02:50:59.677Z",
    "actual": {
      "indicator": "Unsaved changes",
      "downloads": 0,
      "content": "UNSAVED AFTER CANCEL"
    }
  },
  {
    "id": "normal-persistence-preferences",
    "at": "2026-11-19T02:51:00.769Z",
    "actual": {
      "before": {
        "state": {
          "activeTabId": "a",
          "wordWrap": true,
          "tabSize": 4,
          "lineEnding": "LF",
          "macroActions": [],
          "tabs": [
            {
              "id": "a",
              "name": "fixture.txt",
              "content": "UNSAVED AFTER CANCEL",
              "savedContent": "a\nb\nc\n",
              "mode": "text",
              "dirty": true,
              "bookmarks": []
            },
            {
              "id": "b",
              "name": "fixture.txt",
              "content": "a\nX\nb\nc\n",
              "savedContent": "a\nX\nb\nc\n",
              "mode": "text",
              "dirty": false,
              "bookmarks": []
            }
          ],
          "showSymbolsActive": true,
          "rulerMode": 1
        },
        "theme": "light"
      },
      "after": {
        "state": {
          "activeTabId": "a",
          "wordWrap": true,
          "tabSize": 4,
          "lineEnding": "LF",
          "macroActions": [],
          "tabs": [
            {
              "id": "a",
              "name": "fixture.txt",
              "content": "UNSAVED AFTER CANCEL",
              "savedContent": "a\nb\nc\n",
              "mode": "text",
              "dirty": true,
              "bookmarks": []
            },
            {
              "id": "b",
              "name": "fixture.txt",
              "content": "a\nX\nb\nc\n",
              "savedContent": "a\nX\nb\nc\n",
              "mode": "text",
              "dirty": false,
              "bookmarks": []
            }
          ],
          "showSymbolsActive": true,
          "rulerMode": 1
        },
        "theme": "light",
        "current": "UNSAVED AFTER CANCEL"
      }
    }
  },
  {
    "id": "genuine-storage-quota",
    "at": "2026-11-19T02:51:01.848Z",
    "actual": {
      "failure": "QuotaExceededError",
      "toast": "Storage quota warning: Failed to execute 'setItem' on 'Storage': Setting the value of 'npp_studio_state_v1' exceeded the quota.",
      "errors": [
        "Failed to persist workspace state: Failed to execute 'setItem' on 'Storage': Setting the value of 'npp_studio_state_v1' exceeded the quota."
      ],
      "liveLength": 500017,
      "storedLength": 20
    }
  },
  {
    "id": "final-source-identity",
    "at": "2026-11-19T02:51:02.050Z",
    "actual": {
      "status": "## main...origin/main\n?? .github/\n?? .gitignore\n?? package-lock.json\n?? package.json\n?? playwright.config.js\n?? tests/\n",
      "head": "2437b1ceee9a5b5d32755440e74c504b2211fee2",
      "workingBytes": 141723,
      "workingSHA256": "f68350a90c31042fff7fd4050307f75dcdc0fe2036f5288a9912a7c9bc187213",
      "gitBytes": 137785,
      "gitBlob": "d29dfa5785ba62e89ced8386dd022dbec5b42890",
      "gitSHA256": "962e4a66da5c95965a0101a2cf5ce17dcc72241e51a648c2849609eca4c6cc89"
    }
  }
]
```

## Raw evidence — print-inspection.json

```json
{
  "pages": 1,
  "markers": [
    "001",
    "002",
    "003",
    "004",
    "005",
    "006",
    "007",
    "008",
    "009",
    "010",
    "011",
    "012",
    "013",
    "014",
    "015",
    "016",
    "017",
    "018",
    "019",
    "020",
    "021",
    "022",
    "023",
    "024",
    "025",
    "026",
    "027",
    "028",
    "029",
    "030",
    "031",
    "032",
    "033",
    "034",
    "035",
    "036",
    "037"
  ],
  "markerCount": 37,
  "firstPresent": true,
  "lastPresent": false,
  "text": "+\n📄a.txt\n✕\nPRINTLINE_001_END\nPRINTLINE_002_END\nPRINTLINE_003_END\nPRINTLINE_004_END\nPRINTLINE_005_END\nPRINTLINE_006_END\nPRINTLINE_007_END\nPRINTLINE_008_END\nPRINTLINE_009_END\nPRINTLINE_010_END\nPRINTLINE_011_END\nPRINTLINE_012_END\nPRINTLINE_013_END\nPRINTLINE_014_END\nPRINTLINE_015_END\nPRINTLINE_016_END\nPRINTLINE_017_END\nPRINTLINE_018_END\nPRINTLINE_019_END\nPRINTLINE_020_END\nPRINTLINE_021_END\nPRINTLINE_022_END\nPRINTLINE_023_END\nPRINTLINE_024_END\nPRINTLINE_025_END\nPRINTLINE_026_END\nPRINTLINE_027_END\nPRINTLINE_028_END\nPRINTLINE_029_END\nPRINTLINE_030_END\nPRINTLINE_031_END\nPRINTLINE_032_END\nPRINTLINE_033_END\nPRINTLINE_034_END\nPRINTLINE_035_END\nPRINTLINE_036_END\nPRINTLINE_037_END\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30\n31\n32\n33\n34\n35\n36\n37\nEXPLORER & OUTLINE\n✕\nOPEN DOCUMENTS\n1\n📄a.txt\n•\nDOCUMENT SYMBOLS\nNo outline symbols found\nQUICK STATS\nLines: 240\nWords: 240\nChars: 4,319\nSize: 4.2 KB\n↶ Undo\n↷ Redo\n{} JSON\nDedupe\n● Rec Macro\n▶ Play Macro\n¶\n✨ TextFX Tools ▾\n🚀 Send To ▾\n🔖 Bookmarks ▾\nN++\nNotepad++\nStudio\nPolyglot\nIDE v1.1\nNew\nOpen\n📚 Examples\nSave\nSave As\nSplit View\nFind\nUnsaved changes\n0 Errors\n🔍Search: 0\nLn 1, Col 1\nSel: 0 | 0 chars\n240 linesCRLF\nUTF-8\nPlain Text\nSpaces: 2\n"
}
```

## Raw evidence — print-matrix.json

```json
[
  {
    "browser": "chromium",
    "version": "159.0.8154.6",
    "origin": "file",
    "pages": 1,
    "markers": [
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
      "013",
      "014",
      "015",
      "016",
      "017",
      "018",
      "019",
      "020",
      "021",
      "022",
      "023",
      "024",
      "025",
      "026",
      "027",
      "028",
      "029",
      "030",
      "031",
      "032",
      "033",
      "034",
      "035",
      "036",
      "037"
    ],
    "count": 37,
    "first": true,
    "last": false
  },
  {
    "browser": "chromium",
    "version": "159.0.8154.6",
    "origin": "http",
    "pages": 1,
    "markers": [
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
      "013",
      "014",
      "015",
      "016",
      "017",
      "018",
      "019",
      "020",
      "021",
      "022",
      "023",
      "024",
      "025",
      "026",
      "027",
      "028",
      "029",
      "030",
      "031",
      "032",
      "033",
      "034",
      "035",
      "036",
      "037"
    ],
    "count": 37,
    "first": true,
    "last": false
  },
  {
    "browser": "chrome",
    "version": "157.0.8103.80",
    "origin": "file",
    "pages": 1,
    "markers": [
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
      "013",
      "014",
      "015",
      "016",
      "017",
      "018",
      "019",
      "020",
      "021",
      "022",
      "023",
      "024",
      "025",
      "026",
      "027",
      "028",
      "029",
      "030",
      "031",
      "032",
      "033",
      "034",
      "035",
      "036",
      "037"
    ],
    "count": 37,
    "first": true,
    "last": false
  },
  {
    "browser": "chrome",
    "version": "157.0.8103.80",
    "origin": "http",
    "pages": 1,
    "markers": [
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
      "013",
      "014",
      "015",
      "016",
      "017",
      "018",
      "019",
      "020",
      "021",
      "022",
      "023",
      "024",
      "025",
      "026",
      "027",
      "028",
      "029",
      "030",
      "031",
      "032",
      "033",
      "034",
      "035",
      "036",
      "037"
    ],
    "count": 37,
    "first": true,
    "last": false
  },
  {
    "browser": "msedge",
    "version": "157.0.4341.60",
    "origin": "file",
    "pages": 1,
    "markers": [
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
      "013",
      "014",
      "015",
      "016",
      "017",
      "018",
      "019",
      "020",
      "021",
      "022",
      "023",
      "024",
      "025",
      "026",
      "027",
      "028",
      "029",
      "030",
      "031",
      "032",
      "033",
      "034",
      "035",
      "036",
      "037"
    ],
    "count": 37,
    "first": true,
    "last": false
  },
  {
    "browser": "msedge",
    "version": "157.0.4341.60",
    "origin": "http",
    "pages": 1,
    "markers": [
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
      "013",
      "014",
      "015",
      "016",
      "017",
      "018",
      "019",
      "020",
      "021",
      "022",
      "023",
      "024",
      "025",
      "026",
      "027",
      "028",
      "029",
      "030",
      "031",
      "032",
      "033",
      "034",
      "035",
      "036",
      "037"
    ],
    "count": 37,
    "first": true,
    "last": false
  }
]
```

## Reproduction harness — browser-review.cjs

```javascript
const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=async function({pw,base,fileUrl,root,onProgress}){
fs.mkdirSync(root,{recursive:true});const records=[];
const record=(id,actual)=>{records.push({id,at:new Date().toISOString(),actual});fs.writeFileSync(path.join(root,'browser-evidence.json'),JSON.stringify(records,null,2));onProgress?.(id,actual)};
const tab=(id,content,name=id+'.txt')=>({id,name,content,savedContent:content,mode:'text',dirty:false,bookmarks:[]});
const state=ts=>({activeTabId:ts[0].id,tabs:ts,wordWrap:false,tabSize:2,lineEnding:'CRLF',macroActions:[],showSymbolsActive:false,rulerMode:0});
let b;
const click=(p,id)=>p.locator('#'+id).evaluate(e=>e.click());
const set=(p,text,pane=0)=>p.evaluate(({text,pane})=>document.querySelectorAll('.CodeMirror')[pane].CodeMirror.setValue(text),{text,pane});
const get=(p,pane=0)=>p.evaluate(pane=>document.querySelectorAll('.CodeMirror')[pane].CodeMirror.getValue(),pane);
const stored=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('npp_studio_state_v1')));
async function fresh(ts=[tab('a','alpha\nbeta'),tab('b','reference')],extra={}){const context=await b.newContext({acceptDownloads:true});await context.addInitScript(({s,raw})=>{if(!sessionStorage.getItem('reviewSeeded')){localStorage.setItem('npp_studio_state_v1',raw??JSON.stringify(s));sessionStorage.setItem('reviewSeeded','yes')}},{s:state(ts),raw:extra.raw});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.reviewErrors=errors;page.setDefaultTimeout(10000);await page.goto(base,{waitUntil:'load',timeout:30000});await page.locator('.CodeMirror').nth(1).waitFor({state:'attached'});return {p:page,c:context}}
async function scenario(id,fn){let v;try{v=await fresh();await fn(v.p,v.c);record(id,{...(v.result??{}),completed:true})}catch(e){record(id,{error:e.stack})}finally{await v?.c.close()}}
try{
// Genuine launch matrix; no bundled or substituted dependencies.
for(const kind of ['chromium','chrome','msedge','firefox']){let mb;try{mb=await(kind==='firefox'?pw.firefox:pw.chromium).launch({headless:true,...(['chrome','msedge'].includes(kind)?{executablePath:kind==='chrome'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{})});for(const [origin,url]of [['file',fileUrl],['http',base]]){let cx=await mb.newContext(),p=await cx.newPage();const errors=[],failed=[];p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));try{await p.goto(url,{waitUntil:'load',timeout:30000});record('launch-'+kind+'-'+origin,{version:mb.version(),origin,url,editors:await p.locator('.CodeMirror').count(),errors,failed});}catch(e){record('launch-'+kind+'-'+origin,{error:e.message,errors,failed})}await cx.close()}}catch(e){record('launch-'+kind,{error:e.message})}finally{await mb?.close()}}
b=await pw.chromium.launch({headless:true});
await scenario('P01-download-suppressed',async p=>{await set(p,'changed but no file');await p.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){window.anchorSuppressed=true}});await click(p,'btnSaveFile');record('P01-observed',{state:await stored(p),indicator:await p.locator('#statusReady').textContent(),toast:await p.locator('#toastMessage').textContent(),suppressed:await p.evaluate(()=>window.anchorSuppressed)})});
await scenario('P02-delayed-native-close',async p=>{await p.evaluate(()=>{window.showSaveFilePicker=async()=>({name:'fixture.txt',createWritable:async()=>({write:async text=>{window.written=text},close:async()=>new Promise(r=>window.finishClose=r)})})});await set(p,'snapshot before write');await click(p,'btnSaveAs');await p.waitForFunction(()=>!!window.finishClose);await set(p,'EDIT DURING CLOSE');await p.evaluate(()=>window.finishClose());await p.waitForTimeout(100);record('P02-observed',{written:await p.evaluate(()=>window.written),current:await get(p),state:await stored(p),indicator:await p.locator('#statusReady').textContent()})});
await scenario('P02-picker-tab-switch',async p=>{await p.evaluate(()=>window.showSaveFilePicker=()=>new Promise(r=>window.finishPicker=()=>r({name:'picked.txt',createWritable:async()=>({write:async text=>window.written=text,close:async()=>{}})})));await set(p,'ORIGINAL TAB CONTENT');await click(p,'btnSaveAs');await click(p,'btnNewFile');await set(p,'SECOND TAB CONTENT');await p.evaluate(()=>window.finishPicker());await p.waitForTimeout(200);record('P02-picker-observed',{written:await p.evaluate(()=>window.written),current:await get(p),state:await stored(p)})});
{let v=await fresh(undefined,{raw:'{broken recoverable workspace'});let p=v.p;const initial=await p.evaluate(()=>localStorage.getItem('npp_studio_state_v1'));await set(p,'synthetic edit after recovery');await p.waitForTimeout(1000);record('P03-browser',{initial,after:await p.evaluate(()=>localStorage.getItem('npp_studio_state_v1')),errors:p.reviewErrors});await v.c.close()}
await scenario('P04-diff-download',async(p,c)=>{await set(p,'a\nb\nc\n');await click(p,'btnToggleSplit');await set(p,'a\nX\nb\nc\n',1);const dl=p.waitForEvent('download');await click(p,'btnExportDiff');const d=await dl;const dest=path.join(root,'actual-export.diff');await d.saveAs(dest);record('P04-download-bytes',{filename:d.suggestedFilename(),text:fs.readFileSync(dest,'utf8')})});
await scenario('P05-shifted-diff',async p=>{await set(p,'a\nb\nc');await click(p,'btnToggleSplit');await set(p,'a\nX\nb\nc',1);await click(p,'btnCompareDiff');record('P05-browser-markers',await p.evaluate(()=>[...document.querySelectorAll('.CodeMirror')].map(e=>{const cm=e.CodeMirror;return Array.from({length:cm.lineCount()},(_,i)=>({line:i,text:cm.getLine(i),class:cm.lineInfo(i).bgClass??''}))})));await p.screenshot({path:path.join(root,'shifted-diff.png'),fullPage:true})});
await scenario('P06-all-tabs',async p=>{await set(p,'needle needle needle');await click(p,'btnToggleFind');await p.locator('#frFindInput').fill('needle');await click(p,'frFindAllTabs');record('P06-browser-result',{toast:await p.locator('#toastMessage').textContent(),badge:await p.locator('#searchResultsBadge').textContent(),rows:await p.locator('.search-result-row').allTextContents(),singleCount:await p.locator('#frMatchesCount').textContent()})});
await scenario('P07-search-snippets',async p=>{const results=[];for(const [text,query]of [['&','&'],['<','<'],['>','>'],['& amp','amp'],['<img src=x onerror=window.injected=1>','img']]){await set(p,text);await click(p,'btnToggleFind');await p.locator('#frFindInput').fill(query);await click(p,'frFindAllTabs');results.push({text,query,row:await p.locator('.search-result-row').allTextContents(),hits:await p.locator('.search-result-hit').allTextContents(),injected:await p.evaluate(()=>window.injected??false)})}record('P07-browser-results',results)});
await scenario('P08-search-replace',async p=>{const results=[];await set(p,'needle needle');await click(p,'btnToggleFind');await p.locator('#frFindInput').fill('needle');await p.locator('#frReplaceInput').fill('REPLACED');await click(p,'frWordBtn');await p.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.setSelection({line:0,ch:0},{line:0,ch:6}));await click(p,'frReplace');results.push({fixture:'whole-word literal selected replace',output:await get(p)});await click(p,'frWordBtn');await click(p,'frRegexBtn');await set(p,'aaa');await p.locator('#frFindInput').fill('(?=a)');const count=await p.locator('#frMatchesCount').textContent();await p.locator('#frReplaceInput').fill('X');await click(p,'frReplaceAll');results.push({fixture:'zero-width lookahead',count,output:await get(p),toast:await p.locator('#toastMessage').textContent()});await set(p,'ab12 ab34');await p.locator('#frFindInput').fill('(ab)(\\d+)');await p.locator('#frReplaceInput').fill('$2-$1');await click(p,'frReplaceAll');results.push({fixture:'captures',output:await get(p)});record('P08-browser-results',results)});
{const v=await fresh([tab('a','primary'),tab('b','reference')]);const p=v.p;await click(p,'btnToggleSplit');await p.locator('#splitTabSelect').selectOption('b');await set(p,'SECONDARY EDIT',1);await p.locator('.tab-item').filter({hasText:'b.txt'}).click();const afterSwitch=await get(p);await p.locator('.tab-item').filter({hasText:'a.txt'}).click();await p.waitForTimeout(1100);const beforeReload=await stored(p);await p.reload({waitUntil:'load'});const afterReload=await stored(p);record('P09-browser',{afterSwitch,beforeReload,afterReload,secondary:await get(p,1),errors:p.reviewErrors});await v.c.close()}
await scenario('P10-message-replay',async(p,c)=>{const sender=await c.newPage();await sender.goto(base);await sender.evaluate(()=>{window.reviewBus=new BroadcastChannel('gemini_studio_bus');window.reviewBus.postMessage({id:'same-id',targetApp:'notepad',title:'replay.txt',content:'replayed',language:'text',timestamp:Date.now()})});await p.waitForTimeout(100);await sender.evaluate(()=>window.reviewBus.postMessage({id:'same-id',targetApp:'notepad',title:'replay.txt',content:'replayed',language:'text',timestamp:Date.now()}));await p.waitForTimeout(100);record('P10-browser-replay',{tabs:await p.locator('.tab-title').allTextContents()});await sender.close()});
await scenario('P11-real-download',async p=>{await set(p,'alpha\nbeta');await p.evaluate(()=>window.showSaveFilePicker=async()=>({name:'native.txt',createWritable:async()=>({write:async text=>window.nativeBytes=text,close:async()=>{}})}));await click(p,'btnSaveAs');await p.waitForFunction(()=>window.nativeBytes!==undefined);const native=await p.evaluate(()=>window.nativeBytes);await p.evaluate(()=>{window.showSaveFilePicker=undefined});await click(p,'btnNewFile');await set(p,'alpha\nbeta');const pending=p.waitForEvent('download');await click(p,'btnSaveFile');const d=await pending;const dest=path.join(root,'fallback-CRLF.txt');await d.saveAs(dest);record('P11-browser-bytes',{nativeHex:Buffer.from(native).toString('hex'),downloadHex:fs.readFileSync(dest).toString('hex'),downloadError:await d.failure()})});
await scenario('P12-invalid-macro',async p=>{await set(p,'%%%INVALID%%%');await click(p,'btnMacroRecord');for(const action of ['format-json','url-decode','base64-decode'])await p.locator('[data-action="'+action+'"]').evaluate(e=>e.click());await click(p,'btnMacroPlay');record('P12-browser-macro',{content:await get(p),recording:await p.locator('#btnMacroRecord').getAttribute('class'),toast:await p.locator('#toastMessage').textContent(),errors:await p.locator('.error-log-msg').allTextContents()})});
{const v=await fresh([tab('a','a0'),tab('b','b0')]);const p=v.p;await set(p,'a1');await p.evaluate(()=>{const cm=document.querySelector('.CodeMirror').CodeMirror;cm.focus();CodeMirror.signal(cm,'gutterClick',cm,0,'CodeMirror-linenumbers')});await p.locator('.tab-item').filter({hasText:'b.txt'}).click();await set(p,'b1');await click(p,'btnUndo');const bUndo=await get(p);await p.locator('.tab-item').filter({hasText:'a.txt'}).click();const aBeforeUndo=await get(p);const bookmarks=await p.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.lineInfo(0).gutterMarkers!=null);await click(p,'btnUndo');record('P13-browser',{bUndo,aBeforeUndo,aUndo:await get(p),bookmarkRestored:bookmarks});await v.c.close()}
await scenario('P14-large-diff',async p=>{await click(p,'btnToggleSplit');const timings=[];for(const n of [10000,100000]){const text=Array.from({length:n},(_,i)=>'line '+i).join('\n');await set(p,text);await set(p,text+'\nextra',1);const t=Date.now();await click(p,'btnCompareDiff');await p.evaluate(()=>new Promise(requestAnimationFrame));timings.push({lines:n,toggleToFrameMs:Date.now()-t});await click(p,'btnCompareDiff')}record('P14-browser-timing',{timings,note:'single-run wall-clock; not a leak or responsiveness budget result'})});
await scenario('P15-error-copy',async p=>{await p.evaluate(()=>{window.copyCalls=[];window.originalCopy=window.copyErrorText;window.copyErrorText=text=>window.copyCalls.push(text);window.dispatchEvent(new ErrorEvent('error',{message:'line1\nline2'}))});await p.locator('.error-log-copy-btn').first().evaluate(e=>e.click());const multiline=await p.evaluate(()=>window.copyCalls);const handlers=await p.evaluate(()=>({copy:typeof window.originalCopy,dismiss:typeof window.dismissError}));await p.locator('.error-log-dismiss-btn').first().evaluate(e=>e.click());record('P15-browser',{multiline,handlers,errors:p.reviewErrors,remaining:await p.locator('.error-log-row').count()})});
{const malformed=JSON.stringify({activeTabId:'dup',tabs:[{id:'dup',name:'bad.txt',content:17,mode:'bad',bookmarks:['bad']},{id:'dup',name:'also.txt',content:'other'}]});let v;try{v=await fresh(undefined,{raw:malformed});record('P16-browser',{editors:await v.p.locator('.CodeMirror').count(),errors:v.p.reviewErrors,raw:await v.p.evaluate(()=>localStorage.getItem('npp_studio_state_v1'))})}catch(e){record('P16-browser',{error:e.message})}finally{await v?.c.close()}}
await scenario('P17-file-open-roundtrips',async p=>{const fixtures=[['utf8.txt',Buffer.from('\uFEFFcafé 日本語 💕\n')],['latin1.txt',Buffer.from([0x63,0x61,0x66,0xe9,0x0a])],['binary.txt',Buffer.from([0,255,254,128,0])]];const results=[];for(const[name,buffer]of fixtures){await p.locator('#fileInput').setInputFiles({name,mimeType:'text/plain',buffer});await p.waitForTimeout(100);const text=await get(p);const pending=p.waitForEvent('download');await click(p,'btnSaveFile');const d=await pending;const dest=path.join(root,name);await d.saveAs(dest);results.push({name,inputHex:buffer.toString('hex'),editorText:text,outputHex:fs.readFileSync(dest).toString('hex'),toast:await p.locator('#toastMessage').textContent()})}record('P17-browser-bytes',results)});
await scenario('P18-controls-shortcuts',async p=>{await click(p,'btnCommandPalette');const palette=await p.locator('.cmd-item').count();await p.locator('#cmdPaletteInput').fill('Go to Line');await p.locator('#cmdPaletteInput').press('Enter');await p.locator('#gotoLineInput').fill('2');await p.locator('#gotoLineInput').press('Enter');const cursor=await p.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.getCursor());await p.locator('.CodeMirror textarea').first().focus();await p.keyboard.press('Control+f');const find=await p.locator('#findReplacePanel').getAttribute('class');await p.keyboard.press('Escape');record('P18-browser',{palette,cursor,find,findAfterEscape:await p.locator('#findReplacePanel').getAttribute('class'),errors:p.reviewErrors})});
await scenario('P21-total-send-failure',async p=>{await set(p,'latest transfer content');await p.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};BroadcastChannel.prototype.postMessage=function(){throw Error('closed')}});await p.locator('[data-sendto="markdown"]').evaluate(e=>e.click());record('P21-browser',{toast:await p.locator('#toastMessage').textContent(),errors:p.reviewErrors})});
// Genuine offline launch, independent of the earlier sandbox DNS failure.
{const c=await b.newContext({offline:true}),p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(fileUrl,{waitUntil:'load',timeout:20000});record('P19-controlled-offline',{editors:await p.locator('.CodeMirror').count(),errors});await c.close()}
}finally{await b?.close()}
return records;
};

```

## Reproduction harness — browser-supplement.cjs

```javascript
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
module.exports=async({pw,base,fileUrl,root,npSource,mdSource,peerIdentity})=>{
const records=[];const rec=(id,actual)=>{records.push({id,at:new Date().toISOString(),actual});fs.writeFileSync(path.join(root,'supplement-evidence.json'),JSON.stringify(records,null,2))};
const seed={activeTabId:'a',tabs:[{id:'a',name:'a.txt',content:'alpha\nbeta',savedContent:'alpha\nbeta',mode:'text',dirty:false,bookmarks:[]}],wordWrap:false,tabSize:2,lineEnding:'CRLF',macroActions:[]};
const click=(p,id)=>p.locator('#'+id).evaluate(e=>e.click());const set=(p,s)=>p.evaluate(s=>document.querySelector('.CodeMirror').CodeMirror.setValue(s),s);const get=p=>p.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.getValue());
let b;
for(const kind of ['chromium','chrome','msedge','firefox']){try{b=await(kind==='firefox'?pw.firefox:pw.chromium).launch({headless:true,...(['chrome','msedge'].includes(kind)?{executablePath:kind==='chrome'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{})});for(const [origin,url]of [['file',fileUrl],['http',base]]){let c;try{c=await b.newContext({acceptDownloads:true});await c.addInitScript(s=>localStorage.setItem('npp_studio_state_v1',JSON.stringify(s)),seed);const p=await c.newPage();await p.goto(url);await set(p,'needle needle needle');await click(p,'btnToggleFind');await p.locator('#frFindInput').fill('needle');await click(p,'frFindAllTabs');const find={badge:await p.locator('#searchResultsBadge').textContent(),single:await p.locator('#frMatchesCount').textContent(),rows:await p.locator('.search-result-row').count()};await click(p,'frFindAllTabs');const repeat={badge:await p.locator('#searchResultsBadge').textContent(),rows:await p.locator('.search-result-row').count()};await click(p,'btnClearSearchResults');const cleared={badge:await p.locator('#searchResultsBadge').textContent(),rows:await p.locator('.search-result-row').count()};
await p.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.focus());await p.keyboard.press('Control+h');await p.locator('#frReplaceInput').fill('REPLACED');await click(p,'frWordBtn');await p.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.setSelection({line:0,ch:0},{line:0,ch:6}));await click(p,'frReplace');const wholeWord=await get(p);await click(p,'frWordBtn');await click(p,'frRegexBtn');await set(p,'aaa');await p.locator('#frFindInput').fill('(?=a)');const zeroCount=await p.locator('#frMatchesCount').textContent();await p.locator('#frReplaceInput').fill('X');await click(p,'frReplaceAll');const zero={count:zeroCount,output:await get(p),toast:await p.locator('#toastMessage').textContent()};await set(p,'ab12 ab34');await p.locator('#frFindInput').fill('(ab)(\\d+)');await p.locator('#frReplaceInput').fill('$2-$1');await click(p,'frReplaceAll');const capture=await get(p);
rec('search-'+kind+'-'+origin,{version:b.version(),find,repeat,cleared,wholeWord,zero,capture});
}catch(e){rec('search-'+kind+'-'+origin,{error:e.stack})}finally{await c?.close()}}}catch(e){rec('search-'+kind,{error:e.message})}finally{await b?.close()}}
b=await pw.chromium.launch({headless:true});
// Isolated real-peer origin; both application sources are served unchanged.
const peerServer=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url.startsWith('/markdown')?mdSource:npSource)});await new Promise(r=>peerServer.listen(0,'127.0.0.1',r));const peerBase='http://127.0.0.1:'+peerServer.address().port;
try{const c=await b.newContext();await c.addInitScript(s=>{if(!localStorage.getItem('npp_studio_state_v1'))localStorage.setItem('npp_studio_state_v1',JSON.stringify(s))},seed);const np=await c.newPage(),md=await c.newPage(),md2=await c.newPage();await np.goto(peerBase+'/notepad');await md.goto(peerBase+'/markdown');await md2.goto(peerBase+'/markdown');await set(np,'old then LATEST SELECTION');await np.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.setSelection({line:0,ch:9},{line:0,ch:25}));await np.locator('[data-sendto="markdown"]').evaluate(e=>e.click());await md.waitForFunction(()=>document.querySelector('#editor')?.value.includes('LATEST SELECTION'));await md2.waitForFunction(()=>document.querySelector('#editor')?.value.includes('LATEST SELECTION'));const receiving={first:await md.locator('#editor').inputValue(),second:await md2.locator('#editor').inputValue(),firstTabs:await md.locator('.tab').count(),secondTabs:await md2.locator('.tab').count()};await md.locator('#editor').fill('LATEST MARKDOWN TO NOTEPAD');await md.locator('#btnSendMdToNotepad').evaluate(e=>e.click());await np.waitForFunction(()=>document.querySelector('.CodeMirror').CodeMirror.getValue()==='LATEST MARKDOWN TO NOTEPAD');rec('actual-Markdown-peer-transfer',{peerIdentity,receiving,returned:await get(np),queue:await np.evaluate(()=>localStorage.getItem('gemini_studio_transfer_queue_v1'))});await c.close()}catch(e){rec('actual-Markdown-peer-transfer',{error:e.stack})}
// Actual browser print pipeline; capture PDF and print DOM before claiming output.
try{const c=await b.newContext(),p=await c.newPage();await c.addInitScript(s=>localStorage.setItem('npp_studio_state_v1',JSON.stringify(s)),seed);await p.goto(base);const text=Array.from({length:240},(_,i)=>'PRINTLINE_'+String(i+1).padStart(3,'0')+'_END').join('\n');await set(p,text);await p.emulateMedia({media:'print'});const layout=await p.evaluate(()=>{const cm=document.querySelector('.CodeMirror').CodeMirror,body=getComputedStyle(document.body);return {lines:cm.lineCount(),viewport:cm.getViewport(),lastInDOM:document.body.textContent.includes('PRINTLINE_240_END'),bodyOverflow:body.overflow,cmHeight:document.querySelector('.CodeMirror').getBoundingClientRect().height,scrollHeight:cm.getScrollInfo().height}});await p.pdf({path:path.join(root,'notepad-native-print.pdf'),format:'A4',printBackground:true});rec('print-long-document',{layout,pdfBytes:fs.statSync(path.join(root,'notepad-native-print.pdf')).size,note:'PDF created; text completeness must be independently inspected'});await c.close()}catch(e){rec('print-long-document',{error:e.stack})}
await b.close();await new Promise(r=>peerServer.close(r));return records;
};

```

## Reproduction harness — browser-final-checks.cjs

```javascript
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
module.exports=async({pw,base,root})=>{const records=[];const rec=(id,actual)=>{records.push({id,at:new Date().toISOString(),actual});fs.writeFileSync(path.join(root,'final-evidence.json'),JSON.stringify(records,null,2))};const b=await pw.chromium.launch({headless:true});
const seed={activeTabId:'a',tabs:[{id:'a',name:'fixture.txt',content:'a\nb\nc\n',savedContent:'a\nb\nc\n',mode:'text',dirty:false,bookmarks:[]},{id:'b',name:'fixture.txt',content:'a\nX\nb\nc\n',savedContent:'a\nX\nb\nc\n',mode:'text',dirty:false,bookmarks:[]}],wordWrap:false,tabSize:2,lineEnding:'CRLF',macroActions:[]};
const click=(p,id)=>p.locator('#'+id).evaluate(e=>e.click());const c=await b.newContext({acceptDownloads:true});await c.addInitScript(s=>{if(!sessionStorage.getItem('seed')){localStorage.setItem('npp_studio_state_v1',JSON.stringify(s));sessionStorage.setItem('seed','yes')}},seed);const p=await c.newPage();await p.goto(base);await click(p,'btnToggleSplit');const dp=p.waitForEvent('download');await click(p,'btnExportDiff');const d=await dp;const dir=path.join(root,'actual-patch-check');fs.mkdirSync(dir,{recursive:true});await d.saveAs(path.join(dir,'actual.diff'));fs.writeFileSync(path.join(dir,'fixture.txt'),seed.tabs[0].content);let apply;try{cp.execFileSync('git',['apply','--check','actual.diff'],{cwd:dir,stdio:'pipe'});apply={passed:true}}catch(e){apply={passed:false,stderr:String(e.stderr)}}rec('actual-download-git-apply',{download:fs.readFileSync(path.join(dir,'actual.diff'),'utf8'),input:seed.tabs[0].content,expected:seed.tabs[1].content,...apply});
await p.evaluate(()=>{document.querySelector('.CodeMirror').CodeMirror.setValue('UNSAVED AFTER CANCEL');window.showSaveFilePicker=async()=>{throw new DOMException('cancel','AbortError')}});let downloads=0;p.on('download',()=>downloads++);await click(p,'btnSaveAs');await p.waitForTimeout(100);rec('native-picker-cancel',{indicator:await p.locator('#statusReady').textContent(),downloads,content:await p.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.getValue())});
await click(p,'btnToggleWrap');await click(p,'statusLineEndings');await click(p,'statusTabSize');await click(p,'btnThemeToggle');await click(p,'btnColumnRuler');await click(p,'btnShowSymbols');await p.waitForTimeout(1000);const before=await p.evaluate(()=>({state:JSON.parse(localStorage.getItem('npp_studio_state_v1')),theme:localStorage.getItem('npp_theme')}));await p.reload();const after=await p.evaluate(()=>({state:JSON.parse(localStorage.getItem('npp_studio_state_v1')),theme:localStorage.getItem('npp_theme'),current:document.querySelector('.CodeMirror').CodeMirror.getValue()}));rec('normal-persistence-preferences',{before,after});
// Fill only this isolated, temporary-origin workspace to its genuine browser quota.
await p.evaluate(()=>{for(let i=0;i<30;i++){try{localStorage.setItem('reviewQuota'+i,'x'.repeat(250000))}catch(e){window.quotaFailure=e.name;break}}document.querySelector('.CodeMirror').CodeMirror.setValue('EDIT AFTER QUOTA '+ 'Z'.repeat(500000))});await p.waitForTimeout(1000);rec('genuine-storage-quota',{failure:await p.evaluate(()=>window.quotaFailure),toast:await p.locator('#toastMessage').textContent(),errors:await p.locator('.error-log-msg').allTextContents(),liveLength:await p.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.getValue().length),storedLength:await p.evaluate(()=>JSON.parse(localStorage.getItem('npp_studio_state_v1')).tabs[0].content.length)});await c.close();await b.close();
const status=cp.execFileSync('git',['--no-optional-locks','-C','C:/Git/notepad_studio','status','--short','--branch'],{encoding:'utf8'});const head=cp.execFileSync('git',['--no-optional-locks','-C','C:/Git/notepad_studio','rev-parse','HEAD'],{encoding:'utf8'}).trim();const raw=fs.readFileSync('C:/Git/notepad_studio/scripts/notepad-studio.html'),normalized=Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n'));rec('final-source-identity',{status,head,workingBytes:raw.length,workingSHA256:crypto.createHash('sha256').update(raw).digest('hex'),gitBytes:normalized.length,gitBlob:crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+normalized.length+'\0'),normalized])).digest('hex'),gitSHA256:crypto.createHash('sha256').update(normalized).digest('hex')});return records;
};

```

## Evidence checksums

```json
[
  {
    "name": "actual-export.diff",
    "bytes": 97,
    "sha256": "c5f677e9363004ea08a91556dd0b8d7086b6556fdf200a3f1e35ce2e99da9c46"
  },
  {
    "name": "binary.txt",
    "bytes": 11,
    "sha256": "9fa0442f931d16974abb310f39cbd031f64bb99219257a250dd369e635da9159"
  },
  {
    "name": "browser-evidence.json",
    "bytes": 20913,
    "sha256": "5c097f0e67cbd910d4eebf71631822ec70ca04c59e1d44a1083e9a05e068ed45"
  },
  {
    "name": "fallback-CRLF.txt",
    "bytes": 11,
    "sha256": "4854aaef74503959fd26363306e2ef967a9d50bdda90d033a3a4acacbbd57547"
  },
  {
    "name": "final-evidence.json",
    "bytes": 3630,
    "sha256": "2c5d391726ad9181319b579f0ccd26146f2e26fefd00d14dbc73087a4de3c235"
  },
  {
    "name": "latin1.txt",
    "bytes": 8,
    "sha256": "9c6717f8ebe14e932bfc577d9c776d16bf6746c2454c39b5bcfc78e2ab06047c"
  },
  {
    "name": "notepad-native-print.pdf",
    "bytes": 510523,
    "sha256": "b330409bcbeb283212c2de4167e918d691ecc4b12c045a4ac7928f8746a7f0de"
  },
  {
    "name": "print-chrome-file.pdf",
    "bytes": 503136,
    "sha256": "ef74363842889c46ba6db4ef16a8a2619c270fd71e67ffa5bde227edfd42c994"
  },
  {
    "name": "print-chrome-http.pdf",
    "bytes": 503136,
    "sha256": "13694ce66d885b7ab6ef2f22ca4b2c313dd1714f78fd8e25b0770dd882e63524"
  },
  {
    "name": "print-chromium-file.pdf",
    "bytes": 511451,
    "sha256": "e89b9fb2a484b103f73b6b06086a983a6cee6cb4fa50001088f4829a45b320e4"
  },
  {
    "name": "print-chromium-http.pdf",
    "bytes": 511451,
    "sha256": "0f71891e12782e536674820764d0afbd84726fa09150502fb673323b033e6fb1"
  },
  {
    "name": "print-inspection.json",
    "bytes": 1908,
    "sha256": "24f32135a63ecdffa83cfe9bc0bc7e5ecf674e6e5c4317cb40a4a6e9586ace1e"
  },
  {
    "name": "print-matrix.json",
    "bytes": 3976,
    "sha256": "bb20bba22bb43221e1649e9e2d99226a74d2b3ae5e6db77086750e01d1fe3932"
  },
  {
    "name": "print-msedge-file.pdf",
    "bytes": 503152,
    "sha256": "f8c7259a79f3b459d37b768eb00dea7149520903c858951ac3d76e49cd5f3fcc"
  },
  {
    "name": "print-msedge-http.pdf",
    "bytes": 503152,
    "sha256": "bd102c9cc9c445fc429328e5e2c2567c190b231ab6411219de72216e5db13378"
  },
  {
    "name": "supplement-evidence.json",
    "bytes": 5371,
    "sha256": "389b890b9e2a84bb66d7ea1910829e75854797698ef8e644bcb260a45498b4e8"
  },
  {
    "name": "utf8.txt",
    "bytes": 22,
    "sha256": "024c581595f4894c94b42bd6b3f07a024b6cad29af6805ba03738fe95d3b3aea"
  }
]
```
