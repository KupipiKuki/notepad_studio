// @ts-check
// Phase 1 regression specs: P01/P02 (save-state integrity), P03 (corrupt-state
// recovery), P11 (save line-ending policy), P16 (persisted-model sanitization).
// Mirrors the Phase 0 audit fault-injection scenarios against the fixed code.
import { test, expect } from '@playwright/test';

const APP_URL = 'file:///C:/Git/notepad_studio/scripts/notepad-studio.html';
const APP_FILE = 'C:/Git/notepad_studio/scripts/notepad-studio.html';
const STATE_KEY = 'npp_studio_state_v1';
const RECOVERY_KEY = 'npp_studio_state_v1_recovery';

// Loopback HTTP origin: real browser downloads are validated on HTTP,
// matching the Phase 0 audit environment for download scenarios.
let httpBaseUrl = null;
async function startHttpApp() {
  if (httpBaseUrl) return httpBaseUrl;
  const fs = require('fs');
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

function mkState(tabs) {
  return {
    activeTabId: tabs[0].id, tabs, wordWrap: false, tabSize: 2,
    lineEnding: 'CRLF', macroActions: [], showSymbolsActive: false, rulerMode: 0
  };
}

async function openApp(page, context, seed, raw = null, url = APP_URL) {
  await context.addInitScript(({ seed, raw }) => {
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

// ---------------------------------------------------------------------------
// P01: a fallback (Blob download) save must not mark the document saved
// ---------------------------------------------------------------------------

test('P01: fallback download with suppressed click keeps dirty state honest', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'alpha\nbeta'), mkTab('b', 'reference')]));
  await setValue(page, 'changed but no file');
  await page.evaluate(() => {
    window.__anchorSuppressed = true;
    HTMLAnchorElement.prototype.click = function () {};
  });

  let downloads = 0;
  page.on('download', () => downloads++);
  await page.locator('#btnSaveFile').click();

  const state = await stored(page);
  const tab = state.tabs.find((t) => t.id === 'a');
  expect(downloads).toBe(0);
  expect(tab.content).toBe('changed but no file');
  expect(tab.savedContent).toBe('alpha\nbeta');
  expect(tab.dirty).toBe(true);
  await expect(page.locator('#statusReady')).toHaveText('Unsaved changes');
  await expect(page.locator('#toastMessage')).toContainText('Download started');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P01 + P11: a real fallback download keeps dirty state but produces the
// selected line-ending bytes exactly
// ---------------------------------------------------------------------------

test('P01/P11: real fallback download keeps honest state and exact CRLF bytes', async ({ page, context }) => {
  const baseUrl = await startHttpApp();
  const errors = await openApp(page, context, mkState([mkTab('a', 'alpha\nbeta'), mkTab('b', 'reference')]), null, baseUrl);
  await setValue(page, 'alpha\nbeta\nEDITED');
  await page.waitForTimeout(100); // dirty state settles via change handler
  const pendingDownload = page.waitForEvent('download');
  await page.locator('#btnSaveFile').click();
  const download = await pendingDownload;
  const path = await download.path();

  const fs = require('fs');
  const written = fs.readFileSync(path, 'utf8');
  expect(written).toBe('alpha\r\nbeta\r\nEDITED'); // selected CRLF policy on fallback downloads

  const state = await stored(page);
  const tab = state.tabs.find((t) => t.id === 'a');
  expect(tab.savedContent).toBe('alpha\nbeta'); // editor text, not normalized bytes
  expect(tab.dirty).toBe(true); // a download click is not disk confirmation
  await expect(page.locator('#statusReady')).toHaveText('Unsaved changes');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P02: edits made while a native write is pending must keep the tab dirty
// ---------------------------------------------------------------------------

test('P02: edit during pending native write keeps dirty and writes the snapshot', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'alpha\nbeta'), mkTab('b', 'reference')]));
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => ({
      name: 'fixture.txt',
      createWritable: async () => ({
        write: async (text) => { window.__written = text; },
        close: () => new Promise((resolve) => { window.__finishClose = resolve; })
      })
    });
  });

  await setValue(page, 'snapshot before\nwrite');
  await page.locator('#btnSaveAs').click();
  await page.waitForFunction(() => !!window.__finishClose);
  await setValue(page, 'EDIT DURING CLOSE');
  await page.evaluate(() => window.__finishClose());
  await page.waitForTimeout(150);

  const written = await page.evaluate(() => window.__written);
  expect(written).toBe('snapshot before\r\nwrite'); // P11: normalized CRLF in native write too

  const state = await stored(page);
  const tab = state.tabs.find((t) => t.id === 'a');
  expect(tab.content).toBe('EDIT DURING CLOSE');
  expect(tab.savedContent).toBe('snapshot before\nwrite');
  expect(tab.dirty).toBe(true);
  await expect(page.locator('#statusReady')).toHaveText('Unsaved changes');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P02: a tab switch while the Save As picker is pending must write the
// original tab's snapshot and resolve status against the original tab
// ---------------------------------------------------------------------------

test('P02: tab switch during pending Save As writes the original tab content', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'alpha\nbeta'), mkTab('b', 'reference')]));
  await page.evaluate(() => {
    window.showSaveFilePicker = () => new Promise((resolve) => {
      window.__finishPicker = () => resolve({
        name: 'picked.txt',
        createWritable: async () => ({
          write: async (text) => { window.__written = text; },
          close: async () => {}
        })
      });
    });
  });

  await setValue(page, 'ORIGINAL TAB CONTENT');
  await page.locator('#btnSaveAs').click();
  await page.locator('#btnNewFile').click();
  await setValue(page, 'SECOND TAB CONTENT');
  await page.evaluate(() => window.__finishPicker());
  await page.waitForTimeout(300);

  const written = await page.evaluate(() => window.__written);
  expect(written).toBe('ORIGINAL TAB CONTENT');

  const state = await stored(page);
  const original = state.tabs.find((t) => t.id === 'a');
  const created = state.tabs.find((t) => t.id !== 'a' && t.id !== 'b');
  expect(original.name).toBe('picked.txt');
  expect(original.content).toBe('ORIGINAL TAB CONTENT');
  expect(original.savedContent).toBe('ORIGINAL TAB CONTENT');
  expect(original.dirty).toBe(false);
  expect(created.content).toBe('SECOND TAB CONTENT');
  expect(created.dirty).toBe(true); // editor indicator must reflect this active tab
  await expect(page.locator('#statusReady')).toHaveText('Unsaved changes');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P02: a native save with no edits during I/O still reaches a clean state
// ---------------------------------------------------------------------------

test('P02: native save without races clears dirty state correctly', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'a\nb\nc\nthis is a save test\n'), mkTab('b', 'reference')]));
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => ({
      name: 'native.txt',
      createWritable: async () => ({
        write: async (text) => { window.__written = text; },
        close: async () => {}
      })
    });
  });

  const before = await getValue(page);
  await page.locator('#btnSaveAs').click();
  await page.waitForFunction(() => window.__written !== undefined);

  const written = await page.evaluate(() => window.__written);
  expect(written).toBe(before.replace(/\n/g, '\r\n')); // P11 policy applied to native write

  const state = await stored(page);
  const tab = state.tabs.find((t) => t.id === 'a');
  expect(tab.savedContent).toBe(before);
  expect(tab.content).toBe(before);
  expect(tab.dirty).toBe(false);
  await expect(page.locator('#statusReady')).toHaveText('Saved');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P02: cancelling the native picker must not clear dirty state
// ---------------------------------------------------------------------------

test('P02: picker cancellation keeps dirty state and starts no download', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'a\nb\nc\n'), mkTab('b', 'reference')]));
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => {
      throw new DOMException('cancel', 'AbortError');
    };
  });

  await setValue(page, 'UNSAVED AFTER CANCEL');
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.locator('#btnSaveAs').click();
  await page.waitForTimeout(100); // picker abort returns synchronously
  expect(downloads).toBe(0);
  await page.waitForTimeout(1000); // exceed the 800ms autosave debounce
  const state = await stored(page);
  const tab = state.tabs.find((t) => t.id === 'a');
  expect(tab.dirty).toBe(true);
  await expect(page.locator('#statusReady')).toHaveText('Unsaved changes');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P03: corrupt persisted state must enter recovery mode instead of being
// silently replaced by starter tabs
// ---------------------------------------------------------------------------

test('P03: corrupt stored workspace is preserved and surfaced for recovery', async ({ page, context }) => {
  const raw = '{broken recoverable workspace';
  const errors = await openApp(page, context, null, raw);

  const tabNames = await page.locator('.tab-title').allTextContents();
  expect(tabNames).toContain('workspace-recovery.json');
  expect(tabNames.length).toBeGreaterThanOrEqual(4); // 3 starter tabs + recovery tab

  const recoveryRaw = await page.evaluate(() => localStorage.getItem('npp_studio_state_v1_recovery'));
  expect(recoveryRaw).toBe(raw);

  // Autosave after an edit must not destroy the preserved backup of the raw payload
  await setValue(page, 'synthetic edit after recovery');
  await page.waitForTimeout(1200);
  const afterEditStorage = await page.evaluate(() => localStorage.getItem('npp_studio_state_v1'));
  const afterEditRecovery = await page.evaluate(() => localStorage.getItem('npp_studio_state_v1_recovery'));
  expect(afterEditRecovery).toBe(raw); // original corrupt payload still recoverable
  const parsed = JSON.parse(afterEditStorage);
  expect(parsed.tabs.some((t) => t.name === 'workspace-recovery.json' && t.content === raw)).toBe(true);
  expect(parsed.tabs.find((t) => t.name === 'welcome.txt').content).toBe('synthetic edit after recovery');
  expect(errors).toEqual([]);
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');
});

// ---------------------------------------------------------------------------
// P16: a malformed but parseable persisted model must be repaired in memory
// instead of crashing CodeMirror
// ---------------------------------------------------------------------------

test('P16: malformed persisted model is sanitized without bootstrap failure', async ({ page, context }) => {
  const malformed = JSON.stringify({
    activeTabId: 'dup',
    tabs: [
      { id: 'dup', name: 'bad.txt', content: 17, mode: 'bad', bookmarks: ['bad'] },
      { id: 'dup', name: 'also.txt', content: 'other' }
    ]
  });
  const errors = await openApp(page, context, null, malformed);

  expect(errors).toEqual([]); // baseline threw "e.split is not a function"

  // Boot does not autosave: touch one tab so the repaired model is persisted
  await page.locator('.tab-item').filter({ hasText: 'also.txt' }).click();
  await setValue(page, 'touched');
  await page.waitForTimeout(1200);

  const state = await stored(page);
  expect(state.tabs.length).toBe(2);
  const ids = state.tabs.map((t) => t.id);
  expect(new Set(ids).size).toBe(2); // duplicate ids regenerated
  const bad = state.tabs.find((t) => t.name === 'bad.txt');
  expect(bad.content).toBe('17'); // primitive preserved as string
  expect(bad.mode).toBe('text'); // invalid mode repaired via detectMode
  expect(bad.dirty).toBe(true); // recomputed from content vs savedContent ('')
  expect(bad.bookmarks).toEqual([]); // non-integer bookmarks dropped
  const also = state.tabs.find((t) => t.name === 'also.txt');
  expect(also.content).toBe('touched');

  // Repaired state keeps a backup of the original raw payload
  const recoveryRaw = await page.evaluate(() => localStorage.getItem('npp_studio_state_v1_recovery'));
  expect(recoveryRaw).toBe(malformed);
});
