#!/usr/bin/env python3
"""Validate canonical portable tree files without modifying them."""
import json
import sys
from pathlib import Path
from research_tree_contract import validate_document

def validate(path):
    try:
        return validate_document(json.loads(Path(path).read_text(encoding='utf-8-sig')))
    except (OSError, ValueError) as exc:
        return [f'JSON: {exc}']

def main():
    if len(sys.argv) < 2:
        print('usage: validate_tree_file.py TREE.research-tree.json [...]', file=sys.stderr)
        return 2
    failed = False
    for name in sys.argv[1:]:
        errors = validate(name)
        print(('FAIL ' if errors else 'OK   ') + name)
        for error in errors:
            print('  - ' + error)
        failed = failed or bool(errors)
    return int(failed)

if __name__ == '__main__':
    raise SystemExit(main())
