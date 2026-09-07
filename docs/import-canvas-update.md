# Import, workspace and canvas repair — 2026-09-08

The skill previously omitted the required bilingual project shape and decision-log anchor. Generated `name`/`description` files were rejected by the app, which concealed the actual error. This update documents and validates the full contract, migrates recognized legacy fields, and retains original multi-node logs and action values.

Closing a tab now stores the complete document in a local Reopen list. Closing the last tab remains an empty workspace after reload. Delete remains a separate action. Failed file imports are atomic, and failed storage loads never replace the original bytes with a sample. A same-ID import keeps the previous revision under `research-tree.import-backup.<documentId>`; the recovery banner can export the original workspace. Storage errors are visible; saves are debounced and flushed on page hide.

Background blocks are bilingual decorative canvas objects with colour, dimensions, position and a lock. Their header is the drag handle; selection exposes resize handles. The layer panel orders blocks, research nodes and logic spots from front to back. Lock prevents canvas dragging/resizing but permits deliberate edits through the panel. Blocks do not move surrounding nodes and never participate in logic. New blocks start behind research content.

Controlled node dragging now persists positions during movement. Filter state resets when importing or switching trees. Logic-derived status changes append history, and removing a node keeps its historical entries. Formal input deletion requires removing or changing its rule first.

## Verification

- Node tests cover canonical and legacy round-trips, bilingual field errors, history retention, references, invalid formal rules, canvas/layer persistence, tab closure/reopen, and corrupt-storage protection.
- Browser regression covers block title/size/colour/lock/order, reload, pointer drag/resize, file export, last-tab close/reopen, rejected import without data changes, and corrupt-workspace recovery. An optional external fixture checks the affected research file without adding private data to the repository.
- The skill Python validator and TypeScript checks use the same canonical fields and optional canvas contract; the example includes a background block.
- Existing WebMCP tools are retained. The browser automation bridge in the host app could not initialize in this session, so WebMCP integration was not reverified. Local browser UI regression is independent of that bridge.

## Migration and recovery

Existing storage key and document identities are unchanged. No browsing data or private research is published in source control. Keep portable file backups. Invalid workspace bytes remain at the original storage key; export them from the recovery banner before manual repair. The app does not silently drop a malformed tree from a workspace. Unknown actions or malformed canonical fields are rejected with their field path.
