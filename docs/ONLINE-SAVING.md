# Private online saving with Supabase

The website remains on GitHub Pages. Supabase provides account sign-in and a private database. Only a project URL and **publishable key** are included in the website; database policies enforce access. Never put a `service_role`, `sb_secret_`, database password, or Supabase management token in the repository or GitHub Pages build.

## One-time database setup

1. Create a project in your own Supabase account using the **Free** plan and an appropriate region. Enable the Data API, disable automatic exposure of new tables, and enable automatic RLS. The migration explicitly grants only the required table privileges.
2. Under **Authentication → Users → Add user → Create new user**, create the intended app user's email/password account. Choose a strong, private password and mark the email confirmed through this administrator flow. This does not require an invitation email. This login is separate from the project owner's Supabase dashboard account.
3. Under **Authentication → Sign In / Providers**, disable public user sign-ups and anonymous sign-ins. Keep email/password sign-in enabled. The server allow-list below is a second layer: even an authenticated account not on it cannot create a dispensing document.
4. Run [`supabase/migrations/202610050001_private_records.sql`](../supabase/migrations/202610050001_private_records.sql) in the project's SQL editor. It is a single transaction. Run it once on the new project; do not rerun it to reset an existing database.
5. Add the intended user to the allow-list from the SQL editor, replacing the example address. The email is deliberately absent from the public repository:

   ```sql
   insert into public.dispensing_members (user_id)
   select id from auth.users where lower(email) = lower('APP_USER_EMAIL')
   on conflict (user_id) do nothing;
   ```

   Verify **one** row was inserted (or already exists). The user must exist in Authentication first. Never grant the website permission to edit this allow-list.
6. Set the Auth **Site URL** to the deployed website, including its repository path, for example `https://malikazaz.github.io/Dispensing-Record/`. If password-recovery email is enabled later, add this exact URL to allowed redirect URLs too.

The migration creates two tables: `dispensing_members` (access list) and `dispensing_documents` (one records-and-key document per user). Row Level Security restricts both tables to `auth.uid()`. Anonymous users have no table privileges. Members can insert/read/update their own document; they cannot delete documents or grant access to another user. Record removals happen within the versioned document. Foreign keys connect data to membership and the Auth user: deleting either administrative entry also deletes that user's document, so don't delete users/members as a way to reset a password.

## Connect GitHub Pages

In **GitHub repository → Settings → Secrets and variables → Actions → Variables**, add:

| Repository variable | Value |
| --- | --- |
| `SUPABASE_URL` | The project's HTTPS URL, such as `https://PROJECT_REF.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_…` key from Supabase Settings → API Keys; a legacy `anon` key also works |
| `SUPABASE_PASSWORD_RESET_ENABLED` | Leave unset/false unless recovery email delivery is configured and tested |

Run the existing **Test and deploy to GitHub Pages** workflow. It tests against mock accounts and only then writes the public connection settings into the deployment artifact. It never contacts the production database during tests. With both URL/key unset, the app remains in local mode. Partially specified settings or privileged keys fail configuration rather than silently deploy a broken connection.

For local development, set the same environment variables and run `node scripts/configure-cloud.mjs public` before `npm run dev`. Do not commit the resulting project settings over the checked-in empty example. Reset `public/cloud-config.json` to `{"url":"","publishableKey":""}` before running browser tests. The production workflow configures `dist` after tests instead.

## First sign-in and existing records

On her original phone/browser, open **Account** in the header and download a JSON backup first. Sign in from that menu with her **app** email/password. If this browser has existing records or a customised key, select **Connect and upload** to combine them with the online copy. A blank browser automatically downloads its account's online records. Wait for **Saved online and on this device** in the Account menu before relying on recovery from another device. **Sync now**, sign-out, bonus-key settings and backups are also in this menu; the header's small status indicator stays visible when the menu is closed.

Records, edits, removals and the bonus key all sync. Changing the key continues to recalculate all records. Backups contain only records and the key, without login tokens or sync bookkeeping. Restoring a backup while connected intentionally replaces the device records and syncs that change online after confirmation. Exported Excel/PDF files continue to be generated on the device.

Sign-out hides cached records in the interface, but keeps them in browser storage so pending changes are not lost. Sign in to the same account to access them again. A different account cannot inherit or upload the cached records. This is intended for a personal phone; the cache is not encrypted and signing out is not a secure erase of that phone's data. Do not share a browser profile for customer data.

## Connection interruptions and conflicts

Every edit is committed to localStorage first. **Waiting to sync** means those changes have not yet been confirmed online. The app retries on another edit, returning to the page, reconnecting, or pressing **Sync now**. The app must already be loaded to keep working during an outage: there is no service worker guaranteeing an offline page reload.

Sync compares both copies against their last shared copy. Separate record edits combine; deletions remain deletions. If both copies change the same record or the key differently, **Review changes** shows both versions. Choose the device or online versions for those conflicts; non-conflicting changes remain combined. Download a backup from this review before choosing if needed. An uncertain upload followed by further server changes also triggers review instead of guessing.

The database uses an increasing revision and conditional writes to prevent stale-device overwrites. Pending upload intent is saved atomically with local records, allowing recovery after a response is lost. Local tabs use a browser lock where supported plus localStorage revision checking; a stale tab asks for reload instead of overwriting newer data. A record or key that changes online during an open edit must be reopened before saving.

Only records confirmed online are recoverable if browser data is cleared. Unsynced records still depend on that device or a downloaded backup. Keep periodic JSON backups even with online saving.

## Account recovery and paused projects

Email/password sign-in does not require a custom email service for an administrator-created, confirmed user. Supabase's default email service restricts recipients and is unsuitable for general recovery-email delivery. **Forgot password?** therefore directs the user to the app's owner by default. Reset the **existing user's password** using Supabase's supported admin controls/API; do not delete/recreate the account, which would change its identity and can delete its records.

If a custom SMTP service is later configured and tested, set `SUPABASE_PASSWORD_RESET_ENABLED=true` and redeploy. The app supports requesting reset emails and setting a new password after following a recovery link.

A free project can pause after low activity. Resume it from the Supabase dashboard, then press **Sync now** in the app. Do not assume cloud data is retained indefinitely while paused; consult the current [pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing). The current policy permits dashboard restoration for one year after pausing. No artificial keep-alive traffic is generated.

## Verification

`npm test` includes three-way merge, offline/lost-response recovery, in-flight edits, conflicts, stale writes, account binding, public config validation and real Postgres RLS tests using PGlite. `npm run test:e2e` checks mock Supabase authentication/sync in Chromium and WebKit, including a fresh browser recovery and small phone layouts. Mock/local checks are not a substitute for a one-time live sign-in and upload/download check after project setup.

## Claim history and sync

The claim ledger is an optional `key.claims` field in the existing private document. It contains immutable record snapshots and integer-cent amounts, plus draft/submission/correction history. Keeping it in the key preserves it through the existing backup and sync document envelope; no database migration is needed. The 10 MB document limit still applies.

With a claim ledger present, records and claim reservations merge as one unit. Concurrent changes to that unit require an explicit device/online choice; independent rate changes still merge separately. This intentionally avoids combining overlapping claims or an edit/deletion with a claim that locks the same record. The review identifies both histories; download a backup before choosing because unrelated changes in that record/history unit follow the selected copy. Lost-response recovery uses the same rule.

Claims are application-level tracking for one user, not a server-enforced accounting ledger. Only synced changes are recoverable on another device. Do not create/submit claims independently on multiple offline devices; sync first and resolve conflicts before sending a report. Reload old app tabs: older builds do not understand record locks, although they preserve the ledger inside the key; the new validator rejects claimed records changed by an older client instead of silently changing the saved claim.
