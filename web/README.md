# HalloSkills Taskmanager (Web)

Moderner Stack: **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase** (Postgres + Auth + Realtime).

## Entwicklung

```bash
cp .env.example .env.local
# .env.local mit NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY füllen

npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000) — Weiterleitung zu `/login` oder `/dashboard`.

## Sicherheit (realistisch)

- **100 % „unknackbar“** gibt es nicht — Ziel ist **Defense in Depth**: weniger Angriffsfläche, schnelle Updates, Monitoring.
- **Service Role** niemals im Browser oder in `NEXT_PUBLIC_*` — nur serverseitig in geschützten Umgebungen (z. B. Edge Functions mit Secret).
- **Row Level Security (RLS)** für `public.tasks`: Migration [`../supabase/migrations/002_tasks_rls_authenticated.sql`](../supabase/migrations/002_tasks_rls_authenticated.sql) im SQL-Editor ausführen. **Phase 1:** alle eingeloggten Nutzer (`authenticated`) dürfen `tasks` lesen/schreiben; **ohne** gültige Session liefert PostgREST keine Zeilen mehr (Anon-Key allein reicht nicht). Später Policies auf `owner_id` / Organisation verschärfen, wenn euer Rechte-Tool live ist.
- **Anon-Key im Browser** ist unkritisch, **solange RLS** auf allen Tabellen sitzt, die der Client erreicht.
- **Auth**: Session über Cookies, Refresh in `middleware.ts` (Supabase SSR).
- **HTTP-Header** in `next.config.ts` (Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- **CSP** (Content-Security-Policy) kann verschärft werden, sobald keine inline Scripts mehr nötig sind (z. B. Nonce über Next).
- **OKR-Mutationen:** `zod`-Schemas in `src/lib/validators/task-update.ts` und Server Actions in `src/app/(app)/okrs/actions.ts` (`updateTaskFields`, `insertTaskRow`, `deleteTaskRow`) — zentrale Validierung vor Supabase-Updates.
- **HTTPS** in Produktion (Vercel/Reverse-Proxy), Rate-Limits und Bot-Schutz am Ingress (Cloudflare, WAF).

## Migration vom Monolithen

Die frühere Datei liegt unter `../legacy/Gantt-Interaktiv.html`. Funktionen (Gantt, Board, Kalender, OKR) können schrittweise als React-Routen und Komponenten portiert werden.
