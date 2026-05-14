import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      "Supabase-Konfiguration fehlt: NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY sind leer. " +
        "Lokal: .env.local setzen. Produktion (Azure/GitHub Actions): Repository-Secrets anlegen und vor dem Build einbinden " +
        "(siehe Workflow-Schritt „Supabase-Umgebung für Next-Build“).",
    );
  }
  return createBrowserClient(url, key);
}
