export const NODE_TYPES = [
  'evidence', 'idea', 'hypothesis', 'assumption',
  'judgement', 'decision', 'openQuestion', 'rejectedBranch',
] as const;

export const NODE_STATUSES = [
  'confirmed', 'tentative', 'needsVerification', 'rejected', 'supersededReopened',
] as const;

export const RELATIONSHIP_TYPES = [
  'supports', 'contradicts', 'modifies', 'replaces', 'dependsOn',
] as const;

export const LOGIC_SPOT_TYPES = [
  'any', 'all', 'exactlyOne', 'none', 'not', 'atLeastK',
] as const;

export type LanguageType = 'en-zh';
export type Language = 'en' | 'zh';
export type NodeType = (typeof NODE_TYPES)[number];
export type NodeStatus = (typeof NODE_STATUSES)[number];
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
export type LogicSpotType = (typeof LOGIC_SPOT_TYPES)[number];

export type LocalizedText = { en: string; zh: string };

export type LocalizedNodeContent = {
  title: string;
  summary: string;
  notes: string;
  source: string;
  assumptions: string[];
};

/** languageType is serialized first and end is serialized last. */
export type ResearchNode = {
  languageType: LanguageType;
  id: string;
  type: NodeType;
  status: NodeStatus;
  content: Record<Language, LocalizedNodeContent>;
  createdAt: string;
  updatedAt: string;
  end: 'end';
};

export type ResearchEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: RelationshipType;
  note: LocalizedText;
  createdAt: string;
};

export type LogicSpot = {
  languageType: LanguageType;
  id: string;
  label: LocalizedText;
  logicType: LogicSpotType;
  threshold: number | null;
  parentNodeId: string;
  inputNodeIds: string[];
  createdAt: string;
  updatedAt: string;
  end: 'end';
};

export type DecisionLogEntry = {
  id: string;
  nodeId: string;
  action: 'created' | 'updated' | 'statusChanged' | 'impact' | 'relationship' | 'logicSpot';
  summary: LocalizedText;
  timestamp: string;
};

export type Position = { x: number; y: number };

export type ResearchProjectState = {
  schemaVersion: 2;
  project: { id: string; title: LocalizedText; researchQuestion: LocalizedText };
  nodes: ResearchNode[];
  edges: ResearchEdge[];
  logicSpots: LogicSpot[];
  positions: Record<string, Position>;
  collapsedNodeIds: string[];
  decisionLog: DecisionLogEntry[];
};

export const emptyContent = (): LocalizedNodeContent => ({
  title: '', summary: '', notes: '', source: '', assumptions: [],
});

export const nodeText = (node: ResearchNode, language: Language) => node.content[language];
