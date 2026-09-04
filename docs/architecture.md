# Architecture and reasoning model

## Design objective

Research Tree makes the history of reasoning inspectable. A new conclusion may replace an old conclusion, but it never silently erases it. The old node remains visible with `supersededReopened` status and a `replaces` edge records the transition.

## Modules

- `lib/research-tree/types.ts` defines the graph and bilingual data contracts.
- `lib/research-tree/repository.ts` validates portable files, migrates earlier storage, and provides the multi-document local workspace.
- `lib/research-tree/sample-data.ts` provides fictional demonstration data.
- `components/research-tree-app.tsx` coordinates graph interaction, filtering, search, editing, tracing, node-type rendering, formal-logic junctions, and the decision log.

The UI depends on the `ResearchTreeRepository` interface rather than direct storage calls. A cloud or database adapter can therefore replace the local implementation later without changing the graph model.

## Graph entities

### Node

```text
languageType, id, type, status, content.en, content.zh,
createdAt, updatedAt, end
```

Allowed node types are `evidence`, `idea`, `hypothesis`, `assumption`, `judgement`, `decision`, `openQuestion`, and `rejectedBranch`.

Allowed statuses are `confirmed`, `tentative`, `needsVerification`, `rejected`, and `supersededReopened`.

Status colour is the main progress signal:

- Green: confirmed
- Blue: tentative / in progress
- Yellow: needs verification
- Red: rejected
- Violet: superseded or reopened

Node type controls the card's icon and structural styling; it does not replace the status signal.

### Semantic edge

```text
id, sourceNodeId, targetNodeId, relationshipType, note, createdAt
```

Allowed relationship types are `supports`, `contradicts`, `modifies`, `replaces`, and `dependsOn`. Edge direction is source reasoning to affected reasoning.

### Logic spot

A logic spot separates formal aggregation from semantic relationships. For a parent question `A` with independent sub-questions `a`, `b`, and `c`, the layout is:

```text
A -> logic spot -> a
                -> b
                -> c
```

The sub-questions share one junction and expand in the same direction. This prevents several semantic links from being mistaken for a formal acceptance rule.

Supported operators:

- `any`: at least one input is confirmed
- `all`: every input is confirmed
- `exactlyOne`: exactly one input is confirmed
- `none`: no input is confirmed
- `not`: the single input is not confirmed
- `atLeastK`: at least `threshold` inputs are confirmed

## Portable document

Each `.research-tree.json` file is a complete, versioned document:

```text
fileType, formatVersion, documentId, savedAt,
viewState { language, activePanel, viewport },
tree { project, nodes, edges, logicSpots, positions,
       collapsedNodeIds, decisionLog },
end
```

The document contains everything needed to reconstruct the same reasoning workspace on another computer. Node positions and collapsed branches preserve graph layout; `viewState` preserves the selected language, graph/log panel, pan position, and zoom level.

Each nested node is serialized with the JSON boundary rules:

1. `languageType` is written first.
2. English and Chinese content are stored together under `content`.
3. `end: "end"` is written last.

## Multi-tree workspace

The browser stores a versioned workspace under the `research-tree.workspace.v3` namespace. It contains an ordered collection of documents and one `activeDocumentId`; every stored document appears as a switchable tab.

- New tree: creates a new stable `documentId`.
- Open file with a new ID: adds a tab.
- Open file with an existing ID: updates that tab, supporting manual A/B computer synchronization.
- Remove tree: removes only the active local document and leaves other trees intact.
- Earlier single-tree v1/v2 browser data: migrates automatically into the first document without deleting the legacy keys.

## Future cloud sync

A cloud adapter should implement the same workspace load/save contract. Synchronization should use stable document, node, and edge IDs, preserve timestamps and superseded nodes, and treat conflicts as new review events rather than silently overwriting reasoning history.
