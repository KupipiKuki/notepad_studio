# Notepad Studio — Independent G1 review

Review date: November 26, 2026 (America/New_York).
Frozen head: `1779d56b1f6dfe67f78f8c6a8fc4d4b15273f28f`, branch `wp/phase1`.

**Decision: HOLD full G1 acceptance.** The shared native-open pipeline correction is verified by source review and successful configured CI. The remaining malformed UTF-16 warning requirement from the G1 recap has not been resolved or explicitly scoped out in the consolidated G1 record.

## Evidence credited

- Read `docs/audit/Notepad_Studio_wp_phase1_G1_QAQC_Evidence.md` and `docs/remediation/Notepad_Studio_Phase1_G1_Evidence.md`.
- Verified the source: file input, drag/drop and native picker all use `openFileWithPolicy`, including the same 2 MiB guard and decoder. Native handle attachment is retained.
- Independently checked [CI run 45748514671](https://github.com/KupipiKuki/notepad_studio/actions/runs/45748514671): completed/success on code commit `7a39b4732b2cdfee6d3c37aafbe7c3ecb13ade6b`; job and all steps succeeded.
- Compared that tested commit with head 1779d56: only the G1 evidence/QA documents changed. Application, tests and workflow are identical.
- QA/QC reports 52/52 local browser tests (26 scenarios × Chromium/Firefox), including negative controls for the native-open regressions. This reviewer did not independently rerun those browser tests.
- The current split/encoding spec has 11 scenarios; its only UTF-16 scenario checks valid UTF-16LE. No malformed UTF-16LE/BE regression is present.

No application, test, workflow, branch or repository file was modified. Only scratch probe evidence and this report were created.

## Remaining blocker — malformed BOM-marked UTF-16 is decoded lossily without a loss warning

Source: [decodeFileBuffer, L3537–3548](https://github.com/KupipiKuki/notepad_studio/blob/1779d56b1f6dfe67f78f8c6a8fc4d4b15273f28f/scripts/notepad-studio.html#L3537).

Both UTF-16 branches use the default non-fatal TextDecoder. A truncated code unit is replaced with U+FFFD. For sparse errors the binary heuristic does not trigger, and the decoder returns an empty warnings array. The only notice says the file was decoded as UTF-16 and saves use UTF-8; it does not disclose the invalid input or loss of its original bytes.

This is the same class of warning gap already fixed for BOM-prefixed UTF-8. It was explicitly left as future hardening in the bounded P17 BOM follow-up, and was listed as a remaining requirement in the G1 recap. The consolidated G1 non-claims exclude UTF-16 *without* a BOM, but do not exclude malformed BOM-marked UTF-16 or document a preservation/rejection policy for it.

### Independent exact-function probe

The candidate decoder was extracted verbatim and run under Node v24.20.0 with synthetic byte buffers. This is a **function-level reproduction, not an integrated browser run**.

| Fixture | Input hex | Decoded text | warnings |
| --- | --- | --- | --- |
| Valid UTF-16LE control | fffe61006200630064006500 | abcde | [] |
| Truncated UTF-16LE final code unit | fffe6100620063006400650066 | abcde followed by U+FFFD | [] |
| Valid UTF-16BE control | feff00610062006300640065 | abcde | [] |
| Truncated UTF-16BE final code unit | feff0061006200630064006500 | abcde followed by U+FFFD | [] |

The error density is 1/6, below the 30% replacement-character binary threshold. This makes the missing warning reproducible without relying on a timing, UI or native-OS failure.

## Required correction and retest

1. Validate UTF-16LE and UTF-16BE bodies with fatal decoding, as done for UTF-8. If lossy fallback remains the policy, issue an explicit encoding-specific warning that the source contains invalid code units/bytes and re-saving cannot reproduce those original bytes. Explicit rejection is another defensible policy.
2. Add malformed LE and BE regressions, plus valid controls that produce no false invalid-data warning. Keep the existing UTF-8/BOM regressions.
3. Assert warning/toast/log and exact documented output bytes through the shared open path. Include a native API-boundary case or equivalent evidence that it receives the same policy.
4. Rerun the complete committed Chromium/Firefox suite and configured CI on one frozen corrected candidate, then update the consolidated G1 disposition.

Ordinary UTF-16-to-UTF-8 conversion is already disclosed and is not the blocker. The missing disclosure is replacement of malformed input data.

## Gate scope and remaining non-claims

The native-open pipeline correction is credited and need not be repeated. Earlier accepted recovery/snapshot/split/BOM batches remain credited. The current 52 passing scenarios do not cover this malformed UTF-16 condition, so their results remain valid.

Real Windows picker/permission UI and true OS writes are still declared unvalidated; any eventual G1 acceptance must keep that API-boundary testing scope explicit. This review does not invent native-OS validation or endorse a blanket release claim. Phase 2 and architecture gates were not assessed.

Minor documentation nit: the implementation change register says 17 split/encoding scenarios; the actual count is 11 (15 save-recovery + 11 split/encoding = 26, run across two browsers).

## Reproducible probe

The following script asserts the observed warning gap. Run as a .cjs file with Node. The candidate decoder is embedded verbatim; fixtures and assertions are separate.

```javascript
  function decodeFileBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    const warnings = [];
    const infos = [];
    let text = '';

    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
      infos.push('File decoded as UTF-16LE (byte-order mark detected); saved files are UTF-8.');
    } else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
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
 {name:'UTF-16LE valid control',bytes:[0xff,0xfe,0x61,0,0x62,0,0x63,0,0x64,0,0x65,0]},
 {name:'UTF-16LE truncated final code unit',bytes:[0xff,0xfe,0x61,0,0x62,0,0x63,0,0x64,0,0x65,0,0x66]},
 {name:'UTF-16BE valid control',bytes:[0xfe,0xff,0,0x61,0,0x62,0,0x63,0,0x64,0,0x65]},
 {name:'UTF-16BE truncated final code unit',bytes:[0xfe,0xff,0,0x61,0,0x62,0,0x63,0,0x64,0,0x65,0]}
];
const results=cases.map(c=>({fixture:c.name,inputHex:Buffer.from(c.bytes).toString('hex'),...decodeFileBuffer(Uint8Array.from(c.bytes).buffer)}));
assert.equal(results[0].text,'abcde');assert.equal(results[2].text,'abcde');
for(const i of [1,3]){assert.equal(results[i].text,'abcde\uFFFD');assert.equal(results[i].warnings.length,0);}
console.log(JSON.stringify({candidate:'1779d56b1f6dfe67f78f8c6a8fc4d4b15273f28f',method:'Exact candidate decoder with synthetic byte fixtures; not an integrated browser run',results},null,2));

```

