import type { ResearchTreeWorkspace, ResearchTreeDocument } from './types';

export function closeDocument(
  workspace: ResearchTreeWorkspace,
  id: string,
): ResearchTreeWorkspace {
  const index = workspace.documents.findIndex((d) => d.documentId === id);
  if (index < 0) return workspace;
  const documents = workspace.documents.filter((d) => d.documentId !== id);
  return {
    ...workspace,
    documents,
    closedDocuments: [
      workspace.documents[index],
      ...(workspace.closedDocuments ?? []).filter((d) => d.documentId !== id),
    ],
    activeDocumentId:
      workspace.activeDocumentId === id
        ? (documents[Math.min(index, documents.length - 1)]?.documentId ?? '')
        : workspace.activeDocumentId,
  };
}
export function reopenDocument(
  workspace: ResearchTreeWorkspace,
  id: string,
): ResearchTreeWorkspace {
  const document = workspace.closedDocuments?.find((d) => d.documentId === id);
  return document ? upsertDocument(workspace, document) : workspace;
}
export function upsertDocument(
  workspace: ResearchTreeWorkspace,
  document: ResearchTreeDocument,
): ResearchTreeWorkspace {
  return {
    ...workspace,
    activeDocumentId: document.documentId,
    documents: workspace.documents.some(
      (d) => d.documentId === document.documentId,
    )
      ? workspace.documents.map((d) =>
          d.documentId === document.documentId ? document : d,
        )
      : [...workspace.documents, document],
    closedDocuments: (workspace.closedDocuments ?? []).filter(
      (d) => d.documentId !== document.documentId,
    ),
  };
}
export function moveLayer(
  order: string[],
  id: string,
  direction: 'front' | 'back' | 'up' | 'down',
): string[] {
  const index = order.indexOf(id);
  if (index < 0) return order;
  const next = order.filter((item) => item !== id);
  const target =
    direction === 'front'
      ? next.length
      : direction === 'back'
        ? 0
        : direction === 'up'
          ? Math.min(next.length, index + 1)
          : Math.max(0, index - 1);
  next.splice(target, 0, id);
  return next;
}
