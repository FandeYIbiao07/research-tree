# Research Tree data contract

## Node JSON

Each node is one valid JSON document. Object key order is an interoperability requirement: `languageType` is first and `end` is last.

```json
{
  "languageType": "en-zh",
  "id": "question-a",
  "type": "openQuestion",
  "status": "tentative",
  "content": {
    "en": {
      "title": "Does condition A hold?",
      "summary": "",
      "notes": "",
      "source": "",
      "assumptions": []
    },
    "zh": {
      "title": "条件A是否成立？",
      "summary": "",
      "notes": "",
      "source": "",
      "assumptions": []
    }
  },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "end": "end"
}
```

Allowed `type` values: `evidence`, `idea`, `hypothesis`, `assumption`, `judgement`, `decision`, `openQuestion`, `rejectedBranch`.

Allowed `status` values: `confirmed`, `tentative`, `needsVerification`, `rejected`, `supersededReopened`.

## Semantic edge

```json
{
  "id": "edge-1",
  "sourceNodeId": "new-evidence",
  "targetNodeId": "old-judgement",
  "relationshipType": "contradicts",
  "note": {
    "en": "Why the new evidence affects the old judgement.",
    "zh": "说明新证据为何影响旧判断。"
  },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

Edge direction is causal or justificatory: the information doing the supporting, contradicting, modifying, or replacing is the source; the affected reasoning is the target.

## Logic spot

```json
{
  "languageType": "en-zh",
  "id": "spot-a",
  "label": { "en": "Verification of A", "zh": "A的验证" },
  "logicType": "any",
  "threshold": null,
  "parentNodeId": "question-a",
  "inputNodeIds": ["question-a1", "question-a2", "question-a3"],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "end": "end"
}
```

Allowed `logicType` values: `any`, `all`, `exactlyOne`, `none`, `not`, `atLeastK`. Set `threshold` only for `atLeastK`. A parent should normally have one logic spot so its derived status is unambiguous.

## Status propagation

Interpret child status as follows:

- `confirmed`: proposition is true.
- `rejected`: proposition is false.
- `tentative`: evaluation is actively in progress.
- `needsVerification`: truth is unresolved.
- `supersededReopened`: unresolved historical state.

The spot and its parent become:

| Logic | Confirmed | Rejected | Otherwise |
|---|---|---|---|
| ANY | at least one true | all false | blue if any input is in progress, otherwise yellow |
| ALL | all true | at least one false | blue if any input is in progress, otherwise yellow |
| EXACTLY ONE | exactly one true and all others false | more than one true, or fully resolved with not exactly one true | blue/yellow |
| NONE | all false | at least one true | blue/yellow |
| NOT | sole input false | sole input true | blue/yellow |
| K OF N | at least K true | even all unresolved inputs could not reach K | blue/yellow |

## Portable tree document

Use one `.research-tree.json` file per tree. The root object has this ordered shape:

```text
fileType: "research-tree"
formatVersion: 1
documentId: stable tree identity
savedAt: ISO timestamp
viewState:
  language: en | zh
  activePanel: graph | log
  viewport: { x, y, zoom }
tree:
  schemaVersion, project, nodes, edges, logicSpots,
  positions, collapsedNodeIds, decisionLog
end: "end"
```

`positions`, `collapsedNodeIds`, and `viewState.viewport` are required for the same layout to reopen on another computer. The nodes remain full ordered node JSON objects inside `tree.nodes`.

The device-local workspace may contain several documents and one `activeDocumentId`. Importing a file whose `documentId` is already open replaces that document with the imported revision; a new ID adds a new open tree.


## Project and decision log: required fields

`tree.schemaVersion` is `2`. Use this project shape; **do not generate only `name` and `description`**:

```json
{
  "id": "stable-project-id",
  "title": {"en": "Research title", "zh": "研究标题"},
  "researchQuestion": {"en": "What are we testing?", "zh": "我们要检验什么？"}
}
```

Every decision log entry requires `id`, `nodeId`, `action`, bilingual `summary`, and `timestamp`:

```json
{
  "id": "log-1",
  "nodeId": "question-a",
  "nodeIds": ["question-a", "evidence-b"],
  "action": "impactRecorded",
  "summary": {"en": "New evidence reopened the question.", "zh": "新证据使问题重新待验证。"},
  "timestamp": "2026-01-12T10:00:00.000Z"
}
```

`nodeId` is the primary UI anchor. Optional `nodeIds` retains every affected node, including historical nodes no longer present on the canvas. Never discard the log when a node is removed. `action` is a non-empty string, not a closed enumeration: preserve custom historical labels verbatim. Common generated actions include `created`, `updated`, `statusChanged`, `impact`, `relationship`, `logicSpot`, `replaced`, `logicSpotCreated`, `impactRecorded`. Action text is displayed as metadata, never executed.

The app recognizes legacy project `name`/`description` only when canonical fields are absent, copying their text into both language fields without pretending to translate. It derives missing log `nodeId` from the first `nodeIds` item and retains the full original array and action. Repair generated artifacts to the canonical shape with a snapshot and repair log. Existing malformed canonical fields are errors, not a reason to substitute legacy values.

IDs must be non-empty and unique within their collections; nodes, logic spots and background blocks share a canvas ID namespace. Timestamps must be ISO values with a timezone. All content strings, assumptions, edge notes and log summaries are validated. Positions are finite numbers and must cover every canvas object; viewport zoom must be positive. NOT has exactly one input, K is an integer from 1 through N, other thresholds are null, each parent has at most one rule, and formal dependencies must be acyclic.

## Background blocks and layers

Optional `tree.canvas` stores decorative objects separately from reasoning:

```json
{
  "backgroundBlocks": [{
    "id": "background-a",
    "title": {"en": "Evidence review", "zh": "证据复核"},
    "color": "#6b9eaa",
    "width": 680,
    "height": 460,
    "locked": false
  }],
  "layerOrder": ["background-a", "question-a", "spot-a"]
}
```

Block position is `tree.positions[blockId]`. Width and height are finite and at least 160 canvas units. Colour is `#RRGGBB`. `layerOrder` lists existing node, logic spot and block IDs **back to front**, without duplicates; omitted objects are appended. Blocks do not imply support, causal relationships, formal inputs or group membership. Moving a block does not move nearby nodes. Lock prevents dragging/resizing; the layer panel remains available for unlocking. Preserve these fields when saving and round-tripping a tree.

## Device workspace and closing

Workspace storage remains `research-tree.workspace.v3`, with `schemaVersion: 1`, `documents`, `activeDocumentId`, and optional `closedDocuments`. Closing a tab moves its complete document into `closedDocuments`; Reopen restores it. An empty open list is valid and must stay empty after reload. Import of an existing ID reopens/updates that document, with the previous revision backed up locally before replacement. Closing a tab is distinct from deleting a tree.

Failed imports leave the workspace unchanged and show the failing field. Failed workspace loads retain the original storage bytes and disable automatic replacement; use Export original workspace for recovery. Files are the portable backup; browser storage is device-local.
