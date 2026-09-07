---
name: research-tree
description: Maintain the bilingual Research Tree reasoning system when users want to add evidence, questions, assumptions, judgements, decisions, typed relationships, or formal logic spots without losing reasoning history. Use for operating or preparing data for Research Tree; do not use for ordinary mind maps.
---

# Research Tree

Use the Research Tree app available in the current workspace or at a URL supplied by the user. Prefer page-exposed structured actions when they cover the operation; use the visible interface for relationships, logic spots, or details not exposed as structured actions. If the system is unavailable, prepare valid JSON and an explicit change plan instead of claiming that the live tree changed.

## Preserve reasoning history

- Treat this as a reasoning ledger, not a mind map.
- Never delete an old judgement merely because a new judgement replaces it. Add a `replaces` relationship and mark the old judgement `supersededReopened`.
- When evidence `contradicts` or `modifies` an assumption, judgement, or decision, move the affected node to `needsVerification` unless a formal logic spot determines its status.
- Record material creations, status changes, impacts, replacements, formal verification rules, and decisions in the Decision Log.
- Keep nodes atomic. A node should express one evidence item, claim, question, assumption, judgement, or decision.

## Add or update research content

1. Identify what the new information is and select one node type: Evidence, Idea, Hypothesis, Assumption, Judgement, Decision, Open Question, or Rejected Branch.
2. Store both English and Chinese content in the same node JSON. Display and return only the active language unless the user explicitly asks to inspect the complete JSON.
3. Set status by meaning: `confirmed` = green/passed; `tentative` = blue/in progress; `needsVerification` = yellow/unresolved; `rejected` = red/failed; `supersededReopened` = violet/history reopened.
4. Connect the node with the narrowest accurate reasoning relationship: `supports`, `contradicts`, `modifies`, `replaces`, or `dependsOn`.
5. Explain a judgement through its incoming linked nodes, assumptions, reasoning notes, and source rather than by writing a long title.
6. After modifying a final decision or judgement, verify that backward tracing still reaches its evidence and formal input questions.

## Use formal logic spots

Use a logic spot only when a parent question or claim is explicitly computed from independent child questions. Lay out `parent → spot → inputs`, with all independent inputs in one vertical column.

- `ANY / OR`: at least one input passes.
- `ALL / AND`: every input passes.
- `EXACTLY ONE / XOR`: exactly one input passes.
- `NONE / NOR`: no input passes.
- `NOT`: the single input fails.
- `K OF N`: at least K inputs pass.

Do not use semantic links such as `supports` as a substitute for the logic rule. The parent-to-spot relation means “verified by this rule”; every spot-to-child relation means “independent input”. If inputs depend on each other, model those dependencies separately and do not describe them as independent.

## Work with complete tree files

- Use `.research-tree.json` for movement between computers. One file must contain the complete tree, all nodes and edges, logic spots, positions, collapsed branches, decision log, active language, active panel, and graph viewport.
- Treat `documentId` as the stable identity of a tree. Importing the same ID updates that open tree; importing a different ID opens another tree alongside it.
- Keep each node's `languageType` first and `end` last even when the node is nested inside a complete tree file.
- Use the tab close button for reversible closing and Reopen to restore it. Do not use Delete as a substitute for Close.
- Export the active tree before removing it from a device-local workspace when the user may need it later.
- Do not merge two different tree files implicitly. Preserve both as separate open trees unless the user explicitly requests a merge.

Read [references/schema.md](references/schema.md) when generating, validating, importing, exporting, or repairing JSON, or when deciding the exact truth-state propagation of a logic spot. Use `scripts/validate_node_json.py` for individual nodes and `scripts/validate_tree_file.py` for complete portable tree files.


## Validate interoperability and layout

- Generate `tree.project.id`, bilingual `title` and `researchQuestion`, and canonical `decisionLog.nodeId` as specified in the schema. `name`/`description` alone is not a valid project contract.
- Preserve optional multi-node `nodeIds` and all historical actions; do not silently filter unsupported-looking history.
- Use background blocks for visual regions only. Store them in `tree.canvas.backgroundBlocks`, their positions in `tree.positions`, and back-to-front order in `tree.canvas.layerOrder`. They are not reasoning nodes.
- Backgrounds appear in the app's section navigation in file order. Give each a short bilingual name and keep its reading entrance near the top-left. Navigation preserves the reasoning graph and jumps to a readable zoom; use Overview for the whole canvas. Preserve existing text and statuses when rearranging records.
- After searching or filtering, use **Fit visible nodes / 适应可见节点** to bring the matching reasoning cards and visible logic spots into view. This control excludes decorative backgrounds; **Overview / 全图** retains the complete canvas. An empty result must not move the viewport. Verify navigation separately from file validity.
- When repairing an import, keep the original file, validate the whole replacement, check IDs and history counts, then test import/export/reimport if an app is available. Report local validation separately from a verified live import.
- Run `scripts/validate_tree_file.py` before delivering a portable file. Its validator covers project metadata, all bilingual content, logs, references, timestamps, logic rules, layout, blocks and layers.
