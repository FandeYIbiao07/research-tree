'use client';

import { sampleProject } from './sample-data';
import {
  LOGIC_SPOT_TYPES,
  NODE_STATUSES,
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  type Language,
  type LocalizedNodeContent,
  type LocalizedText,
  type ResearchNode,
  type ResearchProjectState,
  type ResearchTreeDocument,
  type ResearchTreeViewState,
  type ResearchTreeWorkspace,
} from './types';

const WORKSPACE_KEY = 'research-tree.workspace.v3';
const LEGACY_PROJECT_KEY = 'research-tree.project.v2';
const LEGACY_NODE_PREFIX = 'research-tree.node.v2.';
const LEGACY_V1_KEY = 'research-tree.project.v1';

type PersistedProject = Omit<ResearchProjectState, 'nodes'> & {
  nodeIds: string[];
};
type LegacyNode = {
  id: string;
  title: string;
  type: ResearchNode['type'];
  status: ResearchNode['status'];
  summary: string;
  notes: string;
  source: string;
  assumptions: string[];
  createdAt: string;
  updatedAt: string;
};
type LegacyState = {
  schemaVersion: 1;
  project: { id: string; title: string; researchQuestion: string };
  nodes: LegacyNode[];
  edges: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    relationshipType: ResearchProjectState['edges'][number]['relationshipType'];
    note: string;
    createdAt: string;
  }>;
  positions: ResearchProjectState['positions'];
  collapsedNodeIds: string[];
  decisionLog: Array<{
    id: string;
    nodeId: string;
    action: Exclude<
      ResearchProjectState['decisionLog'][number]['action'],
      'logicSpot'
    >;
    summary: string;
    timestamp: string;
  }>;
};

export const DEFAULT_VIEW_STATE: ResearchTreeViewState = {
  language: 'en',
  activePanel: 'graph',
  viewport: { x: 40, y: 40, zoom: 0.72 },
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const both = (value: string): LocalizedText => ({ en: value, zh: value });
const makeId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `tree-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function splitBilingual(value: string): LocalizedText {
  const parts = value.split(/\s+\/\s+(?=[\u3400-\u9fff])/u);
  return parts.length > 1
    ? { en: parts[0], zh: parts.slice(1).join(' / ') }
    : both(value);
}

function legacyContent(
  node: LegacyNode,
): Record<Language, LocalizedNodeContent> {
  const title = splitBilingual(node.title);
  return {
    en: {
      title: title.en,
      summary: node.summary,
      notes: node.notes,
      source: node.source,
      assumptions: node.assumptions,
    },
    zh: {
      title: title.zh,
      summary: node.summary,
      notes: node.notes,
      source: node.source,
      assumptions: node.assumptions,
    },
  };
}

function migrateLegacyV1(legacy: LegacyState): ResearchProjectState {
  return {
    schemaVersion: 2,
    project: {
      id: legacy.project.id,
      title: splitBilingual(legacy.project.title),
      researchQuestion: splitBilingual(legacy.project.researchQuestion),
    },
    nodes: legacy.nodes.map((node) => ({
      languageType: 'en-zh',
      id: node.id,
      type: node.type,
      status: node.status,
      content: legacyContent(node),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      end: 'end',
    })),
    edges: legacy.edges.map((edge) => ({ ...edge, note: both(edge.note) })),
    logicSpots: [],
    positions: legacy.positions,
    collapsedNodeIds: legacy.collapsedNodeIds,
    decisionLog: legacy.decisionLog.map((entry) => ({
      ...entry,
      summary: both(entry.summary),
    })),
  };
}

/** Keeps the first and last node fields stable inside exported tree files. */
export function orderedNode(node: ResearchNode): ResearchNode {
  return {
    languageType: 'en-zh',
    id: node.id,
    type: node.type,
    status: node.status,
    content: node.content,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    end: 'end',
  };
}

export function serializeNode(node: ResearchNode) {
  return JSON.stringify(orderedNode(node), null, 2);
}

function normalizeTree(tree: ResearchProjectState): ResearchProjectState {
  return {
    schemaVersion: 2,
    project: clone(tree.project),
    nodes: tree.nodes.map(orderedNode),
    edges: clone(tree.edges),
    logicSpots: clone(tree.logicSpots),
    positions: clone(tree.positions),
    collapsedNodeIds: [...tree.collapsedNodeIds],
    decisionLog: clone(tree.decisionLog),
  };
}

function normalizeViewState(
  value?: Partial<ResearchTreeViewState>,
): ResearchTreeViewState {
  const viewport = value?.viewport;
  return {
    language: value?.language === 'zh' ? 'zh' : 'en',
    activePanel: value?.activePanel === 'log' ? 'log' : 'graph',
    viewport:
      viewport &&
      Number.isFinite(viewport.x) &&
      Number.isFinite(viewport.y) &&
      Number.isFinite(viewport.zoom)
        ? {
            x: viewport.x,
            y: viewport.y,
            zoom: Math.max(0.24, Math.min(1.7, viewport.zoom)),
          }
        : { ...DEFAULT_VIEW_STATE.viewport },
  };
}

export function createResearchTreeDocument(
  tree: ResearchProjectState = clone(sampleProject),
  viewState: Partial<ResearchTreeViewState> = DEFAULT_VIEW_STATE,
  documentId = tree.project.id || makeId(),
): ResearchTreeDocument {
  return {
    fileType: 'research-tree',
    formatVersion: 1,
    documentId,
    savedAt: new Date().toISOString(),
    viewState: normalizeViewState(viewState),
    tree: normalizeTree(tree),
    end: 'end',
  };
}

export function createBlankResearchTreeDocument(
  title: LocalizedText,
  researchQuestion: LocalizedText,
  language: Language,
): ResearchTreeDocument {
  const id = makeId();
  return createResearchTreeDocument(
    {
      schemaVersion: 2,
      project: { id, title, researchQuestion },
      nodes: [],
      edges: [],
      logicSpots: [],
      positions: {},
      collapsedNodeIds: [],
      decisionLog: [],
    },
    { ...DEFAULT_VIEW_STATE, language },
    id,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateDocument(
  value: unknown,
): asserts value is ResearchTreeDocument {
  if (
    !isRecord(value) ||
    value.fileType !== 'research-tree' ||
    value.formatVersion !== 1 ||
    value.end !== 'end'
  ) {
    throw new Error('This is not a Research Tree file.');
  }
  if (Object.keys(value).at(-1) !== 'end')
    throw new Error('The file end marker must be the final field.');
  if (typeof value.documentId !== 'string' || !value.documentId.trim())
    throw new Error('The file has no document ID.');
  const tree = value.tree;
  if (!isRecord(tree) || tree.schemaVersion !== 2 || !isRecord(tree.project))
    throw new Error('The tree structure is invalid.');
  const project = tree.project;
  const projectTitle = project.title;
  const projectQuestion = project.researchQuestion;
  if (
    !isRecord(projectTitle) ||
    !isRecord(projectQuestion) ||
    !['en', 'zh'].every(
      (language) =>
        typeof projectTitle[language] === 'string' &&
        typeof projectQuestion[language] === 'string',
    )
  )
    throw new Error('The bilingual project title or question is invalid.');
  if (
    !Array.isArray(tree.nodes) ||
    !Array.isArray(tree.edges) ||
    !Array.isArray(tree.logicSpots) ||
    !Array.isArray(tree.decisionLog)
  ) {
    throw new Error('The tree collections are invalid.');
  }
  if (!isRecord(tree.positions) || !Array.isArray(tree.collapsedNodeIds))
    throw new Error('The saved layout is invalid.');
  const nodeIds = new Set<string>();
  for (const rawNode of tree.nodes) {
    if (!isRecord(rawNode)) throw new Error('A node is invalid.');
    const keys = Object.keys(rawNode);
    if (
      keys[0] !== 'languageType' ||
      keys.at(-1) !== 'end' ||
      rawNode.languageType !== 'en-zh' ||
      rawNode.end !== 'end'
    ) {
      throw new Error(
        'A node does not follow the required JSON boundary order.',
      );
    }
    if (typeof rawNode.id !== 'string' || nodeIds.has(rawNode.id))
      throw new Error('Node IDs must be unique.');
    if (
      !NODE_TYPES.includes(rawNode.type as ResearchNode['type']) ||
      !NODE_STATUSES.includes(rawNode.status as ResearchNode['status'])
    ) {
      throw new Error('A node type or status is invalid.');
    }
    if (
      !isRecord(rawNode.content) ||
      !isRecord(rawNode.content.en) ||
      !isRecord(rawNode.content.zh)
    ) {
      throw new Error('Every node must contain English and Chinese content.');
    }
    for (const language of ['en', 'zh'] as const) {
      const content = rawNode.content[language];
      if (
        !isRecord(content) ||
        typeof content.title !== 'string' ||
        !Array.isArray(content.assumptions)
      )
        throw new Error('A node has invalid bilingual content.');
    }
    nodeIds.add(rawNode.id);
  }
  for (const rawEdge of tree.edges) {
    if (
      !isRecord(rawEdge) ||
      !nodeIds.has(String(rawEdge.sourceNodeId)) ||
      !nodeIds.has(String(rawEdge.targetNodeId))
    ) {
      throw new Error('An edge references a missing node.');
    }
    if (
      !RELATIONSHIP_TYPES.includes(
        rawEdge.relationshipType as ResearchProjectState['edges'][number]['relationshipType'],
      )
    ) {
      throw new Error('An edge relationship is invalid.');
    }
  }
  for (const rawSpot of tree.logicSpots) {
    if (
      !isRecord(rawSpot) ||
      !nodeIds.has(String(rawSpot.parentNodeId)) ||
      !Array.isArray(rawSpot.inputNodeIds)
    ) {
      throw new Error('A logic spot is invalid.');
    }
    const spotKeys = Object.keys(rawSpot);
    if (
      spotKeys[0] !== 'languageType' ||
      spotKeys.at(-1) !== 'end' ||
      rawSpot.languageType !== 'en-zh' ||
      rawSpot.end !== 'end'
    )
      throw new Error(
        'A logic spot does not follow the required JSON boundary order.',
      );
    if (
      !LOGIC_SPOT_TYPES.includes(
        rawSpot.logicType as ResearchProjectState['logicSpots'][number]['logicType'],
      )
    ) {
      throw new Error('A logic rule is invalid.');
    }
    if (!rawSpot.inputNodeIds.every((id) => nodeIds.has(String(id))))
      throw new Error('A logic spot references a missing node.');
  }
  for (const position of Object.values(tree.positions)) {
    if (
      !isRecord(position) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    )
      throw new Error('A saved node position is invalid.');
  }
  if (
    !tree.collapsedNodeIds.every(
      (id) => typeof id === 'string' && nodeIds.has(id),
    )
  )
    throw new Error('A collapsed branch references a missing node.');
}

function normalizeDocument(
  document: ResearchTreeDocument,
): ResearchTreeDocument {
  return {
    fileType: 'research-tree',
    formatVersion: 1,
    documentId: document.documentId,
    savedAt:
      typeof document.savedAt === 'string'
        ? document.savedAt
        : new Date().toISOString(),
    viewState: normalizeViewState(document.viewState),
    tree: normalizeTree(document.tree),
    end: 'end',
  };
}

export function parseResearchTreeDocument(json: string): ResearchTreeDocument {
  const value: unknown = JSON.parse(json);
  validateDocument(value);
  return normalizeDocument(value);
}

export function serializeResearchTreeDocument(document: ResearchTreeDocument) {
  const normalized = normalizeDocument({
    ...document,
    savedAt: new Date().toISOString(),
  });
  return JSON.stringify(normalized, null, 2);
}

function createDefaultWorkspace(): ResearchTreeWorkspace {
  const document = createResearchTreeDocument();
  return {
    schemaVersion: 1,
    activeDocumentId: document.documentId,
    documents: [document],
  };
}

function normalizeWorkspace(
  workspace: ResearchTreeWorkspace,
): ResearchTreeWorkspace {
  const documents = workspace.documents.map((document) => {
    validateDocument(document);
    return normalizeDocument(document);
  });
  if (!documents.length) return createDefaultWorkspace();
  return {
    schemaVersion: 1,
    activeDocumentId: documents.some(
      (document) => document.documentId === workspace.activeDocumentId,
    )
      ? workspace.activeDocumentId
      : documents[0].documentId,
    documents,
  };
}

export interface ResearchTreeRepository {
  loadWorkspace(): ResearchTreeWorkspace;
  saveWorkspace(workspace: ResearchTreeWorkspace): void;
  resetDocument(documentId: string, language: Language): ResearchTreeDocument;
  reset(): ResearchProjectState;
}

export class LocalResearchTreeRepository implements ResearchTreeRepository {
  loadWorkspace(): ResearchTreeWorkspace {
    if (typeof window === 'undefined') return createDefaultWorkspace();
    try {
      const legacyLanguage: Language =
        window.localStorage.getItem('research-tree.language') === 'zh'
          ? 'zh'
          : 'en';
      const savedWorkspace = window.localStorage.getItem(WORKSPACE_KEY);
      if (savedWorkspace)
        return normalizeWorkspace(
          JSON.parse(savedWorkspace) as ResearchTreeWorkspace,
        );

      const savedProject = window.localStorage.getItem(LEGACY_PROJECT_KEY);
      if (savedProject) {
        const metadata = JSON.parse(savedProject) as PersistedProject;
        const nodes = metadata.nodeIds
          .map((id) =>
            window.localStorage.getItem(`${LEGACY_NODE_PREFIX}${id}`),
          )
          .filter(Boolean)
          .map((json) => JSON.parse(json as string) as ResearchNode);
        if (
          metadata.schemaVersion === 2 &&
          nodes.length === metadata.nodeIds.length
        ) {
          const { nodeIds: _nodeIds, ...project } = metadata;
          const document = createResearchTreeDocument(
            { ...project, nodes },
            { ...DEFAULT_VIEW_STATE, language: legacyLanguage },
          );
          const workspace = {
            schemaVersion: 1 as const,
            activeDocumentId: document.documentId,
            documents: [document],
          };
          this.saveWorkspace(workspace);
          return workspace;
        }
      }

      const legacyJson = window.localStorage.getItem(LEGACY_V1_KEY);
      if (legacyJson) {
        const document = createResearchTreeDocument(
          migrateLegacyV1(JSON.parse(legacyJson) as LegacyState),
          { ...DEFAULT_VIEW_STATE, language: legacyLanguage },
        );
        const workspace = {
          schemaVersion: 1 as const,
          activeDocumentId: document.documentId,
          documents: [document],
        };
        this.saveWorkspace(workspace);
        return workspace;
      }
    } catch {
      return createDefaultWorkspace();
    }
    return createDefaultWorkspace();
  }

  saveWorkspace(workspace: ResearchTreeWorkspace) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  }

  resetDocument(documentId: string, language: Language) {
    return createResearchTreeDocument(
      clone(sampleProject),
      { ...DEFAULT_VIEW_STATE, language },
      documentId,
    );
  }

  reset() {
    return clone(sampleProject);
  }
}

export const researchTreeRepository: ResearchTreeRepository =
  new LocalResearchTreeRepository();
