# Deploying to Production (Supabase Cloud + Vercel)

The app is a Vite SPA whose only backend is Supabase. Going live = **(A)** stand up a
hosted Supabase project, then **(B)** deploy the frontend to Vercel pointing at it.
The frontend uses the **anon key only**; the service_role key / DB password never reach it.

---

## A. Hosted Supabase (the backend)

1. **Create a project** at https://supabase.com → New project. Pick a strong DB password
   (this is a fresh project, unrelated to the local one). Note the **Project ref**,
   **Project URL** (`https://<ref>.supabase.co`) and the **anon public** key
   (Settings → API).

2. **Link the CLI and push the schema** (run from the repo root):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # applies all 12 migrations to the cloud DB
   ```

3. **Enable the access-token hook** (REQUIRED — without it the JWT carries no
   `tenant_id` / `app_role` / `is_platform_admin`, so the app can't authorize anything):
   - Dashboard → **Authentication → Hooks** → *Customize Access Token (JWT) Claims*.
   - Select the Postgres function **`public.custom_access_token_hook`** and enable it.
   - (This is what `[auth.hook.custom_access_token]` does locally in `supabase/config.toml`.)

4. **Deploy the Edge Function** (admin "create business"):
   ```bash
   npx supabase functions deploy create-business
   ```
   It uses the auto-injected service_role; no extra secrets needed.

5. **Auth settings** → set **Site URL** to your Vercel URL (e.g. `https://<app>.vercel.app`)
   and add it to **Redirect URLs**. Login is email+password, so no email provider is required
   to sign in (leave "Confirm email" off, or confirm users manually, since there's no public
   sign-up flow for owners — they're created by the admin console).

6. **Bootstrap the first platform admin** (no self-serve admin sign-up — see CLAUDE.md):
   - Create your account (Dashboard → Authentication → Users → Add user, with a password),
     or via the app login once an owner exists.
   - Find your user id, then in the **SQL Editor** run:
     ```sql
     insert into public.platform_admins (user_id) values ('<your-auth-user-id>');
     ```
   - Your next login JWT carries `is_platform_admin: true` → `/admin` unlocks. From there,
     create the first business (owner gets a one-time temp password).

> Production data is NOT seeded (`supabase/seed.sql` is local-only). You create real
> tenants through the admin console after the admin bootstrap above.

---

## B. Vercel (the frontend)

1. **Import the repo** at https://vercel.com → Add New → Project → import
   `abdallah-hatem/car_wash_system`. Framework auto-detects as **Vite** (build `npm run build`,
   output `dist`; `vercel.json` pins these + the SPA fallback rewrite).

2. **Set the Production branch** (Project → Settings → Git). Per our workflow that should be
   `production`; until we promote, you can point it at `dev` for a first live environment.

3. **Environment variables** (Project → Settings → Environment Variables), for Production
   (and Preview if you want PR previews):
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |

   These are read at **build time** (Vite inlines them), so after changing them you must
   **redeploy**.

4. **Deploy.** Vercel runs `npm ci` (tolerated peer deps via `.npmrc`) then `npm run build`.
   Every push to the production branch redeploys; other branches get preview URLs.

5. After the first deploy, copy the real Vercel URL back into Supabase **Site URL / Redirect
   URLs** (step A5) and redeploy if you changed env vars.

---

## Pre-production checklist
- [ ] Hosted Supabase project created; migrations pushed; access-token hook **enabled**.
- [ ] `create-business` function deployed.
- [ ] Platform admin row inserted; `/admin` reachable.
- [ ] Vercel env vars set (anon key only) and a successful production build.
- [ ] Site URL / Redirect URLs point at the Vercel domain.
- [ ] **Rotate the DB password** if you ever reused the one shared during development.
- [ ] (Optional) custom domain in Vercel → update Supabase Site URL accordingly.
