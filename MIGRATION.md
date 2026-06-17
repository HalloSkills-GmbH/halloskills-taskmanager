# Supabase → Azure Migration

## Ziel

Supabase vollständig ersetzen durch Azure-Dienste, sodass Datenbank und Auth komplett innerhalb der bestehenden Azure-Infrastruktur liegen. Der Taskmanager wird damit direkt an den HalloSkills Datalake angebunden.

## Was wird ersetzt

| Aktuell (Supabase) | Neu (Azure) |
|---|---|
| Supabase PostgreSQL Datenbank | Azure Database for PostgreSQL Flexible Server |
| Supabase Auth (Login, Sessions) | Azure Entra External ID |
| Supabase Row Level Security | Serverside Auth-Prüfung im Next.js API-Layer |
| Supabase Realtime (live Updates) | Entfällt vorerst — wird durch Router-Refresh ersetzt |

GitHub bleibt als Code-Repository. Azure Static Web Apps bleibt als Hosting.

---

## Phase 1 — Azure-Dienste einrichten (du, ~60 Min)

### 1.1 Azure Database for PostgreSQL

1. Azure Portal öffnen → **Ressource erstellen** → "Azure Database for PostgreSQL Flexible Server"
2. Einstellungen:
   - **Ressourcengruppe:** bestehende Gruppe des Taskmanagers wählen
   - **Servername:** z.B. `hs-taskmanager-db`
   - **Region:** West Europe (gleiche Region wie Static Web App)
   - **PostgreSQL-Version:** 16
   - **Workload-Typ:** Development (günstigste Option, ~€15/Monat)
   - **Admin-Benutzername:** merken (z.B. `hsadmin`)
   - **Passwort:** sicheres Passwort merken
3. Unter **Netzwerk:** "Allow public access" aktivieren, eigene IP-Adresse hinzufügen
4. Erstellen → warten bis Ressource bereit ist (~5 Min)
5. Connection String notieren: `postgresql://hsadmin:<passwort>@hs-taskmanager-db.postgres.database.azure.com:5432/taskmanager`

### 1.2 Datenbank und Tabellen anlegen

Nach Schritt 1.1 führe ich das komplette SQL-Schema aus (alle 11 Tabellen aus Supabase werden 1:1 übernommen).

### 1.3 Azure Entra External ID

1. Azure Portal → **Microsoft Entra External ID** (oder "Azure AD B2C" suchen)
2. Neuen Tenant anlegen:
   - **Tenant-Name:** z.B. `HalloSkillsTaskmanager`
   - **Domain:** z.B. `halloskillstaskmanager.onmicrosoft.com`
3. Unter **App-Registrierungen** → Neue Registrierung:
   - **Name:** Taskmanager
   - **Redirect URI:** `https://ambitious-field-0d4176010.7.azurestaticapps.net/auth/callback` (und `http://localhost:3000/auth/callback` für lokal)
4. Nach Registrierung notieren:
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. Unter **Zertifikate & Geheimnisse** → Neues Client Secret erstellen → Wert notieren

---

## Phase 2 — Code-Umbau (Claude Code, ~2-4 Std)

Claude Code übernimmt alle Code-Änderungen. Du musst nichts manuell ändern.

### 2.1 Neue Abhängigkeiten

```
@azure/msal-node          # Entra Auth für Server
@azure/msal-browser       # Entra Auth für Client  
pg                        # PostgreSQL-Treiber (direkt, ohne Supabase)
```

Entfernt werden:
```
@supabase/ssr
@supabase/supabase-js
```

### 2.2 Dateien die umgeschrieben werden

**Auth-Layer (6 Dateien):**
- `src/middleware.ts` — prüft Session via Entra statt Supabase
- `src/lib/supabase/server.ts` → `src/lib/db/client.ts` — direkter PostgreSQL-Client
- `src/lib/supabase/middleware.ts` → `src/lib/auth/middleware.ts`
- `src/app/auth/callback/route.ts` — Entra OAuth Callback
- `src/app/login/page.tsx` + `src/components/auth/LoginForm.tsx` — Entra Login

**Datenbankabfragen (41 Dateien):**
- Alle `supabase.from("tabelle").select(...)` werden durch direkte SQL-Queries mit `pg` ersetzt
- Die Abfrage-Logik bleibt gleich, nur die Syntax ändert sich

**Realtime entfernen (2 Dateien):**
- `src/components/tasks/TaskTableRealtime.tsx`
- `src/hooks/useTasksRealtime.ts` + `src/hooks/useMainTableSync.ts`

### 2.3 Neue Umgebungsvariablen (.env.local)

```env
# Datenbank
DATABASE_URL=postgresql://hsadmin:<passwort>@hs-taskmanager-db.postgres.database.azure.com:5432/taskmanager

# Entra Auth
AZURE_AD_CLIENT_ID=<Application Client ID>
AZURE_AD_CLIENT_SECRET=<Client Secret>
AZURE_AD_TENANT_ID=<Directory Tenant ID>
NEXTAUTH_SECRET=<zufälliger langer String>
NEXTAUTH_URL=https://ambitious-field-0d4176010.7.azurestaticapps.net
```

---

## Phase 3 — Daten migrieren (optional, ~30 Min)

Da die Datenbank aktuell nur Testdaten enthält, kann sie neu aufgesetzt werden. Falls echter Inhalt übernommen werden soll:

1. Supabase Dashboard → SQL Editor → Daten als CSV exportieren
2. In neue Azure PostgreSQL Datenbank importieren

---

## Phase 4 — Testen & Live schalten (~30 Min)

1. Lokal testen: `npm run dev` mit neuen Umgebungsvariablen
2. Login über Entra testen
3. Aufgaben erstellen, bearbeiten, löschen testen
4. GitHub Secrets aktualisieren (alte Supabase-Secrets entfernen, neue hinzufügen)
5. Push auf `main` → automatischer Deploy auf Azure
6. Live-URL testen

---

## Reihenfolge

```
Phase 1 (du)  →  Phase 2 (Claude Code)  →  Phase 3 (optional)  →  Phase 4 (zusammen)
~60 Min           ~2-4 Std                  ~30 Min                 ~30 Min
```

**Gesamtaufwand: ca. 1 Arbeitstag**

---

## Vorteile nach der Migration

- Taskmanager-Daten liegen direkt in Azure → Datalake kann ohne Umwege darauf zugreifen
- Einheitliche Nutzerverwaltung über Entra für Taskmanager, LMS und weitere Apps
- Keine externe Abhängigkeit von Supabase mehr
- Alle Ressourcen unter einer Azure-Subscription verwaltbar
