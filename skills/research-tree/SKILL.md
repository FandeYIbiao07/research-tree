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

Read [references/schema.md](references/schema.md) when generating, validating, importing, exporting, or repairing JSON, or when deciding the exact truth-state propagation of a logic spot. Use `scripts/validate_node_json.py` to validate exported node files before handing them off.
