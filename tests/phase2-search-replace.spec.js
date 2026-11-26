// @ts-check
// Phase 2 regression specs: P06 (All-Tabs occurrence counting), P07 (safe
// snippet rendering), P08 (consistent search/replace semantics), B01 (result
// freshness), per the fixture matrix P2-01..P2-16 + P2-23 of the Phase 2
// coder handoff.
import { test, expect } from '@playwright/test';

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const APP_FILE = path.resolve(__dirname, '..', 'scripts', 'notepad-studio.html');
const APP_URL = pathToFileURL(APP_FILE).href;

let httpBaseUrl = null;
async function startHttpApp() {
  if (httpBaseUrl) return httpBaseUrl;
  const http = require('http');
  const html = fs.readFileSync(APP_FILE);
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  httpBaseUrl = 'http://127.0.0.1:' + server.address().port;
  return httpBaseUrl;
}

function mkTab(id, content, name = id + '.txt') {
  return {
    id, name, content, savedContent: content, mode: 'text',
    dirty: false, bookmarks: []
  };
}

function mkState(tabs, extra = {}) {
  return {
    activeTabId: tabs[0].id, tabs, wordWrap: false, tabSize: 2,
    lineEnding: 'CRLF', macroActions: [], showSymbolsActive: false, rulerMode: 0,
    ...extra
  };
}

async function openApp(page, context, seed, raw = null, url = APP_URL) {
  // Seed once per isolated context; reloads reopen persisted bytes.
  await context.addInitScript(({ seed, raw }) => {
    if (localStorage.getItem('npp_studio_state_v1') !== null) return;
    if (raw !== null) {
      localStorage.setItem('npp_studio_state_v1', raw);
    } else {
      localStorage.setItem('npp_studio_state_v1', JSON.stringify(seed));
    }
  }, { seed, raw });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('.CodeMirror').nth(1).waitFor({ state: 'attached' });
  return errors;
}

async function setValue(page, text, pane = 0) {
  await page.evaluate(({ text, pane }) => {
    document.querySelectorAll('.CodeMirror')[pane].CodeMirror.setValue(text);
  }, { text, pane });
}

async function getValue(page, pane = 0) {
  return page.evaluate((pane) => {
    return document.querySelectorAll('.CodeMirror')[pane].CodeMirror.getValue();
  }, pane);
}

async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('npp_studio_state_v1')));
}

async function selection(page, pane = 0) {
  return page.evaluate((pane) => {
    const cm = document.querySelectorAll('.CodeMirror')[pane].CodeMirror;
    return { from: cm.getCursor('from'), to: cm.getCursor('to'), sel: cm.getSelection() };
  }, pane);
}

// Open the Find dialog through the editor keybinding; Ctrl+H also shows the
// Replace row, matching the Phase 0 audit environment.
async function openFind(page, withReplace = true) {
  await page.locator('.CodeMirror').first().click();
  await page.keyboard.press(withReplace ? 'Control+h' : 'Control+f');
  await page.waitForFunction(() => document.getElementById('findReplacePanel').classList.contains('show'));
}

async function fillFind(page, text) {
  const input = page.locator('#frFindInput');
  await input.fill('');
  await input.fill(text); // input event drives updateSearchResults
}

async function fillReplace(page, text) {
  await page.locator('#frReplaceInput').fill(text);
}

async function toggleFlag(page, flag) {
  const map = { case: '#frCaseBtn', word: '#frWordBtn', ext: '#frExtBtn', regex: '#frRegexBtn' };
  await page.locator(map[flag]).click();
}

async function matchCount(page) {
  return page.evaluate(() => document.getElementById('frMatchesCount').textContent);
}

async function drawerRows(page) {
  return page.evaluate(() => ({
    rowCount: document.querySelectorAll('#searchResultsList .search-result-row').length,
    groupCount: document.querySelectorAll('#searchResultsList .search-results-group').length,
    groupLabels: [...document.querySelectorAll('#searchResultsList .search-results-group')].map((g) => g.textContent),
    badge: document.getElementById('searchResultsBadge').textContent,
    status: document.getElementById('statusSearchText').textContent
  }));
}

async function findNext(page) {
  await page.locator('#frFindInput').press('Enter');
}

// ---------------------------------------------------------------------------
// P2-01 / P06: all occurrences counted and navigable, single-tab and All Tabs
// ---------------------------------------------------------------------------

test('P2-01: every occurrence is counted, navigable and identical across consumers', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([
    mkTab('a', 'needle needle needle'),
    mkTab('b', 'nothing here')
  ]));
  await openFind(page); // replace row shown by default
  await fillFind(page, 'needle');
  expect(await matchCount(page)).toBe('3 matches'); // exact, not one-per-line

  // Forward navigation reaches all three in order and wraps
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await findNext(page);
    seen.push((await selection(page)).from.ch);
  }
  expect(seen).toEqual([0, 7, 14, 0]);

  // All Tabs agrees with the single-tab count and every row navigates
  await page.locator('#frFindAllTabs').click();
  let drawer = await drawerRows(page);
  expect(drawer.badge).toBe('3');
  expect(drawer.rowCount).toBe(3);
  for (let i = 0; i < 3; i++) {
    await page.locator('#searchResultsList .search-result-row').nth(i).click();
  }
  const sel = await selection(page);
  expect([sel.from, sel.to]).toEqual([{ line: 0, ch: 14 }, { line: 0, ch: 20 }]);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-02 / B01: no accumulation; Clear removes rows and click targets
// ---------------------------------------------------------------------------

test('P2-02: repeated searches do not accumulate and Clear removes every row', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'needle needle needle')]));
  await openFind(page); // replace row shown by default
  await fillFind(page, 'needle');
  await page.locator('#frFindAllTabs').click();
  await page.locator('#frFindAllTabs').click(); // same search twice
  const drawer = await drawerRows(page);
  expect(drawer.rowCount).toBe(3); // not 6
  expect(drawer.groupCount).toBe(1);

  await page.locator('#btnClearSearchResults').click();
  const cleared = await drawerRows(page);
  expect(cleared.rowCount).toBe(0);
  expect(cleared.groupCount).toBe(0);
  expect(cleared.badge).toBe('0');
  expect(cleared.status).toBe('Search: 0');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-03: whole-word semantics honor case folding and exclude embedded words
// ---------------------------------------------------------------------------

test('P2-03: whole-word counting and navigation exclude embedded words', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'Cat cat scatter cat')]));
  await openFind(page); // replace row shown by default
  await fillFind(page, 'cat');
  await toggleFlag(page, 'word');

  expect(await matchCount(page)).toBe('3 matches'); // fold: 0, 4, 16 — not scatter's cat
  const foldSeen = [];
  for (let i = 0; i < 3; i++) {
    await findNext(page);
    foldSeen.push((await selection(page)).from.ch);
  }
  expect(foldSeen).toEqual([0, 4, 16]);

  await toggleFlag(page, 'case');
  expect(await matchCount(page)).toBe('2 matches'); // case-sensitive: 4, 16
  const caseSeen = [];
  for (let i = 0; i < 2; i++) {
    await findNext(page);
    caseSeen.push((await selection(page)).from.ch);
  }
  expect(caseSeen).toEqual([4, 16]);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-04: whole-word Replace works on valid selections and refuses the
// embedded word — selection validated in full-document context
// ---------------------------------------------------------------------------

test('P2-04: whole-word Replace applies to valid occurrences only', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'cat cat')]));
  await openFind(page, true);
  await fillFind(page, 'cat');
  await fillReplace(page, 'DOG');
  await toggleFlag(page, 'word');

  await page.evaluate(() => {
    document.querySelectorAll('.CodeMirror')[0].CodeMirror.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 3 });
  });
  await page.locator('#frReplace').click();
  expect(await getValue(page)).toBe('DOG cat');
  const sel = await selection(page); // moves to the next valid occurrence
  expect([sel.from, sel.to]).toEqual([{ line: 0, ch: 4 }, { line: 0, ch: 7 }]);

  // Selecting 'cat' inside 'scatter' is not a valid whole-word replacement
  await setValue(page, 'scatter cat');
  await page.evaluate(() => {
    document.querySelectorAll('.CodeMirror')[0].CodeMirror.setSelection({ line: 0, ch: 1 }, { line: 0, ch: 4 });
  });
  await page.locator('#frReplace').click();
  expect(await getValue(page)).toBe('scatter cat'); // no mutation
  const sel2 = await selection(page); // navigated to the real whole word
  expect([sel2.from, sel2.to]).toEqual([{ line: 0, ch: 8 }, { line: 0, ch: 11 }]);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-05: identical capture semantics in Replace and Replace All
// ---------------------------------------------------------------------------

test('P2-05: regex captures behave identically in Replace and Replace All', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'ab12 ab34')]));
  await openFind(page, true);
  await fillFind(page, '(ab)(\\d+)');
  await fillReplace(page, '$2-$1');
  await toggleFlag(page, 'regex');
  expect(await matchCount(page)).toBe('2 matches');

  await page.evaluate(() => {
    document.querySelectorAll('.CodeMirror')[0].CodeMirror.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 4 });
  });
  await page.locator('#frReplace').click();
  expect(await getValue(page)).toBe('12-ab ab34');

  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('12-ab 34-ab');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-06: literal replacement stays literal; documented regex expansion
// ---------------------------------------------------------------------------

test('P2-06: $-sequences in replacement text are literal off-regex, expanded on-regex', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'alpha & beta')]));
  await openFind(page, true);
  await fillFind(page, 'alpha');
  await fillReplace(page, '$1 $& \\ " \' & end');

  // Regex off: exact literal output
  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('$1 $& \\ " \' & end & beta');

  // Regex on: documented JavaScript expansion ($& -> match; $1 with no
  // capture groups stays literal per the JS replacement-token spec)
  await setValue(page, 'alpha & beta');
  await toggleFlag(page, 'regex');
  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('$1 alpha \\ " \' & end & beta');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-07: zero-width regex matches: counted, navigable, replaced, no hang
// ---------------------------------------------------------------------------

test('P2-07: zero-width lookahead occurrences count, navigate and replace exactly', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'aaa')]));
  await openFind(page, true);
  await fillFind(page, '(?=a)');
  await fillReplace(page, 'X');
  await toggleFlag(page, 'regex');

  expect(await matchCount(page)).toBe('3 matches'); // not one-per-line
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await findNext(page);
    seen.push((await selection(page)).from.ch);
  }
  expect(seen).toEqual([0, 1, 2, 0]); // all three zero-width positions reached, cyclic

  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('XaXaXa');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('Replaced 3 occurrences');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-08: anchor contract on empty and line-anchored documents
// ---------------------------------------------------------------------------

test('P2-08: anchors follow the declared regex contract', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', '')]));
  await openFind(page, true);
  await fillFind(page, '^$');
  await fillReplace(page, 'X');
  await toggleFlag(page, 'regex');
  expect(await matchCount(page)).toBe('1 match'); // empty doc: one valid match
  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('X');

  await setValue(page, 'a\nb');
  await fillFind(page, '^a');
  await fillReplace(page, 'Y');
  expect(await matchCount(page)).toBe('1 match'); // no implicit m flag
  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('Y\nb');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-09: extended escapes in find and replace; literal backslash combinations
// ---------------------------------------------------------------------------

test('P2-09: extended \\n/\\t escapes and doubled backslashes parse left-to-right', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'a\nb')]));
  await openFind(page, true);
  await fillFind(page, '\\n');
  await fillReplace(page, '\\t');
  await toggleFlag(page, 'ext');
  expect(await matchCount(page)).toBe('1 match');
  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('a\tb');

  // A doubled backslash keeps the following character literal
  await setValue(page, 'a\\nb'); // characters: a, backslash, n, b
  await fillReplace(page, '_');
  await fillFind(page, '\\\\n'); // input: backslash backslash n -> literal "\n"
  expect(await matchCount(page)).toBe('1 match');
  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('a_b');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-10: multiline regex matches carry full-document ranges
// ---------------------------------------------------------------------------

test('P2-10: a multiline regex match is counted once with a full range', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'ab\ncd\nab')]));
  await openFind(page, true);
  await fillFind(page, 'ab\\ncd');
  await fillReplace(page, 'X');
  await toggleFlag(page, 'regex');
  expect(await matchCount(page)).toBe('1 match');

  await findNext(page);
  const sel = await selection(page);
  expect([sel.from, sel.to]).toEqual([{ line: 0, ch: 0 }, { line: 1, ch: 2 }]);

  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('X\nab');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-11: surrogate pairs — coordinates are UTF-16 code units, never split
// ---------------------------------------------------------------------------

test('P2-11: positions after emoji are exact UTF-16 code-unit offsets', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', '😀a😀a')]));
  await openFind(page); // replace row shown by default
  await fillFind(page, 'a');
  expect(await matchCount(page)).toBe('2 matches');
  const seen = [];
  for (let i = 0; i < 2; i++) {
    await findNext(page);
    const s = await selection(page);
    seen.push([s.from.ch, s.to.ch]);
  }
  expect(seen).toEqual([[2, 3], [5, 6]]); // ch=2 and ch=5 on line 0
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-12 / P07: snippets and highlights are built from source text — entity
// queries find real source characters, nothing is parsed as markup
// ---------------------------------------------------------------------------

test('P2-12: entity-like source renders faithfully with source-range highlights', async ({ page, context }) => {
  const docText = 'x = "&amp; <b> if (a && b)"';
  const errors = await openApp(page, context, mkState([mkTab('a', docText)]));
  await openFind(page); // replace row shown by default
  await fillFind(page, '&');
  await page.locator('#frFindAllTabs').click();
  let drawer = await drawerRows(page);
  expect(drawer.rowCount).toBe(3); // two in && plus the one in &amp;
  const row = page.locator('#searchResultsList .search-result-row').first();
  const text = await row.evaluate((el) => el.textContent);
  // textContent carries the raw source characters; no &amp;-style corruption
  expect(text.replace('Line 1: ', '')).toBe(docText);
  const hitText = await row.locator('.search-result-hit').textContent();
  expect(hitText).toBe('&'); // highlight from the source range
  expect(await row.locator('b').count()).toBe(0); // <b> never parsed as markup

  // Querying '<' highlights the real source '<' without entity distortion
  await fillFind(page, '<');
  await page.locator('#frFindAllTabs').click();
  drawer = await drawerRows(page);
  const hit2 = await page.locator('#searchResultsList .search-result-row .search-result-hit').first().textContent();
  expect(hit2).toBe('<');

  // 'amp' inside the entity-like text is highlighted exactly
  await fillFind(page, 'amp');
  await page.locator('#frFindAllTabs').click();
  drawer = await drawerRows(page);
  expect(drawer.rowCount).toBe(1);
  const hit3 = await page.locator('#searchResultsList .search-result-row .search-result-hit').first().textContent();
  expect(hit3).toBe('amp');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-13: hits past the 200-char snippet window keep true coordinates; identity
// is the tab ID, so duplicate filenames navigate correctly
// ---------------------------------------------------------------------------

test('P2-13: deep hits keep true coordinates and duplicate filenames navigate by tab ID', async ({ page, context }) => {
  const deepLine = 'y'.repeat(300) + 'NEEDLE' + 'y'.repeat(50);
  const errors = await openApp(page, context, mkState([
    mkTab('a', deepLine, 'doc.txt'),
    mkTab('b', 'NEEDLE here', 'doc.txt') // same filename, different tab
  ]));
  await openFind(page); // replace row shown by default
  await fillFind(page, 'NEEDLE');
  await page.locator('#frFindAllTabs').click();
  const drawer = await drawerRows(page);
  expect(drawer.groupCount).toBe(2); // duplicate filenames permitted
  expect(drawer.groupLabels.every((l) => l.includes('doc.txt'))).toBe(true);
  expect(drawer.badge).toBe('2');

  // The deep hit shows a truncated excerpt but the true coordinate is intact
  const deepRow = page.locator('#searchResultsList .search-result-row').first();
  const rowText = await deepRow.textContent();
  expect(rowText).toContain('…'); // truncation is explicitly identified
  const deepHit = await deepRow.locator('.search-result-hit').textContent();
  expect(deepHit).toBe('NEEDLE');

  // Click the second tab's row: the right tab becomes active despite equal names
  await page.locator('#searchResultsList .search-result-row').nth(1).click();
  expect(await getValue(page)).toBe('NEEDLE here'); // tab b's document is live
  let sel = await selection(page);
  expect([sel.from, sel.to]).toEqual([{ line: 0, ch: 0 }, { line: 0, ch: 6 }]);

  // The deep row navigates to the true position in the first tab
  await page.locator('#searchResultsList .search-result-row').first().click();
  expect(await getValue(page)).toBe(deepLine); // tab a's document is live
  sel = await selection(page);
  expect([sel.from, sel.to]).toEqual([{ line: 0, ch: 300 }, { line: 0, ch: 306 }]);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-14 / B01: results are invalidated on edits, query changes, split edits
// and tab closure — never stale
// ---------------------------------------------------------------------------

test('P2-14: results are invalidated on content, query, split and tab changes', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([
    mkTab('a', 'needle text'),
    mkTab('b', 'other needle')
  ]));
  await openFind(page); // replace row shown by default
  await fillFind(page, 'needle');
  await page.locator('#frFindAllTabs').click();
  expect((await drawerRows(page)).badge).toBe('2');

  // Edit the primary editor: results are invalidated
  await setValue(page, 'needle text edited');
  let drawer = await drawerRows(page);
  expect(drawer.badge).toBe('0');
  expect(drawer.rowCount).toBe(0);

  // Re-search, then change the query: invalidated again
  await page.locator('#frFindAllTabs').click();
  expect((await drawerRows(page)).badge).toBe('2');
  await fillFind(page, 'zzz-nothing');
  drawer = await drawerRows(page);
  expect(drawer.rowCount).toBe(0);

  // Re-search, edit in the secondary split pane: invalidated
  await fillFind(page, 'needle');
  await page.locator('#frFindAllTabs').click();
  expect((await drawerRows(page)).badge).toBe('2');
  await page.locator('#btnToggleSplit').click();
  await page.locator('#splitTabSelect').selectOption('b');
  await setValue(page, 'other needle split-edited', 1);
  drawer = await drawerRows(page);
  expect(drawer.badge).toBe('0');
  expect(drawer.rowCount).toBe(0);

  // Re-search, close a hit tab: no clickable reference to the closed tab
  await page.locator('#frFindAllTabs').click();
  expect((await drawerRows(page)).badge).toBe('2');
  page.on('dialog', (d) => d.accept()); // tab b is dirty from the split edit
  await page.locator('.tab-item').filter({ hasText: 'b.txt' }).locator('.tab-close').click();
  drawer = await drawerRows(page);
  expect(drawer.rowCount).toBe(0);
  expect(drawer.badge).toBe('0');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-15: exact counts at scale — no silent 999/10,000 boundaries
// ---------------------------------------------------------------------------

test('P2-15: 1,500 occurrences and 10,050 replacements are exact', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'x needle'.repeat(1500))]));
  await openFind(page, true);
  await fillFind(page, 'needle');
  await fillReplace(page, 'yyy');
  expect(await matchCount(page)).toBe('1500 matches'); // not '999+'

  await page.locator('#frReplaceAll').click();
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('Replaced 1500 occurrences');
  expect(await getValue(page)).not.toContain('needle');

  await setValue(page, 'a'.repeat(10050));
  await fillFind(page, 'a');
  await fillReplace(page, 'b');
  await page.locator('#frReplaceAll').click(); // no silent 10,000 cutoff
  const value = await getValue(page);
  expect(value.length).toBe(10050);
  expect(value).not.toContain('a');
  const toast2 = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast2).toContain('Replaced 10050 occurrences');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-16: inserted replacement text is never re-searched
// ---------------------------------------------------------------------------

test('P2-16: Replace All a -> aa on "a" is exactly one replacement', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'a')]));
  await openFind(page, true);
  await fillFind(page, 'a');
  await fillReplace(page, 'aa');
  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('aa');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('Replaced 1 occurrence');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-23: invalid regex is distinct from zero results; no mutation, no stale rows
// ---------------------------------------------------------------------------

test('P2-23: invalid regex feedback is honest and keeps nothing actionable', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'stable content')]));
  await openFind(page, true);
  await fillFind(page, 'cont');
  await page.locator('#frFindAllTabs').click();
  expect((await drawerRows(page)).rowCount).toBe(1);

  // An invalid query must not mutate text or retain old actionable results
  await toggleFlag(page, 'regex');
  await fillFind(page, '[unclosed');
  expect(await matchCount(page)).toBe('Invalid regex');
  let drawer = await drawerRows(page);
  expect(drawer.rowCount).toBe(0); // previous rows invalidated
  expect(await getValue(page)).toBe('stable content');

  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('stable content'); // no mutation
  await page.locator('#frFindAllTabs').click();
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('Invalid regex');

  // A valid zero-result query is distinct from an invalid one
  await fillFind(page, 'zzz-missing');
  expect(await matchCount(page)).toBe('No matches');
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors'); // compile error logged
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// Origin matrix: the same contract holds on file:// and the loopback HTTP origin
// ---------------------------------------------------------------------------

test('origin matrix: core search contract holds on file and HTTP origins', async ({ page, context }) => {
  const results = {};
  for (const [label, url] of [['file', APP_URL], ['http', await startHttpApp()]]) {
    await openApp(page, context, mkState([mkTab('a', 'needle needle needle')], undefined), null, url);
    await openFind(page, true);
    await fillFind(page, 'needle');
    const literalCount = await matchCount(page);

    await fillFind(page, '(?=n)');
    await toggleFlag(page, 'regex');
    const zeroWidthCount = await matchCount(page);

    await fillFind(page, '&');
    await toggleFlag(page, 'regex');
    await page.locator('#frFindAllTabs').click();
    const drawer = await drawerRows(page);
    const safeSnippet = drawer.rowCount === 0; // no & in this doc: honest zero
    results[label] = { literalCount, zeroWidthCount, safeSnippet };
  }
  expect(results.file).toEqual({ literalCount: '3 matches', zeroWidthCount: '3 matches', safeSnippet: true });
  expect(results.http).toEqual(results.file);
});
