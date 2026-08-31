"use client";

/** Hosts a type detail on its own route while reusing the established editor. */
import { useRouter } from "next/navigation";
import type { TypeKind } from "@dashboard/core";
import { TypeDetailDrawer } from "./TypeDetailDrawer";

export function TypeDetailPage({ kind, typeKey }: { kind: TypeKind; typeKey: string }) {
  const router = useRouter();
  return (
    <TypeDetailDrawer
      kind={kind}
      typeKey={typeKey}
      presentation="inline"
      onClose={() => router.push("/admin/model/types")}
    />
  );
}
