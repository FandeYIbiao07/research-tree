import {
  LOGIC_SPOT_TYPES,
  NODE_STATUSES,
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  type ResearchTreeDocument,
} from './types';

type Obj = Record<string, unknown>;
const record = (v: unknown): v is Obj =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
function check(ok: unknown, path: string, message: string): asserts ok {
  if (!ok) throw new Error(`${path}: ${message}`);
}
function object(v: unknown, p: string): asserts v is Obj {
  check(record(v), p, 'expected object');
}
function string(v: unknown, p: string, nonempty = false): asserts v is string {
  check(
    typeof v === 'string' && (!nonempty || v.trim().length > 0),
    p,
    'expected string' + (nonempty ? ' (non-empty)' : ''),
  );
}
function array(v: unknown, p: string): asserts v is unknown[] {
  check(Array.isArray(v), p, 'expected array');
}
function text(v: unknown, p: string) {
  object(v, p);
  for (const l of ['en', 'zh']) string(v[l], `${p}.${l}`);
}
function time(v: unknown, p: string) {
  string(v, p);
  check(
    /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
      Number.isFinite(Date.parse(v)),
    p,
    'expected ISO timestamp with timezone',
  );
}
function uniqueId(v: unknown, p: string, ids: Set<string>) {
  string(v, p, true);
  check(!ids.has(v), p, `duplicate ID "${v}"`);
  ids.add(v);
}
function boundary(v: Obj, p: string) {
  check(
    Object.keys(v)[0] === 'languageType' && v.languageType === 'en-zh',
    p + '.languageType',
    'must be first field and en-zh',
  );
  check(
    Object.keys(v).at(-1) === 'end' && v.end === 'end',
    p + '.end',
    'must be final field and end',
  );
}
function ref(v: unknown, p: string, ids: Set<string>) {
  string(v, p, true);
  check(ids.has(v), p, `missing node "${v}"`);
}

/** Only recognized legacy shapes migrate. Canonical but malformed fields still fail. */
export function migrateDocument(value: unknown): unknown {
  if (!record(value) || !record(value.tree)) return value;
  const tree = value.tree;
  if (record(tree.project)) {
    const project = tree.project;
    if (!('title' in project) && typeof project.name === 'string')
      project.title = { en: project.name, zh: project.name };
    if (
      !('researchQuestion' in project) &&
      typeof project.description === 'string'
    )
      project.researchQuestion = {
        en: project.description,
        zh: project.description,
      };
  }
  if (Array.isArray(tree.decisionLog))
    for (const entry of tree.decisionLog) {
      if (
        record(entry) &&
        !('nodeId' in entry) &&
        Array.isArray(entry.nodeIds) &&
        typeof entry.nodeIds[0] === 'string'
      )
        entry.nodeId = entry.nodeIds[0];
    }
  return value;
}

export function validateDocument(
  value: unknown,
): asserts value is ResearchTreeDocument {
  object(value, 'document');
  check(
    value.fileType === 'research-tree',
    'fileType',
    'expected research-tree',
  );
  check(value.formatVersion === 1, 'formatVersion', 'unsupported version');
  check(
    value.end === 'end' && Object.keys(value).at(-1) === 'end',
    'end',
    'must be final field and end',
  );
  string(value.documentId, 'documentId', true);
  time(value.savedAt, 'savedAt');
  object(value.viewState, 'viewState');
  check(
    ['en', 'zh'].includes(String(value.viewState.language)),
    'viewState.language',
    'expected en or zh',
  );
  check(
    ['graph', 'log'].includes(String(value.viewState.activePanel)),
    'viewState.activePanel',
    'expected graph or log',
  );
  object(value.viewState.viewport, 'viewState.viewport');
  for (const k of ['x', 'y', 'zoom'])
    check(
      Number.isFinite(value.viewState.viewport[k]),
      `viewState.viewport.${k}`,
      'expected finite number',
    );
  check(
    Number(value.viewState.viewport.zoom) > 0,
    'viewState.viewport.zoom',
    'must be positive',
  );
  const tree = value.tree;
  object(tree, 'tree');
  check(tree.schemaVersion === 2, 'tree.schemaVersion', 'expected 2');
  object(tree.project, 'tree.project');
  string(tree.project.id, 'tree.project.id', true);
  text(tree.project.title, 'tree.project.title');
  text(tree.project.researchQuestion, 'tree.project.researchQuestion');
  for (const k of [
    'nodes',
    'edges',
    'logicSpots',
    'decisionLog',
    'collapsedNodeIds',
  ])
    array(tree[k], `tree.${k}`);
  const nodes = tree.nodes as unknown[];
  const spots = tree.logicSpots as unknown[];
  const nodeIds = new Set<string>();
  const objectIds = new Set<string>();
  nodes.forEach((n, i) => {
    const p = `tree.nodes[${i}]`;
    object(n, p);
    boundary(n, p);
    uniqueId(n.id, p + '.id', nodeIds);
    objectIds.add(String(n.id));
    check(
      NODE_TYPES.includes(n.type as never),
      p + '.type',
      'unknown node type',
    );
    check(
      NODE_STATUSES.includes(n.status as never),
      p + '.status',
      'unknown status',
    );
    object(n.content, p + '.content');
    for (const l of ['en', 'zh']) {
      const c = n.content[l];
      object(c, `${p}.content.${l}`);
      for (const k of ['title', 'summary', 'notes', 'source'])
        string(c[k], `${p}.content.${l}.${k}`);
      array(c.assumptions, `${p}.content.${l}.assumptions`);
      c.assumptions.forEach((a, j) =>
        string(a, `${p}.content.${l}.assumptions[${j}]`),
      );
    }
    time(n.createdAt, p + '.createdAt');
    time(n.updatedAt, p + '.updatedAt');
  });
  const edgeIds = new Set<string>();
  (tree.edges as unknown[]).forEach((e, i) => {
    const p = `tree.edges[${i}]`;
    object(e, p);
    uniqueId(e.id, p + '.id', edgeIds);
    ref(e.sourceNodeId, p + '.sourceNodeId', nodeIds);
    ref(e.targetNodeId, p + '.targetNodeId', nodeIds);
    check(
      RELATIONSHIP_TYPES.includes(e.relationshipType as never),
      p + '.relationshipType',
      'unknown relationship',
    );
    text(e.note, p + '.note');
    time(e.createdAt, p + '.createdAt');
  });
  const parents = new Set<string>();
  spots.forEach((s, i) => {
    const p = `tree.logicSpots[${i}]`;
    object(s, p);
    boundary(s, p);
    uniqueId(s.id, p + '.id', objectIds);
    ref(s.parentNodeId, p + '.parentNodeId', nodeIds);
    check(
      !parents.has(String(s.parentNodeId)),
      p + '.parentNodeId',
      'parent already has a logic rule',
    );
    parents.add(String(s.parentNodeId));
    text(s.label, p + '.label');
    check(
      LOGIC_SPOT_TYPES.includes(s.logicType as never),
      p + '.logicType',
      'unknown logic rule',
    );
    array(s.inputNodeIds, p + '.inputNodeIds');
    check(
      s.inputNodeIds.length > 0,
      p + '.inputNodeIds',
      'must contain inputs',
    );
    check(
      new Set(s.inputNodeIds).size === s.inputNodeIds.length,
      p + '.inputNodeIds',
      'duplicate input',
    );
    s.inputNodeIds.forEach((id, j) => {
      ref(id, `${p}.inputNodeIds[${j}]`, nodeIds);
      check(
        id !== s.parentNodeId,
        `${p}.inputNodeIds[${j}]`,
        'cannot depend on itself',
      );
    });
    if (s.logicType === 'not')
      check(
        s.inputNodeIds.length === 1,
        p + '.inputNodeIds',
        'NOT requires exactly one input',
      );
    if (s.logicType === 'atLeastK')
      check(
        Number.isInteger(s.threshold) &&
          Number(s.threshold) >= 1 &&
          Number(s.threshold) <= s.inputNodeIds.length,
        p + '.threshold',
        'must be an integer from 1 to input count',
      );
    else
      check(
        s.threshold === null,
        p + '.threshold',
        'must be null for this rule',
      );
    time(s.createdAt, p + '.createdAt');
    time(s.updatedAt, p + '.updatedAt');
  });
  // A formal rule cannot derive itself through a chain of other rules.
  const dependencies = new Map(
    (spots as Obj[]).map((s) => [
      String(s.parentNodeId),
      s.inputNodeIds as string[],
    ]),
  );
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    check(!visiting.has(id), 'tree.logicSpots', 'cyclic logic dependency');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of dependencies.get(id) ?? []) visit(child);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of dependencies.keys()) visit(id);
  const logs = new Set<string>();
  (tree.decisionLog as unknown[]).forEach((e, i) => {
    const p = `tree.decisionLog[${i}]`;
    object(e, p);
    uniqueId(e.id, p + '.id', logs);
    string(e.nodeId, p + '.nodeId', true);
    // History is extensible metadata, never executable behavior. Retain legacy
    // and external action labels instead of refusing an entire workspace.
    string(e.action, p + '.action', true);
    text(e.summary, p + '.summary');
    time(e.timestamp, p + '.timestamp');
    if (e.nodeIds !== undefined) {
      array(e.nodeIds, p + '.nodeIds');
      e.nodeIds.forEach((id, j) => string(id, `${p}.nodeIds[${j}]`, true));
    }
  });
  object(tree.positions, 'tree.positions');
  for (const [id, pos] of Object.entries(tree.positions)) {
    object(pos, `tree.positions.${id}`);
    for (const k of ['x', 'y'])
      check(
        Number.isFinite(pos[k]),
        `tree.positions.${id}.${k}`,
        'expected finite number',
      );
  }
  (tree.collapsedNodeIds as unknown[]).forEach((id, i) =>
    ref(id, `tree.collapsedNodeIds[${i}]`, nodeIds),
  );
  if (tree.canvas !== undefined) {
    object(tree.canvas, 'tree.canvas');
    array(tree.canvas.backgroundBlocks, 'tree.canvas.backgroundBlocks');
    array(tree.canvas.layerOrder, 'tree.canvas.layerOrder');
    tree.canvas.backgroundBlocks.forEach((b, i) => {
      const p = `tree.canvas.backgroundBlocks[${i}]`;
      object(b, p);
      uniqueId(b.id, p + '.id', objectIds);
      text(b.title, p + '.title');
      check(
        typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color),
        p + '.color',
        'expected #RRGGBB',
      );
      for (const k of ['width', 'height'])
        check(
          Number.isFinite(b[k]) && Number(b[k]) >= 160,
          p + '.' + k,
          'expected size >= 160',
        );
      check(typeof b.locked === 'boolean', p + '.locked', 'expected boolean');
    });
    check(
      new Set(tree.canvas.layerOrder).size === tree.canvas.layerOrder.length,
      'tree.canvas.layerOrder',
      'duplicate ID',
    );
    tree.canvas.layerOrder.forEach((id, i) =>
      ref(id, `tree.canvas.layerOrder[${i}]`, objectIds),
    );
  }
  for (const id of objectIds)
    check(
      id in tree.positions,
      `tree.positions.${id}`,
      'missing canvas position',
    );
}
