import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (e) {
    console.error("[middleware]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(
      process.env.NODE_ENV === "development"
        ? `Middleware-Fehler: ${msg}`
        : "Internal Server Error",
      { status: 500 },
    );
  }
}

export const config = {
  matcher: [
    /*
     * `.swa/*` auslassen: Azure Static Web Apps Hybrid prüft u. a. `/.swa/health.html`;
     * Middleware darf diese Requests nicht blockieren.
     */
    "/((?!\\.swa|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
