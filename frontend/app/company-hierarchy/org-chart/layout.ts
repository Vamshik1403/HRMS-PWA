export const NODE_SIZE = {
  company: { width: 228, height: 56 },
  employee: { width: 312, height: 84 },
  department: { width: 248, height: 70 },
} as const;

export const LAYOUT = {
  hGap: 32,
  vGap: 96,
} as const;

export type LayoutKind = keyof typeof NODE_SIZE;

export type LayoutTree = {
  id: string;
  kind: LayoutKind;
  children: LayoutTree[];
};

function subtreeWidth(node: LayoutTree): number {
  const self = NODE_SIZE[node.kind].width;
  if (!node.children.length) return self;
  const child = node.children.reduce((sum, c) => sum + subtreeWidth(c), 0)
    + LAYOUT.hGap * (node.children.length - 1);
  return Math.max(self, child);
}

function place(
  node: LayoutTree,
  left: number,
  top: number,
  positions: Map<string, { x: number; y: number }>,
) {
  const size = NODE_SIZE[node.kind];
  const width = subtreeWidth(node);
  positions.set(node.id, {
    x: left + (width - size.width) / 2,
    y: top,
  });

  const childrenWidth = node.children.reduce((sum, c) => sum + subtreeWidth(c), 0)
    + LAYOUT.hGap * Math.max(0, node.children.length - 1);
  let cursor = left + Math.max(0, (width - childrenWidth) / 2);
  const childTop = top + size.height + LAYOUT.vGap;
  for (const child of node.children) {
    const cw = subtreeWidth(child);
    place(child, cursor, childTop, positions);
    cursor += cw + LAYOUT.hGap;
  }
}

export function layoutOrgTree(root: LayoutTree): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  place(root, 24, 16, positions);
  return positions;
}

/** Sit disconnected people on the last row, to the right of the connected tree. */
export function placeUnlinkedOnLastRow(
  positions: Map<string, { x: number; y: number }>,
  unlinkedIds: string[],
) {
  if (!unlinkedIds.length) return;
  const size = NODE_SIZE.employee;
  let maxX = 24;
  let lastY = 16;
  if (positions.size) {
    maxX = -Infinity;
    lastY = -Infinity;
    for (const pos of positions.values()) {
      maxX = Math.max(maxX, pos.x + size.width);
      lastY = Math.max(lastY, pos.y);
    }
  }
  let x = maxX + LAYOUT.hGap + 56;
  for (const id of unlinkedIds) {
    positions.set(id, { x, y: lastY });
    x += size.width + LAYOUT.hGap;
  }
}
