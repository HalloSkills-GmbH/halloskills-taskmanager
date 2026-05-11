import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Next.js 15: `cookies()` ist asynchron — pro Lese-/Schreibzugriff frisch awaiten,
 * sonst können Auth + RSC mit Internal Server Error abbrechen.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Fehlende Umgebungsvariablen NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local).",
    );
  }

  return createServerClient(url, key, {
    cookies: {
      async getAll() {
        const store = await cookies();
        return store.getAll();
      },
      async setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        const store = await cookies();
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            store.set(name, value, options as never),
          );
        } catch {
          /* In Server Components ist set oft nicht erlaubt — Session-Refresh läuft über Middleware */
        }
      },
    },
  });
}
