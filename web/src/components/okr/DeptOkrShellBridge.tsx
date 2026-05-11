"use client";

import { useParams } from "next/navigation";
import { OkrShell } from "@/components/okr/OkrShell";

/** Liest `deptSlug` aus der Route und setzt OKR-Tabs auf `/d/:slug/okrs/...`. */
export function DeptOkrShellBridge({
  children,
  deptName,
}: {
  children: React.ReactNode;
  deptName: string;
}) {
  const params = useParams();
  const slug = typeof params?.deptSlug === "string" ? params.deptSlug : "";
  const basePath = slug ? `/d/${slug}/okrs` : "/okrs";
  return (
    <OkrShell basePath={basePath} contextLabel={deptName}>
      {children}
    </OkrShell>
  );
}
