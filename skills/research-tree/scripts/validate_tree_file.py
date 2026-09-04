#!/usr/bin/env python3
"""Validate a portable .research-tree.json document."""

from __future__ import annotations

import json
import sys
from pathlib import Path

NODE_TYPES = {
    "evidence", "idea", "hypothesis", "assumption", "judgement",
    "decision", "openQuestion", "rejectedBranch",
}
NODE_STATUSES = {
    "confirmed", "tentative", "needsVerification", "rejected", "supersededReopened",
}
RELATIONSHIPS = {"supports", "contradicts", "modifies", "replaces", "dependsOn"}
LOGIC_TYPES = {"any", "all", "exactlyOne", "none", "not", "atLeastK"}


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"cannot read valid JSON: {exc}"]
    if not isinstance(data, dict):
        return ["root must be a JSON object"]
    if data.get("fileType") != "research-tree" or data.get("formatVersion") != 1:
        errors.append("fileType/formatVersion must identify Research Tree format 1")
    if list(data)[-1:] != ["end"] or data.get("end") != "end":
        errors.append('end must be the final key with value "end"')
    view = data.get("viewState")
    if not isinstance(view, dict) or view.get("language") not in {"en", "zh"}:
        errors.append("viewState.language must be en or zh")
    if not isinstance(view, dict) or view.get("activePanel") not in {"graph", "log"}:
        errors.append("viewState.activePanel must be graph or log")
    viewport = view.get("viewport") if isinstance(view, dict) else None
    if not isinstance(viewport, dict) or not all(isinstance(viewport.get(key), (int, float)) for key in ("x", "y", "zoom")):
        errors.append("viewState.viewport must contain numeric x, y and zoom")
    tree = data.get("tree")
    if not isinstance(tree, dict) or tree.get("schemaVersion") != 2:
        return errors + ["tree.schemaVersion must equal 2"]
    nodes = tree.get("nodes")
    edges = tree.get("edges")
    spots = tree.get("logicSpots")
    if not isinstance(nodes, list) or not isinstance(edges, list) or not isinstance(spots, list):
        return errors + ["nodes, edges and logicSpots must be arrays"]
    node_ids: set[str] = set()
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            errors.append(f"nodes[{index}] must be an object")
            continue
        keys = list(node)
        if keys[:1] != ["languageType"] or keys[-1:] != ["end"]:
            errors.append(f"nodes[{index}] must start with languageType and end with end")
        if node.get("languageType") != "en-zh" or node.get("end") != "end":
            errors.append(f"nodes[{index}] has invalid boundary values")
        if node.get("type") not in NODE_TYPES or node.get("status") not in NODE_STATUSES:
            errors.append(f"nodes[{index}] has invalid type or status")
        content = node.get("content")
        if not isinstance(content, dict) or set(content) != {"en", "zh"}:
            errors.append(f"nodes[{index}] must contain exactly en and zh")
        node_id = node.get("id")
        if not isinstance(node_id, str) or not node_id or node_id in node_ids:
            errors.append(f"nodes[{index}] has a missing or duplicate id")
        else:
            node_ids.add(node_id)
    for index, edge in enumerate(edges):
        if not isinstance(edge, dict) or edge.get("relationshipType") not in RELATIONSHIPS:
            errors.append(f"edges[{index}] is invalid")
            continue
        if edge.get("sourceNodeId") not in node_ids or edge.get("targetNodeId") not in node_ids:
            errors.append(f"edges[{index}] references a missing node")
    for index, spot in enumerate(spots):
        if not isinstance(spot, dict) or spot.get("logicType") not in LOGIC_TYPES:
            errors.append(f"logicSpots[{index}] is invalid")
            continue
        inputs = spot.get("inputNodeIds")
        if spot.get("parentNodeId") not in node_ids or not isinstance(inputs, list) or not all(item in node_ids for item in inputs):
            errors.append(f"logicSpots[{index}] references a missing node")
    return errors


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: validate_tree_file.py TREE.research-tree.json [...]", file=sys.stderr)
        return 2
    failed = False
    for raw_path in sys.argv[1:]:
        path = Path(raw_path)
        errors = validate(path)
        if errors:
            failed = True
            print(f"FAIL {path}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK   {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
