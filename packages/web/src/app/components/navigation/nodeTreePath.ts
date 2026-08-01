export function isNodeAncestorOfPath(
  nodePath: string,
  activeNodePath?: string
): boolean {
  return Boolean(
    activeNodePath &&
      nodePath !== activeNodePath &&
      activeNodePath.startsWith(`${nodePath}.`)
  );
}
