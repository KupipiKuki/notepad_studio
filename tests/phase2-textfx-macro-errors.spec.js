// @ts-check
// Phase 2 regression specs: P12 (recoverable macro failures), P13 (undo and
// bookmark stability for search/TextFX/macro operations), P15 (listener-driven
// error Copy/Dismiss with exact fidelity), per fixtures P2-17..P2-22 of the
// Phase 2 coder handoff. TextFX exact outputs use Node-native oracles, not
// the app's own helpers.
import { test, expect } from '@playwright/test';

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const APP_FILE = path.resolve(__dirname, '..', 'scripts', 'notepad-studio.html');
const APP_URL = pathToFileURL(APP_FILE).href;

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

async function runTextFx(page, action) {
  await page.locator('#btnTextFxMenu').click();
  await page.locator('#textFxDropdown .dropdown-item[data-action="' + action + '"]').click();
  await page.waitForTimeout(80);
}

async function setSelection(page, from, to) {
  await page.evaluate(({ from, to }) => {
    document.querySelectorAll('.CodeMirror')[0].CodeMirror.setSelection(from, to);
  }, { from, to });
}

async function toast(page) {
  return page.evaluate(() => document.querySelector('#toastMessage').textContent);
}

// ---------------------------------------------------------------------------
// P2-17: every TextFX action produces its exact expected output (Node-native
// oracles), whole-document mode
// ---------------------------------------------------------------------------

test('P2-17a: text-structure TextFX actions have exact outputs', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'bb aa\naa bb')]));
  await runTextFx(page, 'sort-asc');
  expect(await getValue(page)).toBe('aa bb\nbb aa');
  await runTextFx(page, 'sort-desc');
  expect(await getValue(page)).toBe('bb aa\naa bb');
  await setValue(page, 'a\na\nb\na');
  await runTextFx(page, 'remove-duplicates');
  expect(await getValue(page)).toBe('a\nb');
  await setValue(page, '  x  \n y ');
  await runTextFx(page, 'trim-whitespace');
  expect(await getValue(page)).toBe('x\ny');
  await setValue(page, 'a\n\nb\n');
  await runTextFx(page, 'remove-blank-lines');
  expect(await getValue(page)).toBe('a\nb');
  await setValue(page, 'alpha beta');
  await runTextFx(page, 'to-upper');
  expect(await getValue(page)).toBe('ALPHA BETA');
  await runTextFx(page, 'to-lower');
  expect(await getValue(page)).toBe('alpha beta');
  await runTextFx(page, 'to-title');
  expect(await getValue(page)).toBe('Alpha Beta');
  await setValue(page, 'hello world');
  await runTextFx(page, 'to-camel');
  expect(await getValue(page)).toBe('helloWorld');
  expect(errors).toEqual([]);
});

test('P2-17b: JSON, Base64 and URL codecs have exact outputs and honest failures', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', '{"b":1,"a":[2]}')]));
  await runTextFx(page, 'format-json');
  expect(await getValue(page)).toBe('{\n  "b": 1,\n  "a": [\n    2\n  ]\n}');
  await runTextFx(page, 'minify-json');
  expect(await getValue(page)).toBe('{"b":1,"a":[2]}');

  // Unicode Base64 against a Node-native oracle
  await setValue(page, 'héllo 😀');
  await runTextFx(page, 'base64-encode');
  const expectedB64 = Buffer.from('héllo 😀', 'utf8').toString('base64');
  expect(await getValue(page)).toBe(expectedB64);
  await runTextFx(page, 'base64-decode');
  expect(await getValue(page)).toBe('héllo 😀');

  // Invalid Base64: no mutation, error surfaced
  await setValue(page, '###not-base64###');
  await runTextFx(page, 'base64-decode');
  expect(await getValue(page)).toBe('###not-base64###');
  expect(await toast(page)).toContain('Base64 error');
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');

  // URL codec, including a Unicode round trip and an invalid escape
  await setValue(page, 'a b&c é');
  await runTextFx(page, 'url-encode');
  expect(await getValue(page)).toBe(encodeURIComponent('a b&c é'));
  await runTextFx(page, 'url-decode');
  expect(await getValue(page)).toBe('a b&c é');
  await setValue(page, '%zz');
  await runTextFx(page, 'url-decode');
  expect(await getValue(page)).toBe('%zz');
  expect(await toast(page)).toContain('URL conversion error');

  // Invalid JSON: no mutation, error surfaced
  await setValue(page, 'not json');
  await runTextFx(page, 'format-json');
  expect(await getValue(page)).toBe('not json');
  expect(await toast(page)).toContain('Invalid JSON');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-17c: selection-only transforms preserve the untouched prefix/suffix
// ---------------------------------------------------------------------------

test('P2-17c: selection-only transforms keep prefix and suffix exactly', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'KEEP1\nbb aa\naa bb\nKEEP2')]));
  await setSelection(page, { line: 1, ch: 0 }, { line: 2, ch: 5 });
  await runTextFx(page, 'sort-asc');
  expect(await getValue(page)).toBe('KEEP1\naa bb\nbb aa\nKEEP2');

  await setValue(page, 'KEEP1\n  padded  \nKEEP2');
  await setSelection(page, { line: 1, ch: 0 }, { line: 2, ch: 0 });
  await runTextFx(page, 'trim-whitespace');
  expect(await getValue(page)).toBe('KEEP1\npadded\nKEEP2');

  await setValue(page, 'KEEP1\nmixed Case\nKEEP2');
  await setSelection(page, { line: 1, ch: 0 }, { line: 2, ch: 0 });
  await runTextFx(page, 'to-upper');
  expect(await getValue(page)).toBe('KEEP1\nMIXED CASE\nKEEP2');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-18: one logical undo per Replace All / TextFX; independent tab history;
// same-tab split stays coherent
// ---------------------------------------------------------------------------

test('P2-18: undo semantics are per-operation and per-tab', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([
    mkTab('a', 'alpha'),
    mkTab('b', 'beta')
  ]));

  // Replace All on tab a: exactly one undo restores the original
  await page.locator('.CodeMirror').first().click();
  await page.keyboard.press('Control+h');
  await page.waitForFunction(() => document.getElementById('findReplacePanel').classList.contains('show'));
  await page.locator('#frFindInput').fill('alpha');
  await page.locator('#frReplaceInput').fill('delta');
  await page.locator('#frReplaceAll').click();
  expect(await getValue(page)).toBe('delta');
  await page.locator('#btnUndo').click(); // one undo
  expect(await getValue(page)).toBe('alpha');
  await page.locator('#btnRedo').click();
  expect(await getValue(page)).toBe('delta');

  // TextFX on tab a is also one logical undo
  await runTextFx(page, 'sort-asc');
  await page.locator('#btnUndo').click();
  expect(await getValue(page)).toBe('delta');

  // Tab b's history is independent
  await page.locator('.tab-item').filter({ hasText: 'b.txt' }).click();
  await setValue(page, 'beta edited');
  await page.locator('#btnUndo').click();
  expect(await getValue(page)).toBe('beta'); // undid only b's edit, not a's

  // Same-tab split stays coherent through Replace All
  await page.locator('.tab-item').filter({ hasText: 'a.txt' }).click();
  await page.locator('#btnToggleSplit').click();
  await page.locator('#splitTabSelect').selectOption('a');
  await page.locator('#frReplaceAll').click(); // delta -> delta (query still alpha)
  await setValue(page, 'gamma', 0);
  expect(await getValue(page, 1)).toBe('gamma'); // secondary synced
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-19: bookmarks survive/shift/refresh correctly across search marking,
// transforms, deletion, undo and tab round trips
// ---------------------------------------------------------------------------

test('P2-19: bookmark model stays valid across operations and undo', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([
    mkTab('a', 'mark1\n\nother\nmark3'),
    { ...mkTab('b', 'zz\nbookmarkline'), bookmarks: [1] } // cross-tab bookmark isolation
  ]));

  // Mark lines matching 'mark' via the search panel: lines 0 and 3
  await page.locator('.CodeMirror').first().click();
  await page.keyboard.press('Control+h');
  await page.waitForFunction(() => document.getElementById('findReplacePanel').classList.contains('show'));
  await page.locator('#frFindInput').fill('mark');
  await page.locator('#frBookmarkMatches').click();
  await page.waitForTimeout(1000); // autosave
  let state = await stored(page);
  expect(state.tabs.find((t) => t.id === 'a').bookmarks).toEqual([0, 3]);

  // A line-deleting transform shifts the markers and the persisted model
  await runTextFx(page, 'remove-blank-lines');
  await page.waitForTimeout(1000);
  state = await stored(page);
  expect(state.tabs.find((t) => t.id === 'a').bookmarks).toEqual([0, 2]);

  // Delete the bookmarked lines: model emptied, no stale markers
  await page.locator('#btnBookmarksMenu').click();
  await page.locator('#bookmarksDropdown .dropdown-item[data-action="delete-bookmarked"]').click();
  await page.waitForTimeout(1000);
  state = await stored(page);
  expect(state.tabs.find((t) => t.id === 'a').bookmarks).toEqual([]);
  const gutterState = await page.evaluate(() => {
    const cm = document.querySelectorAll('.CodeMirror')[0].CodeMirror;
    const markers = [];
    for (let i = 0; i < cm.lineCount(); i++) {
      const info = cm.lineInfo(i);
      if (info.gutterMarkers && info.gutterMarkers['CodeMirror-bookmarks']) markers.push(i);
    }
    return { markers, value: cm.getValue() };
  });
  expect(gutterState.markers).toEqual([]);
  expect(gutterState.value).toBe('other');

  // Undo restores the lines; markers are not resurrected (defined policy) and
  // the persisted model reflects reality (no stale indices)
  await page.locator('#btnUndo').click();
  await page.waitForTimeout(1000);
  state = await stored(page);
  expect(state.tabs.find((t) => t.id === 'a').bookmarks).toEqual([]);
  expect(state.tabs.find((t) => t.id === 'a').content).toBe('mark1\nother\nmark3');

  // Tab b's bookmark survives independently across the round trip
  await page.reload({ waitUntil: 'load' });
  await page.locator('.CodeMirror').nth(1).waitFor({ state: 'attached' });
  state = await stored(page);
  expect(state.tabs.find((t) => t.id === 'b').bookmarks).toEqual([1]);
  await page.locator('.tab-item').filter({ hasText: 'b.txt' }).click();
  const bMarker = await page.evaluate(() => {
    const cm = document.querySelectorAll('.CodeMirror')[0].CodeMirror;
    return !!(cm.lineInfo(1).gutterMarkers && cm.lineInfo(1).gutterMarkers['CodeMirror-bookmarks']);
  });
  expect(bMarker).toBe(true);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-20: macro replay stops at the first failed action with accurate feedback
// ---------------------------------------------------------------------------

test('P2-20: macro stops at the first failed action and one Undo restores', async ({ page, context }) => {
  // Recording executes actions, so the macro is seeded as stored state to
  // replay from the original document text (the handoff fixture baseline)
  const errors = await openApp(page, context, mkState(
    [mkTab('a', 'not json\n\n')],
    { macroActions: ['to-upper', 'format-json', 'remove-blank-lines'] }
  ));

  await page.locator('#btnMacroPlay').click();
  // Step 1 applied; step 2 (format-json on "NOT JSON") failed; step 3 not run
  expect(await getValue(page)).toBe('NOT JSON\n\n');
  const t = await toast(page);
  expect(t).toContain('Macro stopped at step 2 of 3 (format-json)');
  expect(t).toContain('one Undo');
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors'); // cause logged

  // One undo restores the original (single logical operation)
  await page.locator('#btnUndo').click();
  expect(await getValue(page)).toBe('not json\n\n');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-21: recording state restored, no self-recording, invalid codec steps
// stop the macro, unknown restored actions are reported without data loss
// ---------------------------------------------------------------------------

test('P2-21a: replaying never appends replayed actions to the recorded list', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'ab')]));

  await page.locator('#btnMacroRecord').click();
  await runTextFx(page, 'to-upper');
  await page.locator('#btnMacroRecord').click();
  expect(await toast(page)).toBe('Macro saved (1 step)');

  // Replay twice: the replayed action is never recorded into the list
  await page.locator('#btnMacroPlay').click();
  expect(await getValue(page)).toBe('AB');
  await page.locator('#btnMacroPlay').click();
  expect(await toast(page)).toContain('Played macro (1 steps)'); // still 1 step, not 2
  await page.waitForTimeout(1000);
  const state = await stored(page);
  expect(state.macroActions).toEqual(['to-upper']); // no self-recording across replays
  const recBtn = await page.evaluate(() => ({
    recording: document.getElementById('btnMacroRecord').classList.contains('recording')
  }));
  expect(recBtn.recording).toBe(false); // replay leaves the recorder idle
  expect(errors).toEqual([]);
});

test('P2-21b: invalid Base64/URI steps stop the macro without mutation from the failed step', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'ok\n###')]));

  await page.locator('#btnMacroRecord').click();
  await runTextFx(page, 'to-upper');
  await runTextFx(page, 'base64-decode');
  await page.locator('#btnMacroRecord').click();

  await page.locator('#btnMacroPlay').click();
  expect(await getValue(page)).toBe('OK\n###'); // step 1 applied, step 2 failed
  expect(await toast(page)).toContain('Macro stopped at step 2 of 2 (base64-decode)');
  await page.locator('#btnUndo').click();
  expect(await getValue(page)).toBe('OK\n###'); // one undo restores the pre-replay text

  await setValue(page, '%zz');
  await page.locator('#btnMacroRecord').click();
  await runTextFx(page, 'url-decode');
  await page.locator('#btnMacroRecord').click();
  await page.locator('#btnMacroPlay').click();
  expect(await getValue(page)).toBe('%zz'); // failed step mutates nothing
  expect(await toast(page)).toContain('Macro stopped at step 1 of 1 (url-decode)');
  expect(errors).toEqual([]);
});

test('P2-21c: unknown restored actions stop the macro and erase nothing', async ({ page, context }) => {
  // Seeded workspace carries a legacy macro with an unknown action name
  const errors = await openApp(page, context, mkState(
    [mkTab('a', 'aB')],
    { macroActions: ['to-upper', 'nonexistent-action', 'to-lower'] }
  ));

  await page.locator('#btnMacroPlay').click();
  expect(await getValue(page)).toBe('AB'); // step 1 ran, step 2 unknown, step 3 not run
  const t = await toast(page);
  expect(t).toContain('Macro stopped at step 2 of 3 (nonexistent-action)'); // the unknown action is named
  // The unknown-action cause is durably logged, not only toasted
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');
  const logText = await page.evaluate(() => {
    document.getElementById('statusErrorIndicator').click();
    return [...document.querySelectorAll('#errorLogList .error-log-msg span')].map((s) => s.textContent).join(' | ');
  });
  expect(logText).toContain('Unknown TextFX action: nonexistent-action');

  // The stored macro list is intact — no silent erase
  await page.waitForTimeout(1000);
  const state = await stored(page);
  expect(state.macroActions).toEqual(['to-upper', 'nonexistent-action', 'to-lower']);
  expect(errors).toEqual([]);
});

test('P2-21d: a recorded macro persists across an unseeded reload', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'one two')]));

  await page.locator('#btnMacroRecord').click();
  await runTextFx(page, 'to-upper');
  await runTextFx(page, 'remove-blank-lines');
  await page.locator('#btnMacroRecord').click();
  await page.waitForTimeout(1000); // autosave persists macroActions

  await page.reload({ waitUntil: 'load' });
  await page.locator('.CodeMirror').nth(1).waitFor({ state: 'attached' });
  await page.locator('#btnMacroPlay').click();
  expect(await getValue(page)).toBe('ONE TWO');
  expect(await toast(page)).toContain('Played macro (2 steps)');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2-22 / P15: error Copy/Dismiss — exact multiline fidelity, listener routing,
// handled clipboard rejection, rerender-safe dismissal
// ---------------------------------------------------------------------------

test('P2-22: error Copy/Dismiss preserves exact messages and handles rejection', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]));
  const controlled = 'controlled: line1\nline2 \'q\' "dq" \\ back & <b> &amp; é 😀';

  // Two distinct entries with hostile content (multiline, quotes, backslashes,
  // entity-like text, Unicode) via the app's global error interceptor
  await page.evaluate((msg) => {
    setTimeout(() => { throw new Error(msg); }, 0);
    setTimeout(() => { throw new Error('second-entry'); }, 0);
  }, controlled);
  await page.waitForTimeout(300);
  await page.locator('#statusErrorIndicator').click();
  await page.waitForFunction(() => document.querySelectorAll('.error-log-row').length >= 2);

  const rows = page.locator('.error-log-row');
  expect(await rows.count()).toBeGreaterThanOrEqual(2);
  const firstMessage = await rows.first().locator('.error-log-msg span').first().textContent();
  expect(firstMessage).toContain(controlled); // exact multiline text survives the DOM

  // Copy with a clipboard boundary double: the copied text is byte-identical
  await page.evaluate(() => { window.__copied = []; });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve('ok'); } }
    });
  });
  await rows.first().locator('.error-log-copy-btn').click();
  const copied = await page.evaluate(() => window.__copied);
  expect(copied.length).toBe(1);
  expect(copied[0]).toBe(firstMessage); // exact original, once per click

  // Clipboard rejection is handled: no false success, no unhandled rejection
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) }
    });
  });
  await rows.first().locator('.error-log-copy-btn').click();
  await page.waitForTimeout(100);
  const t = await toast(page);
  expect(t).toContain('Copy failed');
  expect(t).not.toContain('copied to clipboard');
  expect(errors.filter((e) => !e.includes('controlled') && !e.includes('second-entry')))
    .toEqual([]); // only the two intended controlled errors reached the page

  // Dismiss removes only its own entry, and remains correct after rerender
  const before = await rows.count();
  await rows.first().locator('.error-log-dismiss-btn').click();
  expect(await page.locator('.error-log-row').count()).toBe(before - 1);
  // rerender (new error) then dismiss again: the closure targets the right entry
  await page.evaluate(() => { setTimeout(() => { throw new Error('third-entry'); }, 0); });
  await page.waitForTimeout(300);
  const remaining = await page.locator('.error-log-row').count();
  await page.locator('.error-log-row').last().locator('.error-log-dismiss-btn').click();
  expect(await page.locator('.error-log-row').count()).toBe(remaining - 1);

  // Unavailable clipboard: honest feedback, no false success
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await page.locator('.error-log-row').first().locator('.error-log-copy-btn').click();
  expect(await toast(page)).toContain('Clipboard unavailable');
});
