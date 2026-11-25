# Notepad Studio — Independent audit of wp/phase0

Audit date: November 19, 2026 (America/New_York). Evidence timestamps use UTC.

**Decision: HOLD — the first data-integrity batch is not ready for acceptance.** The committed regression suite passes 16/16, but independent browser probes reproduce three unresolved failure modes, including loss of the original recovery payload under genuine storage quota pressure. A fourth finding affects committed CI portability.

No application code, tests, workflow, branch or Git index was changed by this audit. All new audit scripts and outputs are outside the repository. No GitHub comments, commits or merges were made.

## 1. Frozen candidate and scope

| Item | Identity |
| --- | --- |
| Repository / local checkout | KupipiKuki/notepad_studio / C:\Git\notepad_studio |
| Branch / remote-confirmed head | `wp/phase0` / `799e38a621a29a49093c99a9304ce12a3f36313e` |
| Application change commit | `6d3e2e17624d9f3f16eea316fdf93c1a0b626370` |
| QA/QC review commit | `98e079e` |
| Latest packaging commit | `799e38a` — adds setup, workflow and the Phase 0 audit document |
| Baseline main | `2437b1ceee9a5b5d32755440e74c504b2211fee2` |
| Baseline application blob | `d29dfa5785ba62e89ced8386dd022dbec5b42890` |
| Candidate application blob | `001072176cffd8d23c803f345b3832f92a8f9e8d` |
| Candidate canonical LF bytes / SHA-256 | 144,687 / `6d0ed1bf6e9dd72a0a17d72126cb0fc8ee9ad65f01f4e96c702cbcc5495a56dd` |
| Candidate working CRLF bytes / SHA-256 | 148,777 / `6b3d88e5849b28987e6db203d836267e3b3095d56f81e7484e25fdd527b03834` |
| Initial and final Git status | Clean, `wp/phase0...origin/wp/phase0` |

The application is unchanged between the QA-reviewed application commit and head `799e38a`; the QA working-file hash matches. The branch name says Phase 0, but its implementation record explicitly scopes the code to the first **Phase 1** batch: P01, P02, P03, P11 and P16. This audit assesses that limited batch. It does not close the entire Phase 1/G1 scope, including unimplemented P09/P17 work.

Compared with pinned main, head adds 12 files/changes, 3,024 insertions and 73 deletions. The application diff is 298 changed lines, centered on save/persistence plus one new backup palette command. Markup, CSS, CDN pins and existing storage-key names are unchanged. `npp_studio_state_v1_recovery` is new. The full application diff, both implementation/QA handoffs, the committed spec and workflow were read.

## 2. Verification performed

Windows, Playwright 1.65.1; Chromium 159.0.8154.6 and Firefox 159.0. Actual application source served unchanged from the frozen clean checkout. Synthetic documents only; fresh isolated contexts and temporary loopback origin for independent probes. No user workspace or browser profile was loaded or cleared.

| Check | Result | Limits |
| --- | --- | --- |
| Inline application JavaScript syntax | Pass | Parsing, not functional acceptance |
| Unmodified committed phase1-save-recovery.spec.js | **16 expected passes, 0 unexpected, 0 skipped, 0 flaky; exit 0** | 8 scenarios × 2 browsers; file-origin state/API-fault cases and HTTP downloads |
| Independent dropped-entry probe | Failure reproduced in both browsers | Genuine app/model/autosave flow |
| Independent quota/recovery-loss probe | Failure reproduced in both browsers | Genuine browser localStorage quota; no quota mock |
| Independent failed Save As after tab switch | Wrong-tab download reproduced in both browsers | Native API fault injection; actual browser download bytes read |
| Independent existing-handle failure after tab switch | Wrong-tab download reproduced in both browsers | Handle established through Save As; native write failure injected; actual download bytes read |
| Explicit recovery-quota confirmation | QuotaExceededError in both browsers, backup null, UI still says backup stored | Additional file-origin confirmation |
| CI portability | Source-confirmed incompatible path configuration | No Ubuntu Actions run was executed or claimed |
| Final checkout/source identity | Unchanged and clean | Recorded after verification |

The committed spec was selected by an external audit config with Chromium/Firefox projects, one worker, JSON reporter and output directory outside the repository. Test source was not edited. This avoids running unrelated example tests and does not claim the repository's full default configuration or WebKit passed. The suite took approximately 26.2 seconds.

## 3. Blocking findings

### R02 — P0: failed recovery backup is falsely reported successful, then autosave removes the original

Source: `preserveRecoveryPayload` L3156 and repaired-state load path L3197. The backup write is wrapped in an empty catch and returns no success/failure result. Load proceeds with sanitized tabs, emits “original backup stored in recovery key,” and permits normal autosave.

Reproduction, independently executed in Chromium and Firefox:

1. Seed a valid workspace envelope containing a valid good tab and a malformed tab whose content is an object. The object contains `RECOVERABLE_OBJECT_CONTENT_` plus 3,000,000 Q characters. The original JSON is 3,000,361 characters and fits in localStorage.
2. Open the unmodified candidate. Sanitization converts the object content to an empty string. A second copy of the original cannot fit in the recovery key.
3. Observe recovery key = null, no workspace-recovery.json tab, and toast/log claiming a backup was kept.
4. Edit the good tab and wait beyond the 800 ms autosave debounce.
5. The original 3,000,361-character workspace is replaced with a 379-character sanitized workspace. The marker is absent from every storage value; the malformed tab is empty. No recovery tab exposes the original.

A separate file-origin confirmation attempted the exact recovery-key write against the original stored value and caught **QuotaExceededError** in both browsers. This is not a simulated full-storage result. The successful first write and failed duplicate demonstrate why the recovery guarantee needs a verified alternative when space is insufficient.

**Impact:** the implementation can remove the only supported recovery copy while falsely claiming preservation. This contradicts P03/P16 and the QA disposition that repaired states are safely backed up. The original's in-memory parse is not an exposed recovery mechanism.

**Required before acceptance:** propagate backup success/failure; do not claim preservation without a retained copy. Keep the original workspace key intact when no recovery copy can be stored, expose an explicit recovery/export route, and guard replacement autosave until preservation is assured. Add actual quota and denied-backup-write regressions asserting the raw payload remains accessible after edits/reload. The exact recovery design remains an implementation choice.

### R01 — P1: discarded tab-list entries do not trigger recovery preservation

Source: `sanitizePersistedTab` L3112 returns null for a non-object/array entry; `loadState` L3176 only sets `repairedSomething` inside `if (result)`. A discarded entry therefore does not count as a repair when all retained tabs are valid.

Reproduction in both browsers:

1. Seed tabs = one fully valid good tab plus the string `ORPHAN_RECOVERABLE_TEXT`.
2. Open: only the good tab is shown. Recovery key is null; no recovery toast/log; status says 0 Errors.
3. Edit the good tab and let autosave run. The new JSON contains only the good tab; the original extra entry is gone, with no preserved raw payload.

**Impact:** malformed persisted data is silently discarded during repair, contrary to the batch's preserve-original policy. This fixture is an unrecognized persisted entry, not a claim that a valid renderable document was deleted.

**Required before acceptance:** treat dropped entries and other destructive model normalization as repairs, preserve the full raw payload using a verified recovery path, and cover mixed valid/invalid tab arrays. This must work together with R02 rather than assuming a successful recovery-key write.

### R03 — P1: failure fallback downloads the active tab rather than the requested save snapshot

Source: `saveFileNativeOrFallback` correctly captures the original snapshot, but native write-error fallbacks at L3806/L3834 and picker-start error fallback at L3818 call `saveActiveFile()` with no original tab or snapshot. That helper re-reads the currently active editor.

Reproduction in both browsers, in two separate native paths:

1. Start saving A with a pending native operation; A contains `REQUESTED A SNAPSHOT` (or `REQUESTED HANDLE A`).
2. Switch to B and edit it to `CURRENT B TEXT` (or `CURRENT B HANDLE TEXT`).
3. Fail the pending native write. In the existing-handle variant, a prior successful Save As first established A's native handle.
4. Capture the actual fallback download: suggested filename **b.txt**, bytes **CURRENT B TEXT** / **CURRENT B HANDLE TEXT**. The requested A snapshot is not downloaded.

**Impact:** successful native paths are now snapshot-correct, but failure handling still changes the target document during asynchronous work. The evidence does not show A's live text being erased or falsely cleaned; it shows the wrong output document being produced as the fallback for saving A.

**Required before acceptance:** carry original document identity/name/content snapshot through failure fallback as well as success; keep the active tab's UI independent. Add regressions for tab switches during picker rejection, createWritable/write/close failure, and established-handle failure, asserting exact original-document download name/bytes and both tabs' dirty states.

### R04 — P1: committed spec cannot run against the checked-out source on the committed Ubuntu workflow

Source: tests/phase1-save-recovery.spec.js L7–8 hardcodes `file:///C:/Git/notepad_studio/scripts/notepad-studio.html` and `C:/Git/notepad_studio/scripts/notepad-studio.html`. The committed workflow runs `npx playwright test` on `ubuntu-latest` (workflow L10/L21).

An Ubuntu runner has no C:/Git checkout. File navigation and HTTP server read cannot target the candidate there. On another Windows clone, the spec may target a different checkout at C:/Git instead of the checkout being tested. This audit's Windows test results are valid because that exact path was independently verified to be the frozen candidate.

**Required before accepting the committed CI/test package:** resolve the application file from the test/repository location, derive the file URL portably, and rerun the committed workflow configuration in its intended environment. This is a source-confirmed portability failure; no failed Linux execution log is invented. It does not invalidate the successful local 16-test run.

## 4. What the existing tests do verify

The passing committed suite provides useful evidence for honest fallback dirty state and exact CRLF bytes, edit-during-native-write and picker-tab-switch success paths, ordinary native completion, picker cancellation, malformed JSON recovery when backup storage is available, and the specified duplicate-ID/numeric-content/mode/bookmark repair fixture.

Those successes remain credited. They do not exercise rejected tab-array entries, backup storage failure during repair, native failure after tab switches, or Linux path resolution. “No page errors” is compatible with R01/R02/R03, which fail through normal control flow and swallowed/API-handled errors.

The QA review's application hash and 16-test claims were independently confirmed. Its statements that repaired states preserve originals and that none of the residual notes block the batch are too broad given R01/R02. Its untracked-tooling note describes the earlier review commit; head 799e38a now commits those files. The application itself is unchanged since that earlier review, so this is not an unreviewed-source mismatch.

## 5. Gate disposition and retest requirements

**Hold this batch and G1 acceptance.** The Phase 0 baseline/reproduction evidence is not revoked; this branch contains subsequent remediation work. G1 cannot be inferred from the branch name or the passing targeted spec. P09/P17 and other non-batch findings remain open as already declared.

Retest one frozen corrected candidate with:

- The unchanged intended assertions of the eight committed scenarios on Chromium and Firefox.
- Mixed valid/invalid entry repair without silent original-payload loss.
- Genuine quota and explicit recovery-write denial, verifying recovery remains accessible after edit/autosave/reload and feedback reports actual success/failure.
- Save As and existing-handle failures after tab switches, verifying the original requested output snapshot/name and active/original dirty states.
- A location-independent committed harness and successful configured CI execution.

Native Windows picker UI, genuine native OS writes/permission grants, full four-browser/origin regression, WebKit, and non-batch findings were not independently validated in this audit. Do not relabel those as passes. Full G1 still requires the remaining scope in the plan, or an explicit bounded batch acceptance after these blockers are resolved.

No fixes were implemented by the auditor. This report is the concrete handoff for the coder/QA correction cycle.

## 6. Source references and evidence

Frozen source:

- https://github.com/KupipiKuki/notepad_studio/blob/799e38a621a29a49093c99a9304ce12a3f36313e/scripts/notepad-studio.html#L3112
- https://github.com/KupipiKuki/notepad_studio/blob/799e38a621a29a49093c99a9304ce12a3f36313e/scripts/notepad-studio.html#L3156
- https://github.com/KupipiKuki/notepad_studio/blob/799e38a621a29a49093c99a9304ce12a3f36313e/scripts/notepad-studio.html#L3787
- https://github.com/KupipiKuki/notepad_studio/blob/799e38a621a29a49093c99a9304ce12a3f36313e/tests/phase1-save-recovery.spec.js#L7
- https://github.com/KupipiKuki/notepad_studio/blob/799e38a621a29a49093c99a9304ce12a3f36313e/.github/workflows/playwright.yml#L10

Local evidence is under `phase0-candidate-audit/` in the planning workspace: identity.json, committed-spec-results.json, committed-spec.log, independent-probes.json, quota-confirmation.json, downloaded wrong-tab fallback files, the external audit config and independent probe script. Raw identity/probe evidence, per-test outcomes and the probe script are embedded below. The large quota payload is reproducibly generated rather than embedded as millions of Q characters.

## Appendix — Independently rerun committed spec

```json
{
  "stats": {
    "startTime": "2026-11-20T00:18:54.367Z",
    "duration": 26199.775,
    "expected": 16,
    "skipped": 0,
    "unexpected": 0,
    "flaky": 0
  },
  "errors": [],
  "tests": [
    {
      "title": "P01: fallback download with suppressed click keeps dirty state honest",
      "project": "chromium",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 3395,
          "errors": []
        }
      ]
    },
    {
      "title": "P01: fallback download with suppressed click keeps dirty state honest",
      "project": "firefox",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 2110,
          "errors": []
        }
      ]
    },
    {
      "title": "P01/P11: real fallback download keeps honest state and exact CRLF bytes",
      "project": "chromium",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1053,
          "errors": []
        }
      ]
    },
    {
      "title": "P01/P11: real fallback download keeps honest state and exact CRLF bytes",
      "project": "firefox",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1514,
          "errors": []
        }
      ]
    },
    {
      "title": "P02: edit during pending native write keeps dirty and writes the snapshot",
      "project": "chromium",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 699,
          "errors": []
        }
      ]
    },
    {
      "title": "P02: edit during pending native write keeps dirty and writes the snapshot",
      "project": "firefox",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1066,
          "errors": []
        }
      ]
    },
    {
      "title": "P02: tab switch during pending Save As writes the original tab content",
      "project": "chromium",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 884,
          "errors": []
        }
      ]
    },
    {
      "title": "P02: tab switch during pending Save As writes the original tab content",
      "project": "firefox",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1156,
          "errors": []
        }
      ]
    },
    {
      "title": "P02: native save without races clears dirty state correctly",
      "project": "chromium",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 538,
          "errors": []
        }
      ]
    },
    {
      "title": "P02: native save without races clears dirty state correctly",
      "project": "firefox",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 786,
          "errors": []
        }
      ]
    },
    {
      "title": "P02: picker cancellation keeps dirty state and starts no download",
      "project": "chromium",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1704,
          "errors": []
        }
      ]
    },
    {
      "title": "P02: picker cancellation keeps dirty state and starts no download",
      "project": "firefox",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1914,
          "errors": []
        }
      ]
    },
    {
      "title": "P03: corrupt stored workspace is preserved and surfaced for recovery",
      "project": "chromium",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1739,
          "errors": []
        }
      ]
    },
    {
      "title": "P03: corrupt stored workspace is preserved and surfaced for recovery",
      "project": "firefox",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1939,
          "errors": []
        }
      ]
    },
    {
      "title": "P16: malformed persisted model is sanitized without bootstrap failure",
      "project": "chromium",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1713,
          "errors": []
        }
      ]
    },
    {
      "title": "P16: malformed persisted model is sanitized without bootstrap failure",
      "project": "firefox",
      "expected": "passed",
      "results": [
        {
          "status": "passed",
          "durationMs": 1893,
          "errors": []
        }
      ]
    }
  ]
}
```

## Appendix — identity.json

```json
{
  "branch": "wp/phase0",
  "head": "799e38a621a29a49093c99a9304ce12a3f36313e",
  "appBlob": "001072176cffd8d23c803f345b3832f92a8f9e8d",
  "canonicalSHA256": "6d0ed1bf6e9dd72a0a17d72126cb0fc8ee9ad65f01f4e96c702cbcc5495a56dd",
  "workingSHA256": "6b3d88e5849b28987e6db203d836267e3b3095d56f81e7484e25fdd527b03834",
  "canonicalBytes": 144687,
  "workingBytes": 148777,
  "status": "## wp/phase0...origin/wp/phase0\n"
}
```

## Appendix — independent-probes.json

```json
[
  {
    "id": "R01-dropped-entry-chromium",
    "time": "2026-11-20T00:31:12.987Z",
    "actual": {
      "raw": "{\"activeTabId\":\"good\",\"tabs\":[{\"id\":\"good\",\"name\":\"good.txt\",\"content\":\"good document\",\"savedContent\":\"good document\",\"mode\":\"text\",\"dirty\":false,\"bookmarks\":[]},\"ORPHAN_RECOVERABLE_TEXT\"],\"tabSize\":2,\"lineEnding\":\"CRLF\",\"macroActions\":[]}",
      "initial": {
        "backup": null,
        "tabs": [
          "good.txt"
        ],
        "toast": ""
      },
      "after": {
        "storage": [
          {
            "key": "npp_studio_state_v1",
            "value": "{\"activeTabId\":\"good\",\"wordWrap\":false,\"tabSize\":2,\"lineEnding\":\"CRLF\",\"macroActions\":[],\"tabs\":[{\"id\":\"good\",\"name\":\"good.txt\",\"content\":\"edited good document\",\"savedContent\":\"good document\",\"mode\":\"text\",\"dirty\":true,\"bookmarks\":[]}],\"showSymbolsActive\":false,\"rulerMode\":0}"
          }
        ],
        "errorText": "0 Errors"
      },
      "pageErrors": []
    }
  },
  {
    "id": "R02-quota-recovery-loss-chromium",
    "time": "2026-11-20T00:31:14.748Z",
    "actual": {
      "originalLength": 3000361,
      "before": {
        "rawLength": 3000361,
        "backup": null,
        "tabs": [
          "good.txt",
          "bad.txt"
        ],
        "toast": "Workspace state was repaired; original backup stored in recovery key.",
        "errorLog": [
          "Saved workspace contained invalid entries; they were repaired. A backup of the original state was kept.{\"activeTabId\":\"good\",\"tabs\":[{\"id\":\"good\",\"name\":\"good.txt\",\"content\":\"good document\",\"savedContent"
        ]
      },
      "after": {
        "keys": [
          {
            "key": "npp_studio_state_v1",
            "length": 379,
            "hasOriginalMarker": false
          }
        ],
        "state": {
          "activeTabId": "good",
          "wordWrap": false,
          "tabSize": 2,
          "lineEnding": "CRLF",
          "macroActions": [],
          "tabs": [
            {
              "id": "good",
              "name": "good.txt",
              "content": "edited after repair",
              "savedContent": "good document",
              "mode": "text",
              "dirty": true,
              "bookmarks": []
            },
            {
              "id": "bad",
              "name": "bad.txt",
              "content": "",
              "savedContent": "",
              "mode": "text",
              "dirty": false,
              "bookmarks": []
            }
          ],
          "showSymbolsActive": false,
          "rulerMode": 0
        },
        "toast": "Workspace state was repaired; original backup stored in recovery key."
      },
      "pageErrors": []
    }
  },
  {
    "id": "R03-failed-save-as-chromium",
    "time": "2026-11-20T00:31:15.503Z",
    "actual": {
      "suggestedFilename": "b.txt",
      "downloadedBytes": "CURRENT B TEXT",
      "state": {
        "activeTabId": "b",
        "wordWrap": false,
        "tabSize": 2,
        "lineEnding": "CRLF",
        "macroActions": [],
        "tabs": [
          {
            "id": "a",
            "name": "a.txt",
            "content": "REQUESTED A SNAPSHOT",
            "savedContent": "ORIGINAL A",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          },
          {
            "id": "b",
            "name": "b.txt",
            "content": "CURRENT B TEXT",
            "savedContent": "ORIGINAL B",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          }
        ],
        "showSymbolsActive": false,
        "rulerMode": 0
      },
      "toast": "Download started: b.txt (CRLF) - confirm it in your browser downloads",
      "pageErrors": []
    }
  },
  {
    "id": "R03-failed-handle-chromium",
    "time": "2026-11-20T00:31:16.147Z",
    "actual": {
      "suggestedFilename": "b.txt",
      "downloadedBytes": "CURRENT B HANDLE TEXT",
      "state": {
        "activeTabId": "b",
        "wordWrap": false,
        "tabSize": 2,
        "lineEnding": "CRLF",
        "macroActions": [],
        "tabs": [
          {
            "id": "a",
            "name": "native-a.txt",
            "content": "REQUESTED HANDLE A",
            "savedContent": "ORIGINAL A",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          },
          {
            "id": "b",
            "name": "b.txt",
            "content": "CURRENT B HANDLE TEXT",
            "savedContent": "ORIGINAL B",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          }
        ],
        "showSymbolsActive": false,
        "rulerMode": 0
      },
      "pageErrors": []
    }
  },
  {
    "id": "R01-dropped-entry-firefox",
    "time": "2026-11-20T00:31:19.505Z",
    "actual": {
      "raw": "{\"activeTabId\":\"good\",\"tabs\":[{\"id\":\"good\",\"name\":\"good.txt\",\"content\":\"good document\",\"savedContent\":\"good document\",\"mode\":\"text\",\"dirty\":false,\"bookmarks\":[]},\"ORPHAN_RECOVERABLE_TEXT\"],\"tabSize\":2,\"lineEnding\":\"CRLF\",\"macroActions\":[]}",
      "initial": {
        "backup": null,
        "tabs": [
          "good.txt"
        ],
        "toast": ""
      },
      "after": {
        "storage": [
          {
            "key": "npp_studio_state_v1",
            "value": "{\"activeTabId\":\"good\",\"wordWrap\":false,\"tabSize\":2,\"lineEnding\":\"CRLF\",\"macroActions\":[],\"tabs\":[{\"id\":\"good\",\"name\":\"good.txt\",\"content\":\"edited good document\",\"savedContent\":\"good document\",\"mode\":\"text\",\"dirty\":true,\"bookmarks\":[]}],\"showSymbolsActive\":false,\"rulerMode\":0}"
          }
        ],
        "errorText": "0 Errors"
      },
      "pageErrors": []
    }
  },
  {
    "id": "R02-quota-recovery-loss-firefox",
    "time": "2026-11-20T00:31:21.334Z",
    "actual": {
      "originalLength": 3000361,
      "before": {
        "rawLength": 3000361,
        "backup": null,
        "tabs": [
          "good.txt",
          "bad.txt"
        ],
        "toast": "Workspace state was repaired; original backup stored in recovery key.",
        "errorLog": [
          "Saved workspace contained invalid entries; they were repaired. A backup of the original state was kept.{\"activeTabId\":\"good\",\"tabs\":[{\"id\":\"good\",\"name\":\"good.txt\",\"content\":\"good document\",\"savedContent"
        ]
      },
      "after": {
        "keys": [
          {
            "key": "npp_studio_state_v1",
            "length": 379,
            "hasOriginalMarker": false
          }
        ],
        "state": {
          "activeTabId": "good",
          "wordWrap": false,
          "tabSize": 2,
          "lineEnding": "CRLF",
          "macroActions": [],
          "tabs": [
            {
              "id": "good",
              "name": "good.txt",
              "content": "edited after repair",
              "savedContent": "good document",
              "mode": "text",
              "dirty": true,
              "bookmarks": []
            },
            {
              "id": "bad",
              "name": "bad.txt",
              "content": "",
              "savedContent": "",
              "mode": "text",
              "dirty": false,
              "bookmarks": []
            }
          ],
          "showSymbolsActive": false,
          "rulerMode": 0
        },
        "toast": "Workspace state was repaired; original backup stored in recovery key."
      },
      "pageErrors": []
    }
  },
  {
    "id": "R03-failed-save-as-firefox",
    "time": "2026-11-20T00:31:22.023Z",
    "actual": {
      "suggestedFilename": "b.txt",
      "downloadedBytes": "CURRENT B TEXT",
      "state": {
        "activeTabId": "b",
        "wordWrap": false,
        "tabSize": 2,
        "lineEnding": "CRLF",
        "macroActions": [],
        "tabs": [
          {
            "id": "a",
            "name": "a.txt",
            "content": "REQUESTED A SNAPSHOT",
            "savedContent": "ORIGINAL A",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          },
          {
            "id": "b",
            "name": "b.txt",
            "content": "CURRENT B TEXT",
            "savedContent": "ORIGINAL B",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          }
        ],
        "showSymbolsActive": false,
        "rulerMode": 0
      },
      "toast": "Download started: b.txt (CRLF) - confirm it in your browser downloads",
      "pageErrors": []
    }
  },
  {
    "id": "R03-failed-handle-firefox",
    "time": "2026-11-20T00:31:22.901Z",
    "actual": {
      "suggestedFilename": "b.txt",
      "downloadedBytes": "CURRENT B HANDLE TEXT",
      "state": {
        "activeTabId": "b",
        "wordWrap": false,
        "tabSize": 2,
        "lineEnding": "CRLF",
        "macroActions": [],
        "tabs": [
          {
            "id": "a",
            "name": "native-a.txt",
            "content": "REQUESTED HANDLE A",
            "savedContent": "ORIGINAL A",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          },
          {
            "id": "b",
            "name": "b.txt",
            "content": "CURRENT B HANDLE TEXT",
            "savedContent": "ORIGINAL B",
            "mode": "text",
            "dirty": true,
            "bookmarks": []
          }
        ],
        "showSymbolsActive": false,
        "rulerMode": 0
      },
      "pageErrors": []
    }
  }
]
```

## Appendix — quota-confirmation.json

```json
[
  {
    "browser": "chromium",
    "version": "159.0.8154.6",
    "origin": "file",
    "error": {
      "name": "QuotaExceededError",
      "message": "Failed to execute 'setItem' on 'Storage': Setting the value of 'npp_studio_state_v1_recovery' exceeded the quota."
    },
    "backup": null,
    "toast": "Workspace state was repaired; original backup stored in recovery key."
  },
  {
    "browser": "firefox",
    "version": "159.0",
    "origin": "file",
    "error": {
      "name": "QuotaExceededError",
      "message": "The quota has been exceeded."
    },
    "backup": null,
    "toast": "Workspace state was repaired; original backup stored in recovery key."
  }
]
```

## Appendix — playwright.audit.cjs

```javascript
module.exports={testDir:'C:/Git/notepad_studio/tests',testMatch:'phase1-save-recovery.spec.js',fullyParallel:false,workers:1,timeout:30000,expect:{timeout:10000},outputDir:__dirname+'/test-results',reporter:[['json',{outputFile:__dirname+'/committed-spec-results.json'}]],projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'firefox',use:{browserName:'firefox'}}]};

```

## Appendix — independent-probes.cjs

```javascript
const fs=require('fs'),http=require('http'),path=require('path');
module.exports=async({pw,root})=>{const results=[];const record=(id,actual)=>{results.push({id,time:new Date().toISOString(),actual});fs.writeFileSync(path.join(root,'independent-probes.json'),JSON.stringify(results,null,2))};const source=fs.readFileSync('C:/Git/notepad_studio/scripts/notepad-studio.html');const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(source)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const tab=(id,content)=>({id,name:id+'.txt',content,savedContent:content,mode:'text',dirty:false,bookmarks:[]});const state=tabs=>({activeTabId:tabs[0].id,tabs,tabSize:2,lineEnding:'CRLF',macroActions:[]});const click=(p,id)=>p.locator('#'+id).evaluate(e=>e.click());const set=(p,s)=>p.evaluate(s=>document.querySelector('.CodeMirror').CodeMirror.setValue(s),s);let browser;
for(const kind of ['chromium','firefox']){try{browser=await pw[kind].launch({headless:true});
async function fresh(raw,boundary){const c=await browser.newContext({acceptDownloads:true});await c.addInitScript(({raw,boundary})=>{localStorage.setItem('npp_studio_state_v1',raw);if(boundary){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='npp_studio_state_v1_recovery')throw new DOMException('denied recovery write','QuotaExceededError');return original.call(this,k,v)}}},{raw,boundary});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('.CodeMirror').nth(1).waitFor({state:'attached'});return {c,p,errors}}
// R01: invalid list entries are filtered without triggering the recovery safeguard.
{const raw=JSON.stringify(state([tab('good','good document'),'ORPHAN_RECOVERABLE_TEXT'])),v=await fresh(raw);const initial=await v.p.evaluate(()=>({backup:localStorage.getItem('npp_studio_state_v1_recovery'),tabs:[...document.querySelectorAll('.tab-title')].map(e=>e.textContent),toast:document.querySelector('#toastMessage').textContent}));await set(v.p,'edited good document');await v.p.waitForTimeout(1000);const after=await v.p.evaluate(()=>({storage:[...Array(localStorage.length)].map((_,i)=>{const k=localStorage.key(i);return {key:k,value:localStorage.getItem(k)}}),errorText:document.querySelector('#statusErrorText').textContent}));record('R01-dropped-entry-'+kind,{raw,initial,after,pageErrors:v.errors});await v.c.close()}
// R02: genuine browser quota makes the backup fail, then repaired-state autosave erases the original.
{const model=state([tab('good','good document'),{...tab('bad',''),content:{unrenderable:'RECOVERABLE_OBJECT_CONTENT_'+'Q'.repeat(3000000)}}]);const raw=JSON.stringify(model),v=await fresh(raw);const before=await v.p.evaluate(()=>({rawLength:localStorage.getItem('npp_studio_state_v1').length,backup:localStorage.getItem('npp_studio_state_v1_recovery'),tabs:[...document.querySelectorAll('.tab-title')].map(e=>e.textContent),toast:document.querySelector('#toastMessage').textContent,errorLog:[...document.querySelectorAll('.error-log-msg')].map(e=>e.textContent)}));await set(v.p,'edited after repair');await v.p.waitForTimeout(1200);const after=await v.p.evaluate(()=>({keys:Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i),s=localStorage.getItem(k);return {key:k,length:s.length,hasOriginalMarker:s.includes('RECOVERABLE_OBJECT_CONTENT_')}}),state:JSON.parse(localStorage.getItem('npp_studio_state_v1')),toast:document.querySelector('#toastMessage').textContent}));record('R02-quota-recovery-loss-'+kind,{originalLength:raw.length,before,after,pageErrors:v.errors});await v.c.close()}
// R03: a failing Save As after a tab switch falls back to downloading the wrong document.
{const v=await fresh(JSON.stringify(state([tab('a','ORIGINAL A'),tab('b','ORIGINAL B')]))),p=v.p;await set(p,'REQUESTED A SNAPSHOT');await p.evaluate(()=>window.showSaveFilePicker=async()=>({name:'a-saved.txt',createWritable:()=>new Promise((resolve,reject)=>window.rejectWrite=()=>reject(new DOMException('synthetic denied write','NotAllowedError')))}));await click(p,'btnSaveAs');await p.waitForFunction(()=>!!window.rejectWrite);await p.locator('.tab-item').filter({hasText:'b.txt'}).click();await set(p,'CURRENT B TEXT');const pending=p.waitForEvent('download');await p.evaluate(()=>window.rejectWrite());const d=await pending,filename=kind+'-wrong-tab-fallback.txt';await d.saveAs(path.join(root,filename));record('R03-failed-save-as-'+kind,{suggestedFilename:d.suggestedFilename(),downloadedBytes:fs.readFileSync(path.join(root,filename),'utf8'),state:await p.evaluate(()=>JSON.parse(localStorage.getItem('npp_studio_state_v1'))),toast:await p.locator('#toastMessage').textContent(),pageErrors:v.errors});await v.c.close()}
// Validate that the same failure exists on an established native file handle.
{const v=await fresh(JSON.stringify(state([tab('a','ORIGINAL A'),tab('b','ORIGINAL B')]))),p=v.p;await p.evaluate(()=>{window.reviewHandle={name:'native-a.txt',createWritable:async()=>({write:async()=>{},close:async()=>{}})};window.showSaveFilePicker=async()=>window.reviewHandle});await click(p,'btnSaveAs');await p.waitForFunction(()=>document.querySelector('.tab-title').textContent==='native-a.txt');await set(p,'REQUESTED HANDLE A');await p.evaluate(()=>window.reviewHandle.createWritable=()=>new Promise((resolve,reject)=>window.rejectWrite=()=>reject(Error('write failed'))));await click(p,'btnSaveFile');await p.waitForFunction(()=>!!window.rejectWrite);await p.locator('.tab-item').filter({hasText:'b.txt'}).click();await set(p,'CURRENT B HANDLE TEXT');const pending=p.waitForEvent('download');await p.evaluate(()=>window.rejectWrite());const d=await pending,filename=kind+'-wrong-handle-fallback.txt';await d.saveAs(path.join(root,filename));record('R03-failed-handle-'+kind,{suggestedFilename:d.suggestedFilename(),downloadedBytes:fs.readFileSync(path.join(root,filename),'utf8'),state:await p.evaluate(()=>JSON.parse(localStorage.getItem('npp_studio_state_v1'))),pageErrors:v.errors});await v.c.close()}
}catch(e){record('probe-error-'+kind,{message:e.stack})}finally{await browser?.close()}}
await new Promise(r=>server.close(r));return results;
};

```

## Appendix — Evidence checksums

```json
[
  {
    "name": "identity.json",
    "bytes": 417,
    "sha256": "d37859f3ea9555e9741f506e4e4f94e07cb640090c1910f9d45710f7bebee9b5"
  },
  {
    "name": "committed-spec-results.json",
    "bytes": 18553,
    "sha256": "a38e9dc29af801ef58ab318e6984bcdd31c09f5d415b98f9aeb8baa86c17f901"
  },
  {
    "name": "independent-probes.json",
    "bytes": 9626,
    "sha256": "8cc9349e1b0454f5153e434e50534f8fabcf039a2ff45a9b8cf424c193b7d7d1"
  },
  {
    "name": "quota-confirmation.json",
    "bytes": 679,
    "sha256": "876283e4549703e5ab60e83afe38c6f926fae0bd7756416a5d36f290077f4777"
  },
  {
    "name": "chromium-wrong-tab-fallback.txt",
    "bytes": 14,
    "sha256": "f5684caae6df76b3cd794264db2e955630275fe4c71f3444e989a9ce0624949c"
  },
  {
    "name": "chromium-wrong-handle-fallback.txt",
    "bytes": 21,
    "sha256": "591b0f7f8b6a9c8104b3e691ec162ef24fa638a700805ace0bd949550814a9fe"
  },
  {
    "name": "firefox-wrong-tab-fallback.txt",
    "bytes": 14,
    "sha256": "f5684caae6df76b3cd794264db2e955630275fe4c71f3444e989a9ce0624949c"
  },
  {
    "name": "firefox-wrong-handle-fallback.txt",
    "bytes": 21,
    "sha256": "591b0f7f8b6a9c8104b3e691ec162ef24fa638a700805ace0bd949550814a9fe"
  }
]
```
