"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function QuarterTabs({ activeQ, year }: { activeQ: number; year: number }) {
  const router = useRouter();
  const params = useSearchParams();

  const select = (q: number) => {
    const p = new URLSearchParams(params.toString());
    p.set("q", String(q));
    router.push(`?${p.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 rounded-xl border border-app-border bg-[var(--surface-2,#f1f5f9)] p-1">
      {[1, 2, 3, 4].map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => select(q)}
          className={[
            "rounded-lg px-3 py-1 text-[12px] font-bold transition-colors",
            activeQ === q
              ? "bg-app-card text-app-ink shadow-sm"
              : "text-app-muted hover:text-app-ink",
          ].join(" ")}
        >
          Q{q} {year}
        </button>
      ))}
    </div>
  );
}
