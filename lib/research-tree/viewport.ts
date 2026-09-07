import { getNodesBounds, type Node, type Rect } from '@xyflow/react';

/** Fit the visible reasoning, not the decorative canvas behind it. */
export function reasoningBounds(nodes: Node[], visibleIds?: ReadonlySet<string>): Rect | null {
  const targets = nodes
    .filter((node) => node.type !== 'background' && !node.hidden && (!visibleIds || visibleIds.has(node.id)))
    .map((node) => ({
      ...node,
      width: node.measured?.width ?? node.width ?? (node.type === 'logic' ? 116 : 258),
      height: node.measured?.height ?? node.height ?? (node.type === 'logic' ? 116 : 240),
    }));
  return targets.length ? getNodesBounds(targets) : null;
}
