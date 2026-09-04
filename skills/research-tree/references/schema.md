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
