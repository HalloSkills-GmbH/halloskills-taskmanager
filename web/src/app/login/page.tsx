import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[var(--bg)] via-[var(--bg-2)] to-[var(--surface-2)] px-4 py-12">
      {sp.error === "auth" ? (
        <p className="mb-5 max-w-md rounded-2xl border border-[#EC8580]/60 bg-[#FBC4C0]/35 px-4 py-3 text-center text-sm font-medium text-[#8E2B27] shadow-card">
          Der Anmelde-Link war ungültig oder abgelaufen. Bitte erneut einloggen.
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
