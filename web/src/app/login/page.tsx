import { LoginForm } from "@/components/auth/LoginForm";

function hasSupabasePublicEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const supabaseOk = hasSupabasePublicEnv();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[var(--bg)] via-[var(--bg-2)] to-[var(--surface-2)] px-4 py-12">
      {sp.error === "auth" ? (
        <p className="mb-5 max-w-md rounded-2xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-center text-sm font-medium text-[#8E2B27] shadow-card">
          Der Anmelde-Link war ungültig oder abgelaufen. Bitte erneut einloggen.
        </p>
      ) : null}
      {!supabaseOk ? (
        <div
          className="mb-6 max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 text-[13px] leading-relaxed text-[var(--ink)] shadow-card"
          role="alert"
        >
          <p className="font-semibold text-[var(--ink)]">Supabase-Umgebungsvariablen fehlen</p>
          <p className="mt-2 text-[var(--ink-3)]">
            Ohne <span className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</span> und{" "}
            <span className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> kann sich niemand anmelden.
            Lege im GitHub-Repo unter <strong>Settings → Secrets and variables → Actions</strong> zwei Secrets mit
            genau diesen Namen an (Werte wie in <span className="font-mono text-[12px]">.env.local</span>), pushe auf{" "}
            <span className="font-mono text-[12px]">main</span> und warte auf einen grünen Deploy-Lauf. Zusätzlich die
            gleichen Variablen in der Azure Static Web App unter Umgebungsvariablen setzen.
          </p>
        </div>
      ) : null}
      {supabaseOk ? <LoginForm /> : null}
    </div>
  );
}
