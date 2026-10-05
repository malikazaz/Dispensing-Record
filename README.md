# Dispensing Record

A mobile-friendly dispensing log that saves records in the browser and exports formatted Excel workbooks and printable PDFs. Plain JavaScript + Vite, with ExcelJS for `.xlsx` generation and pdfmake for `.pdf` generation, entirely on the device. No backend, login, database, tracking or API keys.

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

1. Enter date, customer number and customer name. Customer numbers remain text, preserving leading zeros.
2. Tick all relevant paper columns, choose the lens set and select purchased add-ons.
3. Open **Special offers** when relevant. The bonus and its breakdown update immediately.
4. Save the dispense. Edit or remove it from **Your records**. Removing asks for confirmation.
5. **Export records** opens the bonus-report dialog. Choose **Excel (.xlsx)** or **PDF (.pdf)**, then **This month**, **Last month**, **Custom dates** or **All records**. Optionally name the section, review its record count and bonus total, and select **Download Excel** or **Download PDF**. **Download backup** saves all records and the bonus key in a restorable JSON file.

### Export a bonus period

For a particular claim, choose **Custom dates** and enter the start and end dates. Both days are included, using the dispense's recorded date. An optional section name such as “October bonuses” becomes the heading in either format. The preview shows the selected period's record count and confirmed bonus total, including a warning when pending bonuses are excluded. Empty periods and reversed or incomplete date ranges cannot be downloaded.

The workbook contains a **Bonus period** worksheet with only that period's records, the date range, and its own total, plus the **Bonus key** worksheet. Its filename includes the start and end dates. **All records** remains available and uses the original **Dispensing Record** worksheet. Searching the on-screen list does not change either export's scope. Exporting does not remove, archive or mark records as paid; overlapping periods may include the same records. The chosen dates are retained while the page stays open, and reset to this month after reloading.

Selecting a second lens set alone uses the ordinary second-set rates. Select a second-pair special offer explicitly when that promotion applies. For a second-pair SV offer with any add-ons, the app automatically switches to the single flat €5 bonus.

Records are specific to this browser profile and site origin. They do not synchronise across devices or local/GitHub URLs. Moving between GitHub Pages paths on the same domain shares this app's storage key. Private browsing and clearing browser data can remove records. Download backups regularly; Excel is for reporting, JSON is for restoring. Customer information stays on the device until the user downloads or shares a file. The app does not upload records to GitHub. Use an appropriate device for customer information; browser storage is not encrypted by the app and the site has no access control.

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

Single-column Elite, Tailormade and Supereader rates are applied to both sets. Ticking **160** adds €1.50; **190** and **240** add €3 each. Other paper columns are zero-bonus markers because the supplied key lists no separate payment for them. Each tick is counted once. Combined options such as Polaroid 1.6 have their own rate: do not also tick their constituent options for the same lens.

| Offer | Behaviour |
| --- | --- |
| 2nd pair SV, no add-ons | €3 total, replacing the ordinary base/frame calculation. Requires SV and the second lens set. |
| 2nd pair with any add-ons | **€5 total once**, replacing the basic pair, frame and all individual add-on payments. Select the second-pair SV offer (automatic with add-ons), or second-pair add-ons for other eligible lens types. Selecting both never pays twice. |
| 3rd pair half-price with 2-4-1 | Adds €2. Requires 241; cannot combine with second-pair offers on the same record. |
| Golden Ticket | **Adds €1 for each selected add-on to the normal bonus.** This follows the user's latest correction and supersedes the earlier “replace” answer. A combined add-on choice counts once. |

**Basic second-pair rate:** the full key says €3. The later clarification said “€3 (or €2, whichever it is)”; the app therefore retains the explicit €3 rate. This is editable under **Bonus key**.

Implementation conventions: the flat second-pair amount replaces the entire ordinary bonus, including frame increments, following “it will all just come to €5.” Golden Ticket is an additional payment, so if also selected with that flat offer, the result is €5 plus €1 per selected add-on. The third-pair €2 is treated as an additional payment. Verify those combinations before using them if the paper key imposes restrictions that were not supplied.

**Bonus key** allows rate, currency and offer-behaviour edits. Changing currency only relabels the amounts; it does not convert them. Saving a changed key recalculates all historical records, after confirmation; download a backup first if you need to retain an earlier key. New default keys in source code do not overwrite an existing browser's saved key.

All calculation arithmetic uses integer cents. Missing rates, an unconfirmed key, invalid offer prerequisites or competing replacement offers produce **Pending**, never a silent zero. Confirmed totals exclude pending rows and show how many are excluded. Pending records can still be saved while a rule is checked.

## Excel layout

The **Dispensing Record** worksheet (or **Bonus period** for a selected date range) uses the exact supplied headings:

```text
Date | Cust No | CX Name | SV | BIF | Vari | 241 | Other | RE |
70 | 95 | 130 | 160 | 190 | 240 | Addons | Bonus
```

Selected columns get a tick. Lens set and special offers appear within **Addons**, preserving the heading list. Records within the selected export sort chronologically. Dates are native Excel dates, IDs are text, bonuses are numeric currency values, and **TOTAL** is an Excel SUM formula with a cached result covering only the exported rows. Pending bonuses are explicitly labelled and excluded from the total. Header rows and customer columns are frozen, and filters are included. The wide paper grid prints in landscape A3, one page wide and as many pages tall as needed; change paper size in Excel if desired.

The **Bonus key** worksheet documents the exported rates, offer modes, source and calculation conventions. Record bonuses are snapshots: editing cells in Excel does not rerun the app's rules. Edit in the app and export again for recalculated bonuses. User text is written as string cells, never interpreted as Excel formulas.

## PDF layout

The **PDF** option downloads a real `.pdf` file, with the same inclusive date filtering, section name, selected records and confirmed bonus total as Excel. It uses the original 17 paper-table headings in landscape A3 to keep the wide table readable. Selected columns use an **X**, with lens set and special offers in **Addons**. It includes a dated report heading, repeated table headings, page numbers, pending-bonus warnings, and a separate **Bonus key** appendix. Customer numbers retain leading zeros; embedded Roboto fonts support currency symbols and accented names. Long rows wrap and remain together across page breaks.

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

Future pushes to `main` repeat validation and deployment. Pull requests run checks without deploying. The relative Vite base (`./`) supports repository subpaths and a root/custom-domain deployment without editing a repository name. No client-side URL router is used. GitHub Pages serves public app assets; records remain local to each visitor. Private-repository Pages availability depends on the account's plan.

After pushing, enable GitHub Pages as described above. A successful repository push alone does not create a live site.

References: [Vite static deployment guide](https://vite.dev/guide/static-deploy.html), [ExcelJS documentation](https://github.com/exceljs/exceljs#readme), and [pdfmake browser documentation](https://pdfmake.github.io/docs/0.3/getting-started/client-side/).

## Tests and maintenance

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover every supplied add-on rate, frames, Golden Ticket, second-pair caps, invalid combinations, rounding, data validation, storage conflicts/failures, Excel round trips, and PDF content, Unicode text, page numbering and page bounds. Browser checks exercise mobile/desktop entry, editing, removal, persistence, Excel and PDF downloads, backup restoration, key changes and stale tabs. Optional `SCREENSHOT_DIR` captures synthetic-data review screenshots; no test data ships in the app.

ExcelJS 4.4.0's transitive `uuid` dependency is overridden to 11.1.1 to address the reported older-version advisory. ExcelJS's use of the `v4` API is compatible and the workbook round-trip tests cover the export path. The browser bundle is larger only when Excel export is loaded. Test dependency updates before deployment.

Files:

- `src/model.js`: supplied key, validation and pure bonus calculations.
- `src/main.js` / `src/style.css`: interface and responsive styles.
- `src/storage.js`: versioned browser persistence and stale-write detection.
- `src/workbook.js`: formatted paper-table workbook.
- `src/pdf.js`: printable PDF table, pagination and bonus-key appendix.
- `src/export-table.js`: shared paper headings and record details for both formats.
- `src/export-selection.js`: inclusive date filtering, period summaries, month shortcuts and export filenames.
- `.github/workflows/deploy.yml`: checks and GitHub Pages deployment.

Storage is schema version 1 under `dispensing-record:v1`. Broken stored data is not overwritten automatically. Download the original stored text for recovery or restore a valid JSON backup. Writes fail visibly if storage is blocked, full or changed in another tab.
