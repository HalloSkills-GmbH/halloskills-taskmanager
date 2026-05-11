"use client";

import { useEffect } from "react";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-[var(--bg)] px-6 py-16">
      <h1 className="text-lg font-bold text-[var(--ink)]">Anwendungsfehler</h1>
      <p className="max-w-md text-center text-sm text-[var(--muted)]">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "Bitte Seite neu laden oder es später erneut versuchen."}
      </p>
      {error.digest ? (
        <p className="font-mono text-[11px] text-[var(--muted)]">Digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        className="hs-btn hs-btn-primary"
        onClick={() => reset()}
      >
        Erneut versuchen
      </button>
    </div>
  );
}
