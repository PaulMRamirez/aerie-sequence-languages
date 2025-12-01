/**
 * Ported from `tree-utils.ts` in plandev-ui
 */
import type { EditorView } from '@codemirror/view';
import type { SyntaxNode, TreeCursor } from '@lezer/common';

export function numberOfChildren(node: SyntaxNode): number {
  let count = 0;
  let child = node.firstChild;
  while (child) {
    count++;
    child = child.nextSibling;
  }
  return count;
}

export function getChildrenNode(node: SyntaxNode): SyntaxNode[] {
  const children = [];
  let child = node.firstChild;
  while (child) {
    children.push(child);
    child = child.nextSibling;
  }
  return children;
}

export function getDeepestNode(node: SyntaxNode): SyntaxNode {
  let currentNode = node;
  while (currentNode.firstChild) {
    currentNode = currentNode.firstChild;
  }
  while (currentNode.nextSibling) {
    currentNode = currentNode.nextSibling;
  }
  return currentNode;
}

export function getFromAndTo(nodes: (SyntaxNode | null)[]): { from: number; to: number } {
  return nodes.reduce(
    (acc, node) => {
      if (node === null) {
        return acc;
      }
      return {
        from: Math.min(acc.from, node.from),
        to: Math.max(acc.to, node.to),
      };
    },
    { from: nodes[0]?.from ?? 0, to: nodes[0]?.to ?? 0 },
  );
}

export function getNearestAncestorNodeOfType(node: SyntaxNode | null, ancestorTypes: string[]) {
  let ancestorNode: SyntaxNode | null = node;

  while (ancestorNode && !ancestorTypes.includes(ancestorNode.name)) {
    ancestorNode = ancestorNode.parent;
  }
  return ancestorNode;
}

/**
 *
 * @param node
 * @param typesOfAncestorsAndSelf - array of node types to check containment [ great-grandparent, grandparent, undefined, selfType ]
 * @returns if node type and container matches criteria
 */
export function checkContainment(node: SyntaxNode, typesOfAncestorsAndSelf: (string | undefined)[]): boolean {
  if (typesOfAncestorsAndSelf.length === 0) {
    return true;
  }

  const comp = typesOfAncestorsAndSelf[typesOfAncestorsAndSelf.length - 1];
  if (comp === undefined || node.name === comp) {
    return (
      !!node.parent &&
      checkContainment(node.parent, typesOfAncestorsAndSelf.slice(0, typesOfAncestorsAndSelf.length - 1))
    );
  }

  return false;
}

export function* filterNodes(cursor: TreeCursor, filter?: (node: SyntaxNode) => boolean): Generator<SyntaxNode> {
  do {
    const { node } = cursor;
    if (!filter || filter(node)) {
      yield node;
    }
  } while (cursor.next());
}

export function filterNodesToArray(cursor: TreeCursor, filter?: (node: SyntaxNode) => boolean): SyntaxNode[] {
  return Array.from(filterNodes(cursor, filter));
}

export function nodeContents(input: string, node: SyntaxNode): string {
  return input.substring(node.from, node.to);
}

/**
 * Returns a text token range for a line in the view at a given position.
 * @see https://codemirror.net/examples/tooltip/#hover-tooltips
 */
export function getTokenPositionInLine(view: EditorView, pos: number) {
  const { from, to, text } = view.state.doc.lineAt(pos);
  const tokenRegex = /[a-zA-Z0-9_".-]/;

  let start = pos;
  let end = pos;

  while (start > from && tokenRegex.test(text[start - from - 1])) {
    --start;
  }

  while (end < to && tokenRegex.test(text[end - from])) {
    ++end;
  }

  return { from: start, to: end };
}
