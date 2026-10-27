# BACKEND_SETUP.md

How to connect Sift to its backend (Supabase): accounts, sync, shop, friends, groups and war. Until you do, the app is local-only (`backend.provider: none`), or you can try every online feature with the built-in test backend.

> Everything server-side is code in this repo: `server/core` (rules), `server/supabase/migrations` (tables, generated), `server/supabase/functions/api` (the one edge function). The API is described in `docs/reference/API.md`.

## 0. Try it without a server (2 minutes)

1. In `config/app.yaml` set `backend.provider: fake` and turn on the features you want (`friends`, `groups`, …).
2. `npm run dev`, open Settings → Account → Sign in. Any email, code `000000`. Apple/Google sign in at once.
3. The "server" runs inside the browser and keeps its data in `localStorage` (clear site data to reset). In the browser console, `__siftFake.setOnline(false)` simulates a lost connection.

This runs the same server code as production, so what works here works on Supabase.

## 1. What you need

- A Supabase account (free plan is enough to start): https://supabase.com
- The Supabase CLI (`brew install supabase/tap/supabase`, or see https://supabase.com/docs/guides/cli). Check the version (`supabase --version`); this repo was prepared with the CLI's `--workdir` option.
- For a local server: Docker Desktop. For the hosted one: nothing else.
- Node 22+ (as for the app).

All CLI commands below run from the repo root with `--workdir server` (the Supabase folder is `server/supabase`).

## 2. Optional: a local Supabase first

```bash
supabase start --workdir server          # Postgres, Auth, Storage, Functions in Docker
supabase db reset --workdir server       # applies server/supabase/migrations
npm run server:build                     # bundles the server core into functions/api/sift.js
supabase functions serve api --workdir server --no-verify-jwt
```

`supabase start` prints a local URL (`http://127.0.0.1:54321`) and an anon key. Put them in `config/app.yaml` (`provider: supabase`). Sign-in emails land in the local inbox (Inbucket, URL printed by `supabase start`).

## 3. Create the project

1. Supabase dashboard → New project. Region: **EU** (e.g. Frankfurt). Save the database password somewhere safe.
2. Note from Project Settings → API: the **Project URL**, the **anon (publishable) key**, the **service_role (secret) key**. The service key never goes into the app or the repo.
3. Link the repo: `supabase link --workdir server --project-ref <your-project-ref>`.
4. Create the tables: `supabase db push --workdir server`. Row-level security is on with no policies: apps cannot touch tables; only the edge function can.

## 4. Sign-in methods (Authentication → Providers / Templates)

- **Email codes** (required): Email provider on. Templates → "Magic Link": make the body show the code `{{ .Token }}` (copy `server/supabase/templates/code.html`). Auth → Settings: OTP length 6, expiry 900 s.
- **Sign in with Apple** (needed on iOS once Google is offered): Apple Developer → Identifiers: a Services ID (web) and the app's bundle id with "Sign in with Apple"; Keys: a Sign in with Apple key. Supabase → Providers → Apple: enable, enter the Services ID / bundle id as client IDs and the key (team id, key id, .p8). Redirect URL to register at Apple: shown on that Supabase page.
- **Google**: Google Cloud Console → OAuth consent screen + OAuth client IDs (Web; later iOS and Android). Supabase → Providers → Google: enable, enter the web client id and secret, and add the iOS/Android client ids to "Authorized Client IDs" (native sign-in sends ID tokens).
- URL Configuration: Site URL = your web app URL; Redirect URLs: the web app URL(s) and `http://localhost:5173` for development.

## 5. Storage for content packs

Storage → New bucket `content`, **public**. `npm run content:publish` uploads packs here (Step 5.8).

## 6. Deploy the API function

```bash
npm run server:check                                        # builds sift.js and runs it once on an in-process Postgres
supabase secrets set --workdir server SIFT_JOB_SECRET=<long random string>
supabase functions deploy api --workdir server --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` are provided to the function automatically. Only for an old project that signs tokens with the legacy HS256 secret: also `supabase secrets set SIFT_JWT_SECRET=<JWT secret>` (new projects use signing keys, read from the project's JWKS).

Redeploy after every server change: `npm run server:build && supabase functions deploy api --workdir server --no-verify-jwt`.

## 7. Scheduled jobs

Database → Extensions: enable `pg_cron` and `pg_net`. Then in the SQL editor (replace the two placeholders):

```sql
select vault.create_secret('<SIFT_JOB_SECRET>', 'sift_job_secret');

select cron.schedule('sift-hourly', '7 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/api/job/hourly',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-sift-job', (select decrypted_secret from vault.decrypted_secrets where name = 'sift_job_secret')),
    body := '{}'::jsonb);
$$);

-- Groups (Phase 8): weekly settlement and mission rollover, every 15 minutes.
select cron.schedule('sift-weekly', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/api/job/weekly',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-sift-job', (select decrypted_secret from vault.decrypted_secrets where name = 'sift_job_secret')),
    body := '{}'::jsonb);
$$);
```

## 8. Point the app at it

`config/app.yaml`:

```yaml
backend:
  provider: supabase
  supabaseUrl: 'https://<project-ref>.supabase.co'
  supabaseAnonKey: '<anon key>'
```

The anon key is public by design (it only allows calling the function and signing in). Rebuild the app.

## 9. Check it works

1. Settings → Account → Sign in with your email; enter the code.
2. First sign-in uploads this device's island ("Use the data from your account" appears instead if the account already has one).
3. Focus 25 minutes (or set the focus length to 25 and wait): the reward comes from the server. Turn off Wi-Fi before ending: the break says "Revealing when you're back online…" and reveals it when you reconnect.
4. Buy something in the Shop; open the app in a second browser, sign in, choose "Use the data from your account": the same island, gold and item.
5. Dashboard → Table Editor shows rows in `sessions`, `animals`, `ledger`.

## 10. Server settings (`app_config`)

```sql
-- Force old apps to update (they show "Please update Sift"):
update public.app_config set data = jsonb_set(data, '{value,minSupportedApiVersion}', '2') where key = 'client';
-- Rate limits per user per minute (by operation; `default` for the rest):
update public.app_config set data = jsonb_set(data, '{value,rateLimits}', '{"default":120,"purchase":30,"declare_war":6}') where key = 'client';
```

## 11. Publishing content without an app update

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> npm run content:publish
```

Bump `contentVersion` in `content/pack.json` first (see `docs/guides/CONTENT.md` §7). Apps with `features.remoteContent` download it in the background, check its checksum and use it from the next return to Home. `--min-client 0.3.0` hides a pack from older apps; `--dry-run` writes the files to `dist-content/` instead. Rollback: publish the previous content under a higher version.

## 12. Troubleshooting

| Symptom | Check |
|---|---|
| "No connection" on sign in | Project URL and anon key in `config/app.yaml`; the Email provider is on |
| Code email has a link, no code | The Magic Link template must contain `{{ .Token }}` |
| Every call says `unauthorized` | Function deployed with `--no-verify-jwt`; legacy projects need `SIFT_JWT_SECRET` |
| `server_error` | Dashboard → Edge Functions → api → Logs |
| Tables missing | `supabase db push --workdir server` |
| Departures never come | The hourly job (§7) and `SIFT_JOB_SECRET`; they also settle whenever the user opens the app |
