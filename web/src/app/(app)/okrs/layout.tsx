import { Suspense } from "react";
import { OkrShell } from "@/components/okr/OkrShell";

export default function OkrsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-slate-500">OKRs werden geladen…</div>}
    >
      <OkrShell>{children}</OkrShell>
    </Suspense>
  );
}
