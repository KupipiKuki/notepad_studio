// @ts-check
// Phase 1 completion specs: P09 (split-pane edit lifecycle) and P17
// (encoding/byte fidelity, binary and open-size policy).
// Mirrors the Phase 0 audit dispositions: P09 "same-tab split/save/close and
// broader lifecycle combinations remain unverified"; P17 "UTF-8 BOM removed on
// read; undecodable bytes replaced with U+FFFD; no unsupported-encoding/binary
// warning; large-file input limits unverified".
import { test, expect } from '@playwright/test';

// R04: resolve the application file from this spec's location (portable harness).
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const APP_FILE = path.resolve(__dirname, '..', 'scripts', 'notepad-studio.html');
const APP_URL = pathToFileURL(APP_FILE).href;

// Loopback HTTP origin: real browser downloads need HTTP for byte-round-trip
// assertions, matching the Phase 0 audit environment.
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

function mkState(tabs, lineEnding = 'CRLF') {
  return {
    activeTabId: tabs[0].id, tabs, wordWrap: false, tabSize: 2,
    lineEnding, macroActions: [], showSymbolsActive: false, rulerMode: 0
  };
}

async function openApp(page, context, seed, raw = null, url = APP_URL) {
  // R02-RL: seed isolated storage once per context; reloads must reopen the
  // bytes the app actually persisted.
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

// ---------------------------------------------------------------------------
// P09: same-tab split — primary edits must reach the secondary pane before the
// next split edit writes back, and the resulting tab must persist across reload
// ---------------------------------------------------------------------------

test('P09: same-tab split edits sync in both directions and survive a reload', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'ORIGINAL A'), mkTab('b', 'REFERENCE B')]));
  await page.locator('#btnToggleSplit').click();
  await page.locator('#splitTabSelect').selectOption('a'); // both panes on tab a

  // Primary edit must reach the secondary pane (regression: a stale secondary
  // value was previously written back over the tab and the primary editor)
  await setValue(page, 'PRIMARY EDIT', 0);
  await page.waitForTimeout(100);
  expect(await getValue(page, 1)).toBe('PRIMARY EDIT');

  // Secondary edit must write back to the tab and re-sync the primary pane
  await setValue(page, 'PRIMARY EDIT\nSECONDARY EDIT', 1);
  await page.waitForTimeout(100);
  expect(await getValue(page, 0)).toBe('PRIMARY EDIT\nSECONDARY EDIT');

  await page.waitForTimeout(1400); // exceed the 800ms autosave debounce
  const state = await stored(page);
  const tabA = state.tabs.find((t) => t.id === 'a');
  expect(tabA.content).toBe('PRIMARY EDIT\nSECONDARY EDIT');
  expect(tabA.dirty).toBe(true);
  expect(tabA.savedContent).toBe('ORIGINAL A'); // dirty keeps the save state honest

  // Unseeded reload: the persisted workspace must reopen with the same content
  await page.reload({ waitUntil: 'load' });
  await page.locator('.CodeMirror').nth(1).waitFor({ state: 'attached' });
  expect(await getValue(page, 0)).toBe('PRIMARY EDIT\nSECONDARY EDIT');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P09: closing a split-displayed dirty tab must repopulate the split view away
// from the closed tab and persist an intact workspace
// ---------------------------------------------------------------------------

test('P09: closing a split-displayed dirty tab repopulates the split and persists', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'KEEP A'), mkTab('b', 'ORPHAN B')]));
  await page.locator('#btnToggleSplit').click();
  await page.locator('#splitTabSelect').selectOption('b');
  await setValue(page, 'SECONDARY EDIT', 1); // b edited and dirtied in the split
  await page.waitForTimeout(100);

  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); return d.accept(); });
  await page.locator('.tab-item').filter({ hasText: 'b.txt' }).locator('.tab-close').click();

  expect(dialogs.length).toBe(1); // dirty-close confirmation was actually shown
  expect(dialogs[0]).toContain('unsaved changes');

  // The split select repopulated away from the closed, no-longer-existing tab
  const splitId = await page.evaluate(() => document.querySelector('#splitTabSelect').value);
  expect(splitId).toBe('a');
  expect(await getValue(page, 1)).toBe('KEEP A');

  await page.waitForTimeout(1400);
  const state = await stored(page);
  expect(state.tabs.length).toBe(1);
  expect(state.tabs.find((t) => t.id === 'a').content).toBe('KEEP A');

  await page.reload({ waitUntil: 'load' });
  await page.locator('.CodeMirror').nth(1).waitFor({ state: 'attached' });
  const reloaded = await stored(page);
  expect(reloaded.tabs.length).toBe(1); // workspace without b persisted and reopened
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P17: a UTF-8 BOM must survive open and save as exact bytes (regression: the
// BOM was silently removed on read)
// ---------------------------------------------------------------------------

test('P17: UTF-8 BOM survives open and save as exact bytes', async ({ page, context }) => {
  const baseUrl = await startHttpApp();
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')], 'LF'), null, baseUrl);
  const input = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('café\n', 'utf8')]);
  await page.locator('#fileInput').setInputFiles({ name: 'utf8bom.txt', mimeType: 'text/plain', buffer: input });
  await page.waitForTimeout(300);

  const text = await getValue(page);
  expect(text.charCodeAt(0)).toBe(0xFEFF); // BOM kept in the document
  expect(text.slice(1)).toBe('café\n');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('byte-order mark');
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors'); // durably surfaced

  const pendingDownload = page.waitForEvent('download');
  await page.locator('#btnSaveFile').click();
  const download = await pendingDownload;
  const written = fs.readFileSync(await download.path());
  expect([...written]).toEqual([...input]); // exact byte round trip (LF selected)
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P17: undecodable bytes must be reported honestly instead of silently
// replaced with U+FFFD; the lossy re-export is asserted as documented policy
// ---------------------------------------------------------------------------

test('P17: invalid UTF-8 bytes are reported and re-exported with the stated loss', async ({ page, context }) => {
  const baseUrl = await startHttpApp();
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')], 'LF'), null, baseUrl);
  const input = Buffer.from([0x63, 0x61, 0x66, 0xE9, 0x0A]); // Latin-1 "caf" + E9
  await page.locator('#fileInput').setInputFiles({ name: 'latin1.txt', mimeType: 'text/plain', buffer: input });
  await page.waitForTimeout(300);

  const text = await getValue(page);
  expect(text).toBe('caf\uFFFD\n'); // decode is lossy, but now it says so:
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('not valid UTF-8');
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');

  const pendingDownload = page.waitForEvent('download');
  await page.locator('#btnSaveFile').click();
  const download = await pendingDownload;
  const written = fs.readFileSync(await download.path());
  // The advertised loss: E9 does not come back; U+FFFD (EF BF BD) does
  expect([...written]).toEqual([...Buffer.from('caf\uFFFD\n', 'utf8')]);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P17 (hold follow-up): a BOM does not license a silent lossy decode — invalid
// UTF-8 after a UTF-8 BOM must produce the same data-loss warning, and the
// re-export must be asserted as the advertised loss
// ---------------------------------------------------------------------------

test('P17: invalid UTF-8 after a BOM still triggers the data-loss warning', async ({ page, context }) => {
  const baseUrl = await startHttpApp();
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')], 'LF'), null, baseUrl);
  const input = Buffer.concat([
    Buffer.from([0xEF, 0xBB, 0xBF]),
    Buffer.from([0x63, 0x61, 0x66, 0xE9, 0x0A]) // "caf" + Latin-1 E9 + LF
  ]);
  await page.locator('#fileInput').setInputFiles({ name: 'utf8bom-invalid.txt', mimeType: 'text/plain', buffer: input });
  await page.waitForTimeout(300);

  const text = await getValue(page);
  expect(text.charCodeAt(0)).toBe(0xFEFF); // BOM still preserved
  expect(text.slice(1)).toBe('caf\uFFFD\n');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('not valid UTF-8'); // the loss is reported, not bypassed
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');

  const pendingDownload = page.waitForEvent('download');
  await page.locator('#btnSaveFile').click();
  const download = await pendingDownload;
  const written = fs.readFileSync(await download.path());
  // The advertised loss: BOM kept, E9 replaced by U+FFFD (EF BF BD)
  expect([...written]).toEqual([...Buffer.concat([
    Buffer.from([0xEF, 0xBB, 0xBF]),
    Buffer.from('caf\uFFFD\n', 'utf8')
  ])]);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P17: apparent binary files must open with an explicit warning
// ---------------------------------------------------------------------------

test('P17: apparent binary files open with an explicit binary warning', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]));
  const input = Buffer.from([0x00, 0xFF, 0xFE, 0x80, 0x00]);
  await page.locator('#fileInput').setInputFiles({ name: 'binary.txt', mimeType: 'application/octet-stream', buffer: input });
  await page.waitForTimeout(300);

  expect(await getValue(page)).toBe('\u0000\uFFFD\uFFFD\uFFFD\u0000');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('appears to be binary');
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P17: files over the open limit must be refused with explicit feedback
// ---------------------------------------------------------------------------

test('P17: files over the open limit are refused with explicit feedback', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]));
  const before = await page.locator('.tab-item').count();
  const oversized = Buffer.alloc(3 * 1024 * 1024, 0x41); // 3 MB of 'A'
  await page.locator('#fileInput').setInputFiles({ name: 'big.txt', mimeType: 'text/plain', buffer: oversized });
  await page.waitForTimeout(300);

  expect(await page.locator('.tab-item').count()).toBe(before); // no tab created
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('open limit');
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');
  const state = await stored(page);
  expect(state.tabs.map((t) => t.id)).toEqual(['a']); // workspace untouched
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P17: UTF-16 BOM files must be decoded per their mark with an explicit notice
// (regression: FF FE was decoded as invalid UTF-8 and became U+FFFD noise)
// ---------------------------------------------------------------------------

test('P17: UTF-16LE BOM files are decoded with an explicit notice', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]));
  const input = Buffer.from([0xFF, 0xFE, 0x61, 0x00, 0x62, 0x00, 0x63, 0x00, 0x64, 0x00, 0x65, 0x00]); // UTF-16LE "abcde"
  await page.locator('#fileInput').setInputFiles({ name: 'utf16.txt', mimeType: 'text/plain', buffer: input });
  await page.waitForTimeout(300);

  expect(await getValue(page)).toBe('abcde'); // decoded by its byte-order mark
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('UTF-16LE');
  expect(toast).not.toContain('not valid'); // valid control: no false invalid-data warning
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors'); // notice durably surfaced
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P17 (G1 hold follow-up): malformed BOM-marked UTF-16 must not be decoded
// silently lossily — both LE and BE branches validate with fatal decoding and
// warn exactly like the UTF-8 branches. Fixtures from the independent G1
// review probe: a truncated final code unit becomes one U+FFFD.
// ---------------------------------------------------------------------------

test('P17: malformed UTF-16LE is reported and re-exported with the stated loss', async ({ page, context }) => {
  const baseUrl = await startHttpApp();
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]), null, baseUrl);
  // FF FE BOM + "abcde" + a truncated final LE code unit (0x66)
  const input = Buffer.from([0xFF, 0xFE, 0x61, 0x00, 0x62, 0x00, 0x63, 0x00, 0x64, 0x00, 0x65, 0x00, 0x66]);
  await page.locator('#fileInput').setInputFiles({ name: 'utf16le-bad.txt', mimeType: 'text/plain', buffer: input });
  await page.waitForTimeout(300);

  expect(await getValue(page)).toBe('abcde\uFFFD');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('not valid UTF-16LE'); // the loss is disclosed, not bypassed
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');

  const pendingDownload = page.waitForEvent('download');
  await page.locator('#btnSaveFile').click();
  const download = await pendingDownload;
  const written = fs.readFileSync(await download.path());
  // Documented output: the truncated unit is re-exported as U+FFFD (EF BF BD)
  expect([...written]).toEqual([...Buffer.from('abcde\uFFFD', 'utf8')]);
  expect(errors).toEqual([]);
});

test('P17: malformed UTF-16BE is reported and re-exported with the stated loss', async ({ page, context }) => {
  const baseUrl = await startHttpApp();
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]), null, baseUrl);
  // FE FF BOM + "abcde" BE + a truncated final BE code unit (0x00)
  const input = Buffer.from([0xFE, 0xFF, 0x00, 0x61, 0x00, 0x62, 0x00, 0x63, 0x00, 0x64, 0x00, 0x65, 0x00]);
  await page.locator('#fileInput').setInputFiles({ name: 'utf16be-bad.txt', mimeType: 'text/plain', buffer: input });
  await page.waitForTimeout(300);

  expect(await getValue(page)).toBe('abcde\uFFFD');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('not valid UTF-16BE');
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');

  const pendingDownload = page.waitForEvent('download');
  await page.locator('#btnSaveFile').click();
  const download = await pendingDownload;
  const written = fs.readFileSync(await download.path());
  expect([...written]).toEqual([...Buffer.from('abcde\uFFFD', 'utf8')]);
  expect(errors).toEqual([]);
});

test('P17: valid UTF-16BE decodes cleanly with no false invalid-data warning', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]));
  const input = Buffer.from([0xFE, 0xFF, 0x00, 0x61, 0x00, 0x62, 0x00, 0x63, 0x00, 0x64, 0x00, 0x65]); // UTF-16BE "abcde"
  await page.locator('#fileInput').setInputFiles({ name: 'utf16be.txt', mimeType: 'text/plain', buffer: input });
  await page.waitForTimeout(300);

  expect(await getValue(page)).toBe('abcde');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('UTF-16BE');
  expect(toast).not.toContain('not valid'); // valid control: no false invalid-data warning
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors'); // conversion notice durably surfaced
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// P17 / G1: the native showOpenFilePicker path must share the verified decode
// and size guard — file.text() silently stripped BOMs and replaced invalid
// UTF-8 without any warning, so "every open path" was not honest
// ---------------------------------------------------------------------------

function installNativePicker(page, files, writableCapture = false) {
  return page.evaluate(({ files, writableCapture }) => {
    window.__nativeWritten = null;
    window.showOpenFilePicker = async () => files.map((f) => ({
      name: f.name,
      getFile: async () => new File([new Uint8Array(f.bytes)], f.name, { type: 'text/plain' }),
      createWritable: writableCapture
        ? async () => ({ write: async (text) => { window.__nativeWritten = text; }, close: async () => {} })
        : undefined
    }));
  }, { files, writableCapture });
}

test('P17 native open: the picker path decodes through the verified pipeline', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]));
  // Same fixture as the input-path regression: UTF-8 BOM + "caf" + Latin-1 E9
  await installNativePicker(page, [{
    name: 'native-bom-invalid.txt',
    bytes: [0xEF, 0xBB, 0xBF, 0x63, 0x61, 0x66, 0xE9, 0x0A]
  }], true);
  await page.locator('#btnOpenFile').click();
  await page.waitForTimeout(300);

  const text = await getValue(page);
  expect(text.charCodeAt(0)).toBe(0xFEFF); // BOM not stripped by the native path
  expect(text.slice(1)).toBe('caf\uFFFD\n');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('not valid UTF-8'); // lossy decode reported, not bypassed
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');

  // The native handle was attached: a direct save writes through it with the
  // BOM preserved and the stated loss (U+FFFD) in the payload
  await page.locator('#btnSaveFile').click();
  await page.waitForFunction(() => window.__nativeWritten !== null);
  const written = await page.evaluate(() => window.__nativeWritten);
  expect(written).toBe('\uFEFFcaf\uFFFD\r\n'); // CRLF per selected line-ending policy
  const state = await stored(page);
  const tab = state.tabs.find((t) => t.name === 'native-bom-invalid.txt');
  expect(tab.savedContent).toBe('\uFEFFcaf\uFFFD\n'); // honest snapshot, not normalized bytes
  expect(tab.dirty).toBe(false);
  await expect(page.locator('#statusReady')).toHaveText('Saved');
  expect(errors).toEqual([]);
});

test('P17 native open: oversized files are refused with the same feedback', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]));
  await page.evaluate(() => {
    // 3 MB 'A' file built inside the page: no multi-megabyte serialization
    window.showOpenFilePicker = async () => [{
      name: 'native-big.txt',
      getFile: async () => new File([new Uint8Array(3 * 1024 * 1024).fill(0x41)], 'native-big.txt', { type: 'text/plain' }),
      createWritable: undefined
    }];
  });
  const before = await page.locator('.tab-item').count();
  await page.locator('#btnOpenFile').click();
  await page.waitForTimeout(400);

  expect(await page.locator('.tab-item').count()).toBe(before); // no tab created
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('open limit');
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');
  const state = await stored(page);
  expect(state.tabs.map((t) => t.id)).toEqual(['a']); // workspace untouched
  expect(errors).toEqual([]);
});

test('P17 native open: valid UTF-8 opens cleanly with no false warnings', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]));
  await installNativePicker(page, [{ name: 'native-clean.txt', bytes: [0x68, 0x65, 0x6C, 0x6C, 0x6F, 0x0A] }]);
  await page.locator('#btnOpenFile').click();
  await page.waitForTimeout(300);

  expect(await getValue(page)).toBe('hello\n');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('Created native-clean.txt'); // ordinary creation feedback, no policy noise
  await expect(page.locator('#statusErrorText')).toHaveText('0 Errors');
  expect(errors).toEqual([]);
});

test('P17 native open: malformed UTF-16LE through the picker gets the same policy', async ({ page, context }) => {
  const errors = await openApp(page, context, mkState([mkTab('a', 'seed')]));
  // G1 independent review: the native boundary must receive the same
  // malformed-UTF-16 disclosure as the input path (shared open pipeline)
  await installNativePicker(page, [{
    name: 'native-utf16le-bad.txt',
    bytes: [0xFF, 0xFE, 0x61, 0x00, 0x62, 0x00, 0x63, 0x00, 0x64, 0x00, 0x65, 0x00, 0x66]
  }]);
  await page.locator('#btnOpenFile').click();
  await page.waitForTimeout(300);

  expect(await getValue(page)).toBe('abcde\uFFFD');
  const toast = await page.evaluate(() => document.querySelector('#toastMessage').textContent);
  expect(toast).toContain('not valid UTF-16LE'); // same disclosure via the native boundary
  await expect(page.locator('#statusErrorText')).not.toHaveText('0 Errors');
  expect(errors).toEqual([]);
});
