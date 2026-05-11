# halloskills-taskmanager

Taskmanagement für HalloSkills.

## Struktur

| Pfad | Inhalt |
|------|--------|
| `web/` | **Neue Haupt-Anwendung**: Next.js + TypeScript + Supabase (siehe `web/README.md`) |
| `legacy/Gantt-Interaktiv.html` | Früherer Monolith (Referenz / Fallback) |
| `supabase/migrations/` | SQL-Migrationen für Postgres |

## Schnellstart (moderne App)

```bash
cd web
cp .env.example .env.local
# Supabase-URL und Anon-Key eintragen

npm install
npm run dev
```

## Sicherheit

Siehe `web/README.md` — kurz: RLS in Supabase, kein Service-Role-Key im Client, HTTPS in Produktion, regelmäßige Updates.
