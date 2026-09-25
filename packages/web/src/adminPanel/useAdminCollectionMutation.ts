"use client";

/** Reuses the mutation lifecycle for a remote administrative collection. */
import { useCallback } from "react";
import { useUserMutation } from "@/app/mutations/useUserMutation";

export function useAdminCollectionMutation(refresh: () => Promise<void>) {
  const mutation = useUserMutation();
  const execute = useCallback(async (operation: () => Promise<void>) => {
    const result = await mutation.execute(async () => {
      await operation();
      await refresh();
    });
    return result.ok;
  }, [mutation, refresh]);

  return {
    execute,
    pending: mutation.pending,
    mutationFailure: mutation.failure,
    retryMutation: () => void mutation.retry(),
  };
}
