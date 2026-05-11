/** Next.js `searchParams` → URLSearchParams für gemeinsame Filter-Parsing. */
export function recordToURLSearchParams(
  sp: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) u.set(k, v);
    else if (Array.isArray(v) && v[0]) u.set(k, v[0]);
  }
  return u;
}
