#!/usr/bin/env python3
"""Validate one or more exported Research Tree node JSON files."""

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
CONTENT_KEYS = {"title", "summary", "notes", "source", "assumptions"}


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"cannot read valid JSON: {exc}"]

    if not isinstance(data, dict):
        return ["root must be a JSON object"]
    keys = list(data)
    if not keys or keys[0] != "languageType":
        errors.append("languageType must be the first key")
    if not keys or keys[-1] != "end":
        errors.append("end must be the last key")
    if data.get("languageType") != "en-zh":
        errors.append('languageType must equal "en-zh"')
    if data.get("end") != "end":
        errors.append('end must equal "end"')
    if data.get("type") not in NODE_TYPES:
        errors.append("invalid node type")
    if data.get("status") not in NODE_STATUSES:
        errors.append("invalid node status")
    content = data.get("content")
    if not isinstance(content, dict) or set(content) != {"en", "zh"}:
        errors.append("content must contain exactly en and zh")
    else:
        for language in ("en", "zh"):
            localized = content[language]
            if not isinstance(localized, dict) or set(localized) != CONTENT_KEYS:
                errors.append(f"content.{language} has invalid fields")
                continue
            if not isinstance(localized.get("title"), str) or not localized["title"].strip():
                errors.append(f"content.{language}.title must be non-empty")
            if not isinstance(localized.get("assumptions"), list):
                errors.append(f"content.{language}.assumptions must be an array")
    return errors


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: validate_node_json.py NODE.json [NODE.json ...]", file=sys.stderr)
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
