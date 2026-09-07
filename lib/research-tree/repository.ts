'use client';

import { validateDocument, migrateDocument } from './validation';
import { sampleProject } from './sample-data';
import {
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
    canvas: clone(tree.canvas ?? { backgroundBlocks: [], layerOrder: [] }),
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
            zoom: viewport.zoom,
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
  const value: unknown = migrateDocument(
    JSON.parse(json.replace(/^\uFEFF/, '')),
  );
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
  if (workspace.schemaVersion !== 1 || !Array.isArray(workspace.documents))
    throw new Error('workspace.documents: expected a workspace document list');
  const documents = workspace.documents.map((document) =>
    parseResearchTreeDocument(JSON.stringify(document)),
  );
  const closedDocuments = (workspace.closedDocuments ?? []).map((document) =>
    parseResearchTreeDocument(JSON.stringify(document)),
  );
  const ids = [...documents, ...closedDocuments].map(
    (document) => document.documentId,
  );
  if (new Set(ids).size !== ids.length)
    throw new Error('workspace.documents: duplicate documentId');
  return {
    schemaVersion: 1,
    activeDocumentId: documents.some(
      (document) => document.documentId === workspace.activeDocumentId,
    )
      ? workspace.activeDocumentId
      : (documents[0]?.documentId ?? ''),
    documents,
    closedDocuments,
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
    } catch (error) {
      return {
        schemaVersion: 1,
        activeDocumentId: '',
        documents: [],
        closedDocuments: [],
        loadError: error instanceof Error ? error.message : String(error),
      };
    }
    return createDefaultWorkspace();
  }

  saveWorkspace(workspace: ResearchTreeWorkspace) {
    if (typeof window === 'undefined') return;
    if (workspace.loadError) throw new Error(workspace.loadError);
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
