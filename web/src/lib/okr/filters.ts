import { z } from "zod";

export const okrFilterSchema = z.object({
  q: z.string().default(""),
  type: z.enum(["all", "objective", "key_result", "task"]).default("all"),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

export type OkrFilters = z.infer<typeof okrFilterSchema>;

/** Aus Next.js `searchParams` (Record oder URLSearchParams). */
export function parseOkrFilters(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
): OkrFilters {
  const get = (key: string): string | undefined => {
    if (sp instanceof URLSearchParams) {
      const v = sp.get(key);
      return v ?? undefined;
    }
    const raw = sp[key];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };
  const typeRaw = get("type");
  const type =
    typeRaw === "objective" || typeRaw === "key_result" || typeRaw === "task"
      ? typeRaw
      : "all";
  return okrFilterSchema.parse({
    q: get("q") ?? "",
    type,
    from: get("from") ?? null,
    to: get("to") ?? null,
    team: get("team") ?? null,
    status: get("status") ?? null,
  });
}

export function serializeOkrFilters(f: OkrFilters): string {
  const u = new URLSearchParams();
  if (f.q) u.set("q", f.q);
  if (f.type && f.type !== "all") u.set("type", f.type);
  if (f.from) u.set("from", f.from);
  if (f.to) u.set("to", f.to);
  if (f.team) u.set("team", f.team);
  if (f.status) u.set("status", f.status);
  return u.toString();
}
