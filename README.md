# Research Tree

Research Tree is a lightweight bilingual reasoning workspace for long-running research projects. It is designed to preserve how evidence, assumptions, judgements, and decisions change over time rather than flattening them into a conventional mind map.

## What it supports

- Interactive graph view with expandable branches
- Eight reasoning node types and five typed semantic relationships
- Explicit logic spots for `ANY`, `ALL`, `XOR`, `NONE`, `NOT`, and `K of N`
- Status changes without erasing superseded or rejected reasoning
- Backward tracing from decisions to supporting evidence
- Search and type/status filters
- Chronological decision log
- English/Chinese display switching
- Local-first persistence, with one ordered JSON document per node

## Run locally

Requirements: Node.js 22.13 or later and pnpm.

```bash
pnpm install
pnpm dev
```

For a production build:

```bash
pnpm build
```

## Data contract

Every node stores both languages in one JSON document. The first property must be `languageType`, and the final property must be `end` with the value `"end"`. The UI reads the selected language and displays one language at a time.

See [docs/architecture.md](docs/architecture.md) for the complete design and [examples/example-node.json](examples/example-node.json) for a valid node.

## Codex skill

The reusable skill is included at [`skills/research-tree`](skills/research-tree). Copy that directory to `$CODEX_HOME/skills/research-tree` (or `~/.codex/skills/research-tree` when `CODEX_HOME` is unset), then invoke it as `$research-tree` or let Codex select it automatically for Research Tree work.

## Privacy

The repository contains only a fictional community-library example. It does not include private research content, deployment identifiers, browser storage, local filesystem paths, or the source application's Git history.
