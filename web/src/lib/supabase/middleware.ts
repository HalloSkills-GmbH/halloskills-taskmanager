import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return new NextResponse(
      "Konfiguration: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen (.env.local).",
      { status: 503 },
    );
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        try {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
        } catch {
          /* Next 15: Request-Cookies sind nicht immer beschreibbar */
        }
        supabaseResponse = NextResponse.next({
          request,
        });
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options as never);
          });
        } catch (e) {
          console.error("[middleware] Response-Cookie setzen fehlgeschlagen", e);
        }
      },
    },
  });

  let user: { email?: string | null } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) user = data.user;
  } catch (e) {
    console.error("[middleware] auth.getUser", e);
  }

  const path = request.nextUrl.pathname;
  const isAuthPath =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/_next");

  if (!user && !isAuthPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && path === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  if (path === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = user ? "/dashboard" : "/login";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
