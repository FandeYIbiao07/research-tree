import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createResearchTreeDocument,
  parseResearchTreeDocument,
  serializeResearchTreeDocument,
  LocalResearchTreeRepository,
} from '../lib/research-tree/repository';
import {
  closeDocument,
  reopenDocument,
  upsertDocument,
  moveLayer,
} from '../lib/research-tree/workspace';
import type { ResearchTreeWorkspace } from '../lib/research-tree/types';
const fixture = () => createResearchTreeDocument();
const roundtrip = (doc: unknown) =>
  parseResearchTreeDocument(JSON.stringify(doc));
test('canonical document preserves bilingual content, identities and history', () => {
  const d = fixture();
  assert.deepEqual(roundtrip(d).tree, d.tree);
});
test('recognized legacy project and multi-node actions migrate without losing originals', () => {
  const d: any = fixture();
  d.tree.project = {
    id: 'legacy',
    name: 'Old title',
    description: 'Old question',
  };
  d.tree.decisionLog = [
    {
      id: 'history',
      nodeIds: ['deleted-node', 'second-node'],
      action: 'impactRecorded',
      summary: { en: 'History', zh: '历史' },
      timestamp: d.savedAt,
    },
  ];
  const fixed = roundtrip(d);
  assert.deepEqual(fixed.tree.project.title, {
    en: 'Old title',
    zh: 'Old title',
  });
  assert.equal((fixed.tree.project as any).name, 'Old title');
  assert.deepEqual(fixed.tree.decisionLog[0].nodeIds, [
    'deleted-node',
    'second-node',
  ]);
  assert.equal(fixed.tree.decisionLog[0].nodeId, 'deleted-node');
  assert.equal(fixed.tree.decisionLog[0].action, 'impactRecorded');
  assert.deepEqual(roundtrip(fixed).tree, fixed.tree);
});
test('malformed canonical field cannot hide behind legacy fallback', () => {
  const d: any = fixture();
  d.tree.project.title = { en: 'Broken' };
  d.tree.project.name = 'Legacy';
  assert.throws(() => roundtrip(d), /tree.project.title.zh/);
});
test('UTF-8 BOM is supported', () =>
  assert.equal(
    parseResearchTreeDocument('\uFEFF' + JSON.stringify(fixture())).fileType,
    'research-tree',
  ));
test('field errors identify bad content, positions, log actions and graph references', () => {
  for (const [mutate, error] of [
    [(d: any) => (d.tree.nodes[0].content.zh.notes = 3), /content.zh.notes/],
    [
      (d: any) => (d.tree.positions[d.tree.nodes[0].id].x = null),
      /positions.*x/,
    ],
    [
      (d: any) => (d.tree.edges[0].targetNodeId = 'absent'),
      /targetNodeId.*missing/,
    ],
    [
      (d: any) => (d.tree.decisionLog[0].action = ''),
      /decisionLog\[0\].action/,
    ],
    [(d: any) => (d.viewState.viewport.zoom = 0), /viewport.zoom/],
  ] as const) {
    const d = fixture();
    mutate(d);
    assert.throws(() => roundtrip(d), error);
  }
});
test('logic rejects ambiguous parents, self-dependency and invalid NOT/K', () => {
  for (const mutate of [
    (d: any) => {
      d.tree.logicSpots.push({ ...d.tree.logicSpots[0], id: 'duplicate-rule' });
    },
    (d: any) => {
      d.tree.logicSpots[0].inputNodeIds = [d.tree.logicSpots[0].parentNodeId];
    },
    (d: any) => {
      d.tree.logicSpots[0].logicType = 'not';
    },
    (d: any) => {
      d.tree.logicSpots[0].logicType = 'atLeastK';
      d.tree.logicSpots[0].threshold = 999;
    },
  ]) {
    const d = fixture();
    mutate(d);
    assert.throws(() => roundtrip(d), /logicSpots/);
  }
});
test('background size, lock and all-object layer ordering survive portable roundtrip', () => {
  const d = fixture();
  d.tree.canvas = {
    backgroundBlocks: [
      {
        id: 'bg',
        title: { en: 'Group', zh: '分组' },
        color: '#3399aa',
        width: 650,
        height: 410,
        locked: true,
      },
    ],
    layerOrder: ['bg', ...d.tree.nodes.map((n) => n.id)],
  };
  d.tree.positions.bg = { x: -300, y: 120 };
  d.viewState.viewport.zoom = 0.12;
  const restored = parseResearchTreeDocument(serializeResearchTreeDocument(d));
  assert.deepEqual(restored.tree, d.tree);
  assert.deepEqual(restored.viewState, d.viewState);
});
test('closing inactive, active and last tabs preserves documents and can reopen each', () => {
  const a = fixture(),
    b = { ...fixture(), documentId: 'second' };
  let w: ResearchTreeWorkspace = {
    schemaVersion: 1,
    documents: [a, b],
    activeDocumentId: a.documentId,
  };
  w = closeDocument(w, b.documentId);
  assert.equal(w.activeDocumentId, a.documentId);
  w = closeDocument(w, a.documentId);
  assert.equal(w.documents.length, 0);
  assert.equal(w.activeDocumentId, '');
  assert.equal(w.closedDocuments?.length, 2);
  w = reopenDocument(w, b.documentId);
  assert.equal(w.documents[0].documentId, 'second');
  assert.equal(w.closedDocuments?.length, 1);
  w = upsertDocument(w, a);
  assert.equal(w.documents.length, 2);
  assert.equal(w.closedDocuments?.length, 0);
});
test('active close selects the adjacent tab and layer movement respects bounds', () => {
  const a = fixture(),
    b = { ...fixture(), documentId: 'b' },
    c = { ...fixture(), documentId: 'c' };
  const w: ResearchTreeWorkspace = {
    schemaVersion: 1,
    documents: [a, b, c],
    activeDocumentId: 'b',
  };
  assert.equal(closeDocument(w, 'b').activeDocumentId, 'c');
  assert.deepEqual(moveLayer(['a', 'b', 'c'], 'b', 'front'), ['a', 'c', 'b']);
  assert.deepEqual(moveLayer(['a', 'b', 'c'], 'a', 'down'), ['a', 'b', 'c']);
});
test('corrupt workspace never gets overwritten; empty workspace stays empty after reload', () => {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  };
  (globalThis as any).window = { localStorage };
  const repo = new LocalResearchTreeRepository();
  const raw = '{"schemaVersion":1,"documents":[{"broken":true}]}';
  localStorage.setItem('research-tree.workspace.v3', raw);
  const loaded = repo.loadWorkspace();
  assert.ok(loaded.loadError);
  assert.throws(() => repo.saveWorkspace(loaded));
  assert.equal(localStorage.getItem('research-tree.workspace.v3'), raw);
  const empty: ResearchTreeWorkspace = {
    schemaVersion: 1,
    activeDocumentId: '',
    documents: [],
    closedDocuments: [fixture()],
  };
  repo.saveWorkspace(empty);
  assert.deepEqual(repo.loadWorkspace(), empty);
  delete (globalThis as any).window;
});
test('private fixture supplied locally is checked without entering repository', () => {
  if (!process.env.RESEARCH_TREE_FIXTURE) return;
  const doc = parseResearchTreeDocument(
    readFileSync(process.env.RESEARCH_TREE_FIXTURE, 'utf8'),
  );
  assert.ok(doc.tree.nodes.length >= 94);
  assert.ok(doc.tree.edges.length >= 115);
  assert.equal(doc.tree.logicSpots.length, 1);
  assert.ok(doc.tree.decisionLog.length >= 97);
  assert.deepEqual(roundtrip(doc).tree, doc.tree);
});

test('custom historical actions survive workspace load, close and reopen unchanged', () => {
  const d = fixture();
  d.tree.decisionLog[0].action = 'research-section-reorganized';
  const values = new Map<string, string>();
  (globalThis as any).window = { localStorage: {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  } };
  try {
    const repo = new LocalResearchTreeRepository();
    repo.saveWorkspace({schemaVersion: 1, activeDocumentId: d.documentId, documents: [d]});
    const w = repo.loadWorkspace();
    assert.equal(w.loadError, undefined);
    const reopened = reopenDocument(closeDocument(w, d.documentId), d.documentId);
    assert.deepEqual(reopened.documents[0].tree.decisionLog, d.tree.decisionLog);
    assert.deepEqual(roundtrip(reopened.documents[0]).tree.decisionLog, d.tree.decisionLog);
  } finally { delete (globalThis as any).window; }
});

test('optional local workspace recovers all documents and original history', () => {
  if (!process.env.RESEARCH_TREE_WORKSPACE_FIXTURE) return;
  const raw = readFileSync(process.env.RESEARCH_TREE_WORKSPACE_FIXTURE, 'utf8');
  const original = JSON.parse(raw);
  (globalThis as any).window = { localStorage: {getItem: (k: string) => k === 'research-tree.workspace.v3' ? raw : null} };
  try {
    const loaded = new LocalResearchTreeRepository().loadWorkspace();
    assert.equal(loaded.loadError, undefined);
    assert.equal(loaded.documents.length, original.documents.length);
    loaded.documents.forEach((d, i) => {
      assert.deepEqual(d.tree.nodes, original.documents[i].tree.nodes);
      assert.deepEqual(d.tree.edges, original.documents[i].tree.edges);
      assert.deepEqual(d.tree.decisionLog, original.documents[i].tree.decisionLog);
    });
  } finally { delete (globalThis as any).window; }
});
