"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
    router.replace("/dashboard");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="hs-card hs-card-pad w-full max-w-md border-[var(--border)] shadow-pop"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
        HalloSkills
      </p>
      <h1 className="font-display mt-3 text-[1.75rem] font-normal italic tracking-tight text-[var(--ink)]">
        Taskmanager
      </h1>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--ink-3)]">
        Anmeldung mit E-Mail und Passwort. Zugänge werden zentral vergeben.
      </p>
      <div className="mt-8 flex flex-col gap-4">
        <label className="hs-field">
          <span className="hs-field-label">E-Mail</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="hs-input w-full"
          />
        </label>
        <label className="hs-field">
          <span className="hs-field-label">Passwort</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="hs-input w-full"
          />
        </label>
      </div>
      {error ? (
        <p
          className="mt-4 rounded-hs border px-3 py-2.5 text-sm font-medium"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 45%, transparent)",
            background: "color-mix(in oklab, var(--danger) 12%, var(--card))",
            color: "var(--danger)",
          }}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="hs-btn hs-btn-primary mt-6 w-full justify-center disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Anmelden…" : "Anmelden"}
      </button>
      <p className="mt-6 text-center text-[11.5px] font-medium text-[var(--muted)]">
        Strategische Aufgabenplanung — sicher über HTTPS und Supabase Auth.
      </p>
    </form>
  );
}
