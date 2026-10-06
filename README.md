# Dispensing Record

A mobile-friendly dispensing log with local saving, optional private Supabase sign-in and online saving, and formatted Excel/PDF exports. Plain JavaScript + Vite, with ExcelJS and pdfmake generating reports entirely on the device. GitHub Pages remains the free static host. See [online-saving setup](docs/ONLINE-SAVING.md) to connect your own Supabase project.

## Run locally

Install Node.js 22.13+ (Node 24 recommended). In this folder:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. For the production version:

```sh
npm run build
npm run preview
```

Use an HTTP server, not a double-clicked `index.html`. The `dist/` folder is the deployable website. The Excel or PDF library loads only when that format is requested; both libraries and the PDF fonts are bundled with the site.

## Use the app

1. Enter date, customer number and customer name. Customer numbers remain text, preserving leading zeros. Customer names show a red warning if a number is typed or pasted; removing the number clears it. This is an advisory warning and does not change entered text. Use the arrows beside the date to move one day backward/forward, or tap the date to use the calendar.
2. Tick the relevant paper columns and both frame prices for the customer. Select **1st set of lenses** and choose its add-ons/offers, then **2nd set of lenses** for its own choices. Each set remembers its selections when switching; the customer, date and frame selections are shared. Both sets save as one record.
3. Open **Special offers** when relevant. The bonus and its breakdown update immediately.
4. Save the dispense. The form clears customer/dispense choices, keeps the selected date and scrolls back to the top of the form for the next customer. The date also survives a page refresh in the same tab. Editing an older record does not change your new-entry date. **Clear form** clears the current customer, both sets of add-ons/offers and dispense selections, retains the displayed date, and returns to the top. During editing it discards unsaved changes without altering the saved record. Open **Records** to search, edit or remove saved entries; removing asks for confirmation.
5. **Export** opens the bonus-report dialog. Choose **Excel (.xlsx)** or **PDF (.pdf)**, then **This month**, **Last month**, **Custom dates** or **All records**. Optionally name the section, review its record count and bonus total, and select **Download Excel** or **Download PDF**.
6. Tap **Account** in the header for sign-in, sync status, **Sync now**, **Bonus key**, and backup/restore controls. **Download backup** saves all records and the bonus key in a restorable JSON file. The small account indicator is green after an online save and amber when attention is needed; open the menu for the full status.

### Export a bonus period

For a particular claim, choose **Custom dates** and enter the start and end dates. Both days are included, using the dispense's recorded date. An optional section name such as “October bonuses” becomes the heading in either format. The preview shows the selected period's record count and confirmed bonus total, including a warning when pending bonuses are excluded. Empty periods and reversed or incomplete date ranges cannot be downloaded.

The workbook contains a **Bonus period** worksheet with only that period's records, the date range, and its own total. Its filename includes the start and end dates. **All records** remains available and uses the original **Dispensing Record** worksheet. Searching the on-screen list does not change either export's scope. Exporting does not remove, archive or mark records as paid; overlapping periods may include the same records. The chosen dates are retained while the page stays open, and reset to this month after an ordinary reload. The export recovery refresh retains the chosen format, dates and section name.

The lens-set buttons switch between independent add-on/offer selections on the same record. The preview includes both sets, with each amount labelled 1st or 2nd set. Shared paper/frame bonuses are counted once (using the first-set frame rates); under 241, only the most expensive frame earns a bonus. For example, first-set UCSC €1.50 + second-set UCSC €2 + 160/190 frames under 241 €3 = **€6.50**. Selecting a second lens set alone uses the ordinary second-set rates. Select a second-pair special offer explicitly when that promotion applies. For a second-pair SV offer with any add-ons, the app automatically switches that set to the single flat €5 bonus. First-set bonuses and the shared frame bonus are kept separately. Golden Ticket and Third pair half price are now one offer on the same customer record. Selecting it immediately adds a €2 base bonus and opens independent third-pair add-ons underneath, at an additional €1 per selected eligible add-on (including varifocal designs). First- and second-set selections are never copied into the third pair. The €2 base is paid once, even without add-ons. Ordinary add-on rates and implicit UCSC do not apply to that pair. Super Boost earns the same third-pair rate. The third-pair base and per-add-on rates can be edited in Bonus key, defaulting to €2 and €1 for existing keys.


Without Supabase configured, records stay in this browser profile and site origin. With online saving connected, records and the bonus key also sync to the signed-in account's private database; the status distinguishes confirmed online saves from changes waiting to sync. Her existing local data stays intact until she signs in and chooses **Connect and upload**. A fresh browser can sign in and download the online copy. See [setup, recovery and conflict handling](docs/ONLINE-SAVING.md).

Private browsing and clearing browser data can remove the local copy, including changes not yet uploaded. Download JSON backups regularly; Excel/PDF are reports, JSON is for restoring. Customer information is never uploaded to GitHub. A connected app sends records/key to your Supabase project. Use a personal device: local storage is not encrypted, and signing out hides cached records without deleting pending work. Moving between GitHub Pages paths on the same domain shares this app's storage key.

## Bonus key and agreed rules

The user supplied the full key and exact table headings directly on 5 October 2026. The original paper image was unavailable, so the workbook reproduces the headings and tick-column structure without claiming an exact visual facsimile.

| Add-on | 1st set | 2nd set |
| --- | ---: | ---: |
| UCSC | €1.50 | €2.00 |
| 1.6 | €3.00 | €3.50 |
| 1.67 | €4.00 | €4.00 |
| 1.74 | €5.00 | €5.00 |
| Polaroid | €3.00 | €3.00 |
| Polaroid 1.6 | €4.00 | €4.00 |
| Polaroid 1.67 | €5.00 | €5.00 |
| Reaction | €2.00 | €2.00 |
| Reaction 1.67 | €5.00 | €5.00 |
| Tint | €1.00 | €1.00 |
| Elite | €2.00 | €2.00 |
| Tailormade | €2.50 | €2.50 |
| Supereader | €2.00 | €2.00 |

**Miyosmart** appears after Super Boost and is recorded at €0 on every pair, including Golden Ticket / third pair half price. It is retained in records and exports, has no bonus-key rate, and does not trigger the €5 second-pair add-on offer.

**Super Boost** appears immediately after Supereader as a record-only option. It is saved and included in Excel/PDF exports, earns €0 on the first and second sets, and does not trigger the €5 second-pair offer. On the third pair it earns the same €1 per-add-on rate as the other choices. Existing bonus keys remain compatible.

Elite, Tailormade and Supereader (Superreader) normally use the listed rate in either set. **Under 241, the Elite, Tailormade and Supereader designs earn no bonus in the second set**, because they are free. Keep them selected in both sets to record both supplied lenses; the preview and exports mark the second as “free under 241”. Free second-set Supereader includes UCSC, which earns €2 once even without ticking UCSC separately. Selecting 1.6, 1.67 or 1.74 replaces that coating bonus with only the selected second-set index rate (€3.50, €4 or €5 respectively). Explicitly ticking UCSC as well does not add another coating bonus. These amounts follow the saved UCSC/index rates; the free Supereader design rate is ignored. Other second-set add-ons retain their normal rates. For example, first-set Supereader + 1.74 and second-set Supereader earns €9 before frames (€2 + €5 + €2). Ticking **160** adds €1.50; **190** and **240** add €3 each. Other paper columns are zero-bonus markers because the supplied key lists no separate payment for them. With **241** selected, tick both frame prices on the same record: only the highest-priced frame earns a frame bonus. For example, 160 + 190 under 241 earns €3 for the frames, not €4.50. Lens add-on bonuses are calculated separately. Without 241, each tick is counted once. Combined options such as Polaroid 1.6 have their own rate: do not also tick their constituent options for the same lens.

| Offer | Behaviour |
| --- | --- |
| 2nd pair SV, no add-ons | €3 total, replacing the ordinary base/frame calculation. Requires SV and the second lens set. |
| 2nd pair with any add-ons | **€5 total once**, replacing the basic pair, frame and all individual add-on payments. Applies only to second-pair single vision (SV). Select the second-pair SV offer (automatic with paid add-ons) or second-pair add-ons; varifocals are ineligible. Selecting both never pays twice. |
| Golden Ticket / Third pair half price | One offer: €2 base immediately, plus €1 per separately selected third-pair add-on. Miyosmart adds zero. |

**Basic second-pair rate:** the full key says €3. The later clarification said “€3 (or €2, whichever it is)”; the app therefore retains the explicit €3 rate. This is editable under **Bonus key**.

For new records containing both lens sets, offers apply to their own set. The second-pair flat amount replaces the second-set bonus; first-set bonuses and the shared frame bonus remain. Shared paper/frame bonuses use the first-set rate.

For existing single-set records, the flat second-pair amount still replaces the entire ordinary bonus, including frame increments. Older Golden Ticket / third-pair records lack separate third-pair selections: they are marked Pending and excluded from confirmed totals until reviewed. Edit the record, select its third-pair add-ons (or untick the offer), and save. The app does not guess which original selections belonged to the third pair. The old offer keys remain in backups for compatibility but are no longer editable or used for payouts.


**Bonus key** allows rate, currency and offer-behaviour edits. Changing currency only relabels the amounts; it does not convert them. Saving a changed key recalculates all historical records, after confirmation; download a backup first if you need to retain an earlier key. New default keys in source code do not overwrite an existing browser's saved key.

All calculation arithmetic uses integer cents. Missing rates, an unconfirmed key, invalid offer prerequisites or competing replacement offers produce **Pending**, never a silent zero. Confirmed totals exclude pending rows and show how many are excluded. Pending records can still be saved while a rule is checked.

## Excel layout

The **Dispensing Record** worksheet (or **Bonus period** for a selected date range) uses the exact supplied headings:

```text
Date | Cust No | CX Name | SV | BIF | Vari | 241 | Other | RE |
70 | 95 | 130 | 160 | 190 | 240 | Addons | Bonus
```

Selected columns get a tick. Lens set and special offers appear within **Addons**, preserving the heading list. Records within the selected export sort chronologically. Dates are native Excel dates, IDs are text, bonuses are numeric currency values, and **TOTAL** is an Excel SUM formula with a cached result covering only the exported rows. Pending bonuses are explicitly labelled and excluded from the total. Header rows and customer columns are frozen, and filters are included. The wide paper grid prints in landscape A3, one page wide and as many pages tall as needed; change paper size in Excel if desired.

Exports contain only the dispensing records and totals; the bonus key remains available in the app. Record bonuses are snapshots: editing cells in Excel does not rerun the app's rules. Edit in the app and export again for recalculated bonuses. User text is written as string cells, never interpreted as Excel formulas.

## PDF layout

The **PDF** option downloads a real `.pdf` file, with the same inclusive date filtering, section name, selected records and confirmed bonus total as Excel. It uses the original 17 paper-table headings in landscape A3 to keep the wide table readable. Selected columns use an **X**, with lens set and special offers in **Addons**. It includes a dated report heading, repeated table headings, page numbers, and pending-bonus warnings. Customer numbers retain leading zeros; embedded Roboto fonts support currency symbols and accented names. Long rows wrap and remain together across page breaks.

The downloaded PDF can be shared or printed from a PDF viewer. Choose A3 landscape for the intended print size, or use the viewer's fit-to-page option for smaller paper. Export generation does not contact another service or upload customer data. The current records remain unchanged; both export formats are reporting snapshots, while JSON is the restorable backup.

## Deploy from GitHub with GitHub Pages

1. Create a GitHub repository, for example `dispensing-record`.
2. Put **the contents of this folder at the repository root**, including the hidden `.github/` folder, `package.json` and `package-lock.json`. Do not commit `node_modules/`, customer exports or backup files. The included `.gitignore` excludes generated build/test files.
3. Push to the `main` branch. For a new repository from this folder:

   ```sh
   git init
   git add .
   git commit -m "Build dispensing record app"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/dispensing-record.git
   git push -u origin main
   ```

4. In the repository, open **Settings → Pages → Build and deployment → Source**, and choose **GitHub Actions**.
5. Open **Actions → Test and deploy to GitHub Pages**. Run it manually if the initial push occurred before Pages was enabled. The included workflow installs locked dependencies, tests, builds, runs desktop/mobile browser checks, and deploys `dist/`.
6. The deployment provides a URL such as `https://YOUR-USERNAME.github.io/dispensing-record/`. Open that URL on the phone. Browser **Add to Home Screen** may create a shortcut. This app does not install a service worker or promise offline page loading.

Future pushes to `main` repeat validation and deployment. Pull requests run checks without deploying. The relative Vite base (`./`) supports repository subpaths and a root/custom-domain deployment without editing a repository name. No client-side URL router is used. GitHub Pages serves public app assets; records are stored in the browser and, when connected, the user's private Supabase document. Private-repository Pages availability depends on the account's plan.

After pushing, enable GitHub Pages as described above. A successful repository push alone does not create a live site.

References: [Vite static deployment guide](https://vite.dev/guide/static-deploy.html), [ExcelJS documentation](https://github.com/exceljs/exceljs#readme), and [pdfmake browser documentation](https://pdfmake.github.io/docs/0.3/getting-started/client-side/).

## Tests and maintenance

```sh
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

Unit tests cover every supplied add-on rate, frames, Golden Ticket, second-pair caps, invalid combinations, rounding, data validation, storage conflicts/failures, Excel round trips, and PDF content, Unicode text, page numbering and page bounds. Browser checks exercise mobile/desktop entry, editing, removal, persistence, Excel and PDF downloads, backup restoration, key changes and stale tabs. Optional `SCREENSHOT_DIR` captures synthetic-data review screenshots; no test data ships in the app.

Online-saving checks also cover Postgres access policies, account binding, merge conflicts, interrupted uploads, fresh-browser recovery and mobile sign-in. Database policy tests run the actual migration in PGlite. Browser cloud tests use a mocked API; they do not contact your live database. See [online-saving documentation](docs/ONLINE-SAVING.md) for deployment and live verification.

ExcelJS 4.4.0's transitive `uuid` dependency is overridden to 11.1.1 to address the reported older-version advisory. ExcelJS's use of the `v4` API is compatible and the workbook round-trip tests cover the export path. The browser bundle is larger only when Excel export is loaded. Test dependency updates before deployment.

Files:

- `src/model.js`: supplied key, validation and pure bonus calculations.
- `src/main.js` / `src/style.css`: interface and responsive styles.
- `src/storage.js`: versioned browser persistence and stale-write detection.
- `src/cloud-model.js`: three-way sync, revisions, conflicts and interrupted-upload recovery.
- `src/cloud-client.js` / `src/cloud-ui.js`: Supabase authentication, database adapter and online-save interface.
- `supabase/migrations/`: private tables and database access policies.
- `scripts/configure-cloud.mjs`: validates and writes public deployment settings.
- `src/workbook.js`: formatted paper-table workbook.
- `src/pdf.js`: printable PDF table and pagination.
- `src/export-table.js`: shared paper headings and record details for both formats.
- `src/export-selection.js`: inclusive date filtering, period summaries, month shortcuts and export filenames.
- `.github/workflows/deploy.yml`: checks and GitHub Pages deployment.

Records may contain an optional `lensSets` object with independent `first` and `second` add-on/offer arrays. Existing single-set records remain readable and keep their original single-set calculation; editing one adds the paired format only when choices are added to the other set. Both sets are retained in backups and online documents, and listed in the Addons column of Excel/PDF exports. Existing 241 records are recalculated using only their highest-priced frame and no bonus for free second-set varifocals. Records with varifocals incorrectly marked for a second-pair flat offer are flagged Pending for review.

Storage is schema version 1 under `dispensing-record:v1`. Broken stored data is not overwritten automatically. Download the original stored text for recovery or restore a valid JSON backup. Writes fail visibly if storage is blocked, full or changed in another tab.

Phone form fields use separate full-width rows with matching 48px heights and 16px input text. Grid children and native date controls are constrained to their available width, including Safari. The focused `mobile-layout.spec.js` checks entry and export fields at 320-1280px in Chromium and WebKit, covering long customer numbers, saving and editing.


### Export loading recovery

A page left open during a deployment may refer to an old export bundle that GitHub Pages no longer serves. Network interruptions can also stop the export tools loading. A bounded retry uses the build manifest and a fresh module URL to bypass Safari's cached failed requests. It only loads export code from the same build as the open app, to avoid mixing releases. If loading still fails, the export dialog offers **Refresh app**, with a fresh page request and preserved report preferences. It never clears local records, the bonus key or sign-in storage, and does not refresh automatically. Save or clear any unfinished dispense first; an active sync must also finish. Once refreshed, open Export and download again. In an older app version without the recovery button, use Safari's reload arrow. Do not clear website data to fix this error.
