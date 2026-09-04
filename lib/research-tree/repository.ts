'use client';

import { sampleProject } from './sample-data';
import type { ResearchNode, ResearchProjectState } from './types';

const PROJECT_KEY = 'research-tree.project.v2';
const NODE_PREFIX = 'research-tree.node.v2.';

type PersistedProject = Omit<ResearchProjectState, 'nodes'> & { nodeIds: string[] };

const cloneSample = () => JSON.parse(JSON.stringify(sampleProject)) as ResearchProjectState;

/** Produces one valid JSON document per node, with the required boundary lines. */
export function serializeNode(node: ResearchNode) {
  const ordered: ResearchNode = {
    languageType: node.languageType,
    id: node.id,
    type: node.type,
    status: node.status,
    content: node.content,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    end: 'end',
  };
  return JSON.stringify(ordered, null, 2);
}

export interface ResearchTreeRepository {
  load(): ResearchProjectState;
  save(state: ResearchProjectState): void;
  reset(): ResearchProjectState;
}

export class LocalResearchTreeRepository implements ResearchTreeRepository {
  load(): ResearchProjectState {
    if (typeof window === 'undefined') return cloneSample();
    try {
      const savedProject = window.localStorage.getItem(PROJECT_KEY);
      if (savedProject) {
        const metadata = JSON.parse(savedProject) as PersistedProject;
        const nodes = metadata.nodeIds
          .map((id) => window.localStorage.getItem(`${NODE_PREFIX}${id}`))
          .filter(Boolean)
          .map((json) => JSON.parse(json as string) as ResearchNode);
        if (metadata.schemaVersion === 2 && nodes.length === metadata.nodeIds.length) {
          const { nodeIds: _nodeIds, ...project } = metadata;
          return { ...project, nodes };
        }
      }
    } catch {
      return cloneSample();
    }
    return cloneSample();
  }

  save(state: ResearchProjectState) {
    if (typeof window === 'undefined') return;
    state.nodes.forEach((node) => {
      window.localStorage.setItem(`${NODE_PREFIX}${node.id}`, serializeNode(node));
    });
    const metadata: PersistedProject = {
      schemaVersion: 2,
      project: state.project,
      edges: state.edges,
      logicSpots: state.logicSpots,
      positions: state.positions,
      collapsedNodeIds: state.collapsedNodeIds,
      decisionLog: state.decisionLog,
      nodeIds: state.nodes.map((node) => node.id),
    };
    window.localStorage.setItem(PROJECT_KEY, JSON.stringify(metadata, null, 2));
  }

  reset() {
    if (typeof window !== 'undefined') {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith(NODE_PREFIX))
        .forEach((key) => window.localStorage.removeItem(key));
      window.localStorage.removeItem(PROJECT_KEY);
    }
    const state = cloneSample();
    this.save(state);
    return state;
  }
}

export const researchTreeRepository: ResearchTreeRepository = new LocalResearchTreeRepository();
