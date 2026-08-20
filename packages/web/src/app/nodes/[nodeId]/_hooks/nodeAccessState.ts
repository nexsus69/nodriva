export type NodeAccessState = 'checking' | 'allowed' | 'denied' | 'unavailable';

export async function resolveNodeAccess(
  checkAccess: () => Promise<boolean>,
): Promise<Exclude<NodeAccessState, 'checking'>> {
  try {
    return await checkAccess() ? 'allowed' : 'denied';
  } catch {
    return 'unavailable';
  }
}
