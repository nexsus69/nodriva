/** Refreshes an administrative projection from its authoritative server action. */
import { AppCache } from "@/app/cache/GlobalCacheClient";

/**
 * Gives every optional administrative refresh the same meaning: discard all
 * cached admin read models, then load the current projection again.
 *
 * A manual refresh is deliberately broad. It is an explicit user request for
 * authoritative state, while normal mutations retain their narrower cache
 * invalidation for efficiency.
 */
export async function refreshAdminCollection(reload: () => Promise<void>): Promise<void> {
  AppCache.admin.invalidate();
  await reload();
}
