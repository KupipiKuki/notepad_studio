# Notepad Studio — Phase 1 G1 acceptance decision

Decision date: November 26, 2026 (America/New_York).

**Decision: G1 PASS for the documented browser and API-boundary test scope at the frozen candidate below.** The malformed UTF-16 warning hold is closed. Earlier accepted save, recovery, split-pane and open-policy corrections remain credited. This decision supersedes the HOLD disposition in the independent G1 review for the older candidate 1779d56; that report remains historical evidence.

## Frozen candidate

| Item | Identity |
| --- | --- |
| Repository / branch | KupipiKuki/notepad_studio / wp/phase1 |
| Accepted head | `9589f09aa50b2d5afb8784059431ff67c2737cfd` |
| Application blob | `3393b0f2acd0a2662f3467adcc84ed1c041eb9db` |
| Split/encoding spec blob | `421b9a2c2b202b27414f546e132859bb74e4a6d5` |
| Save/recovery spec blob | `ab5ec9cc2715b8a816505a758467e74879368d28` (unchanged) |
| Previous held head | `1779d56b1f6dfe67f78f8c6a8fc4d4b15273f28f` |

The local checkout left from earlier work is not the accepted snapshot. This review used immutable remote source and evidence at the accepted head. No repository files, branches, tests, workflow or Git refs were modified.

## Verified correction

The UTF-16LE and UTF-16BE BOM branches of decodeFileBuffer now try fatal decoding first. If malformed input is encountered, the explicitly chosen fallback policy returns U+FFFD with an encoding-specific warning that re-saving cannot reproduce the original bytes. The ordinary UTF-16-to-UTF-8 conversion notice remains distinct.

Independent exact-function checks on the accepted decoder passed for:

- Valid UTF-16LE and UTF-16BE controls: abcde, no invalid-data warning.
- The prior hold's exact truncated-unit LE and BE fixtures: abcde followed by U+FFFD, correct LE/BE loss warning, UTF-8 output hex 6162636465efbfbd.
- Valid UTF-8 BOM control: preserved BOM and valid text, no loss warning.
- Invalid UTF-8 after BOM: preserved BOM, replacement character and explicit loss warning.

These are Node function-level assertions with synthetic byte buffers, not a fresh integrated-browser run by this reviewer. The reproducible probe is embedded below.

## Regression and CI evidence

The committed split/encoding spec now has 15 scenarios, alongside 15 save/recovery scenarios. New assertions cover malformed LE/BE input, warning toast and log presence, exact advertised output bytes, a valid BE control, no false invalid-data warning for valid LE, and the same malformed-LE policy through a synthetic native picker boundary.

The implementation record's follow-up reports 60 passed / 0 failed / 0 skipped locally and records fail-without-fix results for the malformed-data tests. Those local/negative-control runs were not rerun by this reviewer.

The independently checked current-head [Ubuntu CI run 45827805830](https://github.com/KupipiKuki/notepad_studio/actions/runs/45827805830) completed successfully. The job's decoded execution log records:

```text
npx playwright test tests/phase1-save-recovery.spec.js tests/phase1-split-encoding.spec.js --project=chromium --project=firefox
60 passed (1.3m)
```

The run targets accepted head 9589f09 on wp/phase1; the job and every step succeeded. The previous code-commit run 45826357108 also succeeded. Acceptance is supported by direct current-head CI evidence, source review, committed assertions and the independent decoder checks rather than by a test-count claim alone.

## Consolidated G1 disposition

The plan defines G1 as no silent loss or false clean state in the tested save/cancel/permission/quota/split-edit scenarios, with exact bytes and states matching the supported format and line-ending policy.

| Requirement | Disposition in the accepted tested scope |
| --- | --- |
| Honest download initiation vs native write completion; dirty state | PASS — prior P01/P11 assertions retained and passing |
| Async native snapshots and original-tab completion/fallback | PASS — prior P02/R03 assertions retained and passing |
| Recovery preservation, quota/denied writes, guard across unseeded reload | PASS — prior P03/R01/R02/R02-RL assertions retained and passing |
| Persisted-model repair with recoverable originals | PASS — prior P16 and repair-preservation regressions retained and passing |
| Split editing, dirty close/repopulation, autosave/reload | PASS — P09 regressions retained and passing |
| Shared input/drag-drop/native open policy with size guard | PASS — one shared source path, input/native-boundary regressions passing |
| Explicit encoding/BOM/line-ending policy and loss warnings | PASS — UTF-8, UTF-16LE/BE controls and malformed-input regressions passing |
| Current frozen-candidate suite in intended CI environment | PASS — exact-head Ubuntu run, 60 passed |

The earlier 52-test QA report describes the preceding shared-open pipeline candidate. Its source hash/counts should remain identified as historical. The implementation record's UTF-16 follow-up, the current-head CI run and this gate decision provide the updated disposition.

## Limits carried forward

This G1 PASS is scoped to the documented tested behavior. It does not claim:

- Validation of real Windows picker dialogs, OS permission grants or actual native filesystem writes. Native tests use synthetic handles at the browser API boundary; actual browser downloads are asserted separately.
- WebKit/Safari coverage or a full four-browser/origin rerun.
- Support for unmarked UTF-16 or opens larger than 2 MiB (the latter are explicitly refused).
- Lossless round-trip preservation of invalid input or original UTF-16 bytes. The accepted policy discloses lossy decoding where needed and saves UTF-8 with the selected line-ending normalization.
- Release/merge approval, Phase 2+ closure or architectural migration gate acceptance.

These are explicit validation/support limits, not passed tests. Preserve them in subsequent handoffs and release records.

## Workflow handoff

Phase 1 G1 is accepted in the scope above. The next workflow step is Phase 2 review/implementation planning for search, replacement and transformations (P06–P08, P12–P13, P15), retaining prior baseline findings such as stale search rows where relevant. No Phase 2 code was started by this review. No merge or deployment was performed.

## Primary records

- [Accepted source](https://github.com/KupipiKuki/notepad_studio/blob/9589f09aa50b2d5afb8784059431ff67c2737cfd/scripts/notepad-studio.html)
- [Consolidated G1 record and UTF-16 follow-up](https://github.com/KupipiKuki/notepad_studio/blob/9589f09aa50b2d5afb8784059431ff67c2737cfd/docs/remediation/Notepad_Studio_Phase1_G1_Evidence.md)
- [Committed split/encoding regressions](https://github.com/KupipiKuki/notepad_studio/blob/9589f09aa50b2d5afb8784059431ff67c2737cfd/tests/phase1-split-encoding.spec.js)
- [Current-head CI](https://github.com/KupipiKuki/notepad_studio/actions/runs/45827805830)
- [Prior independent HOLD and exact fixtures](https://github.com/KupipiKuki/notepad_studio/blob/9589f09aa50b2d5afb8784059431ff67c2737cfd/docs/audit/Notepad_Studio_G1_Independent_Review.md)

## Independent decoder probe

```javascript
  function decodeFileBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    const warnings = [];
    const infos = [];
    let text = '';

    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      // G1 hold follow-up: validate the UTF-16 body like the UTF-8 bodies —
      // malformed code units must produce an explicit data-loss warning
      // instead of a silent U+FFFD replacement.
      const body = bytes.subarray(2);
      try {
        text = new TextDecoder('utf-16le', { fatal: true }).decode(body);
      } catch (e) {
        text = new TextDecoder('utf-16le').decode(body);
        warnings.push('File contained bytes that are not valid UTF-16LE; they are shown as U+FFFD and re-saving will not reproduce the original bytes.');
      }
      infos.push('File decoded as UTF-16LE (byte-order mark detected); saved files are UTF-8.');
    } else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      const body = bytes.subarray(2);
      try {
        text = new TextDecoder('utf-16be', { fatal: true }).decode(body);
      } catch (e) {
        text = new TextDecoder('utf-16be').decode(body);
        warnings.push('File contained bytes that are not valid UTF-16BE; they are shown as U+FFFD and re-saving will not reproduce the original bytes.');
      }
      infos.push('File decoded as UTF-16BE (byte-order mark detected); saved files are UTF-8.');
    } else if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      // Keep the BOM as part of the document so saves reproduce the original
      // byte prefix instead of silently dropping it on read. The body must be
      // validated too: invalid UTF-8 after a BOM is still a lossy decode and
      // must produce the same data-loss warning as any other payload.
      const body = bytes.subarray(3);
      try {
        text = '\uFEFF' + new TextDecoder('utf-8', { fatal: true }).decode(body);
      } catch (e) {
        text = '\uFEFF' + new TextDecoder('utf-8').decode(body);
        warnings.push('File contained bytes that are not valid UTF-8; they are shown as U+FFFD and re-saving will not reproduce the original bytes.');
      }
      infos.push('UTF-8 byte-order mark detected; it is preserved in the document and in saves.');
    } else {
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch (e) {
        text = new TextDecoder('utf-8').decode(bytes);
        warnings.push('File contained bytes that are not valid UTF-8; they are shown as U+FFFD and re-saving will not reproduce the original bytes.');
      }
    }

    // Binary heuristic: control characters (tab/newline excepted) dominating
    // the content, or a high density of decode placeholders, means "binary";
    // the user must know editing it as text is lossy. Sparse placeholders (a
    // few undecodable bytes in a text file) stay a decode warning, not a
    // binary classification.
    let control = 0;
    let placeholders = 0;
    let counted = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c === 9 || c === 10 || c === 13 || c === 0xFEFF) continue;
      counted++;
      if (c < 32 || c === 0x7F) control++;
      if (c === 0xFFFD) placeholders++;
    }
    if (counted > 0 && (control / counted > 0.10 || placeholders / counted > 0.30)) {
      warnings.push('File appears to be binary (control/undecodable characters dominate); editing it as text may corrupt it.');
    }

    return { text: text, warnings: warnings, infos: infos };
  }

const assert=require('node:assert/strict');
const cases=[
{name:'valid UTF-16LE',bytes:[0xff,0xfe,0x61,0,0x62,0,0x63,0,0x64,0,0x65,0],expected:'abcde',warn:null},
{name:'malformed UTF-16LE',bytes:[0xff,0xfe,0x61,0,0x62,0,0x63,0,0x64,0,0x65,0,0x66],expected:'abcde\uFFFD',warn:'not valid UTF-16LE'},
{name:'valid UTF-16BE',bytes:[0xfe,0xff,0,0x61,0,0x62,0,0x63,0,0x64,0,0x65],expected:'abcde',warn:null},
{name:'malformed UTF-16BE',bytes:[0xfe,0xff,0,0x61,0,0x62,0,0x63,0,0x64,0,0x65,0],expected:'abcde\uFFFD',warn:'not valid UTF-16BE'},
{name:'valid UTF-8 BOM',bytes:[0xef,0xbb,0xbf,0x63,0x61,0x66,0xc3,0xa9,0x0a],expected:'\uFEFFcafé\n',warn:null},
{name:'invalid UTF-8 BOM',bytes:[0xef,0xbb,0xbf,0x63,0x61,0x66,0xe9,0x0a],expected:'\uFEFFcaf\uFFFD\n',warn:'not valid UTF-8'}
];
const result=cases.map(c=>{const d=decodeFileBuffer(Uint8Array.from(c.bytes).buffer);assert.equal(d.text,c.expected);if(c.warn)assert.ok(d.warnings.some(w=>w.includes(c.warn)));else assert.equal(d.warnings.length,0);return {fixture:c.name,text:d.text,warnings:d.warnings,outputHex:Buffer.from(d.text,'utf8').toString('hex')}});
console.log(JSON.stringify({candidate:'9589f09aa50b2d5afb8784059431ff67c2737cfd',method:'Exact candidate decoder; independent function-level assertions; no browser rerun claim',assertions:'all passed',result},null,2));

```

