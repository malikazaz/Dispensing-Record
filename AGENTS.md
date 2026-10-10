# Working on Dispensing Record

This is a mobile-first dispensing-record and bonus-claim app for one primary user. Keep the interface simple and quick on an iPhone, including when launched from its home screen.

## Project and setup

- Repository: https://github.com/malikazaz/Dispensing-Record
- Live app: https://malikazaz.github.io/Dispensing-Record/
- Plain JavaScript, Vite, ExcelJS, pdfmake and optional Supabase authentication/sync. GitHub Pages hosts the static app; exports are generated on the device.
- Read `README.md`, `docs/CLAIMS.md` and `docs/ONLINE-SAVING.md` before changing the relevant workflow. Verify the implementation; documentation can lag behind a change.
- Use Node.js 22.13 or later. Run `npm ci`, then `npm run dev`. On PowerShell, use `npm.cmd` if execution policy prevents the npm wrapper from running.
- Do not commit `node_modules`, build/test output, customer data, exports, backups or screenshots containing real records. Use synthetic customers for checks.

## Where things live

| Files | Responsibility |
| --- | --- |
| `src/model.js` | Default rates, record validation and ordinary bonus calculations in integer cents |
| `src/claims.js`, `src/claims-schema.js` | Claim transitions, snapshots, reservation checks and validation |
| `src/claims-ui.js` | Bulk receipt selection, claim review and submission/correction actions |
| `src/main.js`, `src/style.css` | Entry form, records, account integration and responsive layout |
| `src/storage.js` | Browser persistence and stale-write detection |
| `src/cloud-model.js` | Three-way merge, conflict resolution and interrupted-upload recovery |
| `src/cloud-client.js`, `src/cloud-ui.js` | Supabase connection, authentication and sync controls |
| `src/export-selection.js`, `src/export-table.js` | Export scope, claim selection, paper headings and descriptions |
| `src/workbook.js`, `src/pdf.js`, `src/export-loader.js` | Excel/PDF generation and recovery from failed export-module loading |
| `supabase/migrations/` | Private database tables, policies and revision enforcement |
| `.github/workflows/deploy.yml` | Automated checks and GitHub Pages deployment |

## Preserve records and claims

- Browser data uses `dispensing-record:v1`, schema version 1. Keep old single-set records and backups readable; new records support both lens sets and a separate third pair.
- Never clear browser storage, reset the database or rewrite real customer records as a routine fix. Failed reads, writes, downloads and syncs must preserve the existing data.
- The optional `key.claims` ledger stays inside the existing backup/private-document envelope. Do not drop it when editing rates, merging documents or restoring backups.
- New and existing records without a claim are unclaimed. Downloads alone never mark a claim submitted, and the app does not send a claim or verify payment.
- Saving a draft freezes record details, add-on descriptions, currency and integer-cent amounts. Later key or calculation changes must not recalculate draft/submitted snapshots.
- A record can belong to only one active draft/submitted claim. Its underlying record is locked against editing/deletion until released.
- Allowed transitions: `draft → submitted → void` or `draft → cancelled`. The UI calls `void` **Submission undone**. Keep the old snapshot and append correction history; do not overwrite, delete or reopen the old claim.
- Claims can combine receipts from different dispense months. Keep original receipt dates. Bulk selection must skip pending bonuses; confirmed zero-value records remain selectable. Selections persist across filters, and totals include hidden selected records.
- Duplicate-receipt warnings compare customer number and dispense date. They warn and allow a confirmed separate receipt; they do not prove two receipts are identical.
- Sync treats records and claim reservations together once claim history exists. Concurrent changes must not silently produce overlapping claims, release submitted records or resurrect deleted records. Keep stale-tab, compare-and-swap and uncertain-upload safeguards.
- Routine changes to sync metadata must not invalidate an otherwise unchanged claim selection. Compare document content when deciding whether records changed.
- Backup restore is an explicit replacement, including claim history. Keep its warning that an older backup can remove submission history.

## Bonus rules to preserve

The current implementation and documented user clarifications are the reference; ask about genuinely ambiguous new rules before changing payouts.

- Use integer cents, never floating-point accumulation. Missing/unconfirmed rules are **Pending**, not a confirmed zero.
- First/second-set add-ons are independent selections on one customer record. UCSC is €1.50/€2.00; 1.6 is €3.00/€3.50. See the README for the complete key.
- Under 241, tick both frame prices but credit only the highest-priced selected frame. Shared frame bonuses are counted once. Ordinary frame rates: 160 → €1.50; 190 and 240 → €3.00.
- Under 241, second-set Elite, Tailormade and Supereader designs are free. Free Supereader includes one UCSC bonus, or only the selected second-set 1.6/1.67/1.74 rate. Do not add UCSC on top of an index upgrade.
- The explicit second-pair SV offer pays €3 without paid add-ons or one flat €5 with eligible add-ons. It requires second-set single vision, not varifocals. On paired records, first-set and shared frame amounts remain separate. Preserve legacy single-set calculation behavior.
- Golden Ticket and third pair half price are one offer: €2 immediately, plus €1 per separately selected eligible third-pair add-on. Never copy first/second-set choices into the third pair.
- Super Boost earns €0 in ordinary sets and €1 on the third pair. Miyosmart earns €0 on every pair and does not trigger the second-pair flat offer.
- Source-code default-rate changes must not silently replace an existing customised key. Key edits recalculate unclaimed records only; claims retain their snapshots.

## Phone UI and exports

- Keep Account controls in the header menu. Retain the date after saving/clearing the form; provide previous/next-day arrows and return to the entry area after a save.
- Keep customer numbers as text with a numeric keyboard hint, preserving leading zeros. Request word capitalisation for names; numeric characters in names show an advisory red warning.
- Summary cards are **Unclaimed bonus** (including draft claims), **Claimed bonus** (submitted claims only), and **All-time total** (their sum across currently saved records). Use frozen active-claim amounts, exclude pending/other-currency amounts with a note, and never add cancelled/undone history twice. The record count is on the Records tab.
- The Account summary visibility preference is local to the browser, separate from saved records and sync. Apply it before showing the cards and preserve it through auth/sync updates; it must never override the signed-out lock. It hides the top three cards only.
- Check narrow portrait layouts and native iOS date controls; fields must not overlap or cause horizontal overflow. Keep touch targets practical.
- Preserve the 17 paper-table headings. PDF and Excel exports contain records and totals, with no bonus-key appendix or worksheet.
- Ordinary Export includes only unclaimed records. Saved claim downloads use the exact snapshot and stable claim reference, without recalculating from the current key.
- Keep export-module retry/version checks. A refresh must not discard unfinished entry data or interrupt active sync. Do not advise clearing website data to fix downloads.

## Validation and documentation

Run checks appropriate to the change; documentation-only edits need link/content checks, not new behavioral tests. For calculation, claims, persistence, sync or export changes:

```sh
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

- Add meaningful regression coverage for changed money rules, reservation/snapshot invariants and recovery paths. Avoid tests that merely duplicate implementation.
- Browser tests use desktop/mobile Chromium and iPhone-style WebKit. Include relevant new phone workflows in the WebKit project list in `playwright.config.js`.
- Cloud tests use mocked APIs and local PGlite policies; do not use the real customer's account or live records for tests.
- Update README/user guidance when behavior changes. Keep first-use, bulk selection, fixed claim amounts and correction instructions consistent with the UI.

## Publishing and credentials

- Inspect the working tree and preserve unrelated changes. Use a fast-forward pull for an existing checkout; do not force-push or reset user changes to update it.
- Follow the user's authorization for committing, pushing and deploying. Authorization already given in the conversation remains valid; do not add redundant confirmation gates.
- Pushing to `main` triggers tests and Pages deployment. Check the corresponding run before saying an app change is live. Verify important phone/export behavior against the deployed release with synthetic data when appropriate.
- Public Supabase URL/publishable-key settings are supplied by the deployment workflow. Never commit secret/service-role keys, management tokens, database passwords or app passwords.
- Do not change account membership, disable access policies, create paid infrastructure or run destructive migrations as an incidental part of a frontend change.
