# Claims and bonus submissions

Use **Claims** when preparing a bonus submission. The ordinary **Export** button creates a report of unclaimed records; it does not track a submission.

## First use

Nothing has been submitted yet, so all existing receipts start **unclaimed**. Keep their original dispense dates. A September receipt can be included in an October claim without changing the receipt's date.

## Prepare a claim quickly

1. Open **Claims → Create claim** and enter a name, such as **October bonuses**. The name defaults to the current month and year.
2. Choose receipts in bulk:
   - Leave **Receipt month** set to **All months** and tap **Select all** to select every available receipt with a confirmed bonus.
   - Choose a month and tap **Select this month** to select that month's available receipts.
   - For a specific date range, open **Filter by dispense date**, set **From** and/or **To**, then tap **Select shown**. Boundaries are inclusive.
3. Untick individual receipts to leave them for later. **Clear selection** removes every selection, including selections hidden by a filter.
4. Check the selected count and total, then tap **Save draft claim**.

Selections stay selected when you change months or date filters. For example, select September leftovers, switch to October, and select October's receipts to include both months in one claim. The count and total cover **all selected receipts**, including those currently hidden by a filter.

Pending bonuses appear in the list but cannot be selected, including through bulk selection. Review those records and their bonus rules before claiming them. A confirmed €0 receipt can be included for record-keeping.

## Download, send, and mark submitted

1. Open the saved draft and check its records and total.
2. Tap **Download claim**, choose **PDF** or **Excel**, then download the file.
3. Send the file through your usual submission process. The app does not send it for you.
4. Return to the claim, tap **Mark submitted**, and confirm the record count and total.

**Downloading does not mark a claim submitted.** A failed download leaves the draft intact, and you can retry. Downloading the same claim again produces the same saved record details and amounts, with the same claim reference; it does not create a second claim. Generated file metadata may differ.

PDF and Excel contain the records table and total, without a bonus-key page or worksheet. A claim export uses its saved selection; the ordinary report's date filters do not change it.

## What each status means

| Status | Available for another claim? | Can the original record be edited or removed? | Claim download |
| --- | --- | --- | --- |
| Unclaimed record | Yes, once its bonus is confirmed | Yes | Include it in a new claim |
| Draft | No; reserved in this draft | No | PDF or Excel |
| Submitted | No | No | Download the saved claim again |
| Draft cancelled | Records are released unless another claim reserves them | Yes, unless claimed again | History remains; the cancelled claim cannot be exported |
| Submission undone | Records are released unless another claim reserves them | Yes, unless claimed again | History remains; the undone claim cannot be exported |

**Submitted** means you confirmed that you sent the claim. It does not mean the employer has approved or paid it; the app has no payment-status integration.

## September receipts in an October claim

| Receipt | What happens |
| --- | --- |
| September receipt included in a submitted September claim | Excluded from every new claim |
| September receipt left out of that claim | Remains unclaimed and can be selected for October |
| October receipt | Can be selected alongside the September leftover |

The claim name describes the submission; each record retains its own dispense date.

## Fixed amounts and bonus-key changes

Saving a **draft** freezes each selected record's details, add-on description, bonus amount and currency. Marking it submitted preserves that same snapshot. Later changes to the bonus key or calculation rules do not recalculate the saved claim.

Unclaimed records continue to use the current key. To change the records or amounts in a draft, cancel it, make the corrections, and create a new draft. The old draft stays in the history.

The top cards show:

- **Unclaimed bonus:** confirmed bonuses not yet submitted, including records reserved in saved drafts. Draft amounts remain frozen.
- **Claimed bonus:** the frozen amounts in submitted claims. This means submitted, not approved or paid.
- **All-time total:** unclaimed plus claimed across all currently saved records, regardless of dispense month. It counts each record once; cancelled/undone claim snapshots are not added again. Removed records are not included.

Pending bonuses are excluded. Undoing submission moves released records back to unclaimed using the current key. Claims in another currency retain that currency; the cards exclude those records and display a note rather than adding unlike currencies. The record count is available on the Records tab.


## Correct a mistake

- **Cancel draft** releases its records and keeps the cancelled draft's snapshot and history.
- **Undo submission** requires confirmation, keeps the submitted claim's snapshot and correction history, and releases its records. Use it only to correct a mistaken submission status. It does not recall a file already sent or cancel a payment.
- After release, edit the records if needed and prepare a new claim. The old claim is not overwritten or reopened.

The same saved record cannot belong to two active claims. When entering another record with the same customer number and dispense date, the app warns about a possible duplicate and shows the existing record's claim status. You can confirm a legitimate separate receipt; a match alone does not prove duplication.

## Saving and recovery

Claims save in this browser and, when connected, sync to the account alongside records and the bonus key. **Account → Download backup** includes the claim history. PDF and Excel are reports, not restorable backups.

Before switching devices, check **Saved online and on this device**, then sync the other device. Offline devices cannot see each other's unsynced claims. Refresh older open app tabs before using the new workflow.

Restoring a JSON backup replaces the current records, bonus key and claim history after confirmation. An older backup can therefore remove submission history and make receipts available again. Keep a current backup and review claims after a restore. See [online saving and conflict recovery](ONLINE-SAVING.md).

## Common questions

**A receipt is missing from the selection list.** Check active drafts and submitted claims, then clear the month/date filter. Pending receipts remain visible but disabled.

**The selection total includes receipts I cannot see.** Selected receipts stay selected across filters. Choose **All months** to review the full selection, or **Clear selection** to start again.

**The Export button is disabled but I have saved records.** All records may be reserved or submitted. Open **Claims** and use **Download claim** for the relevant saved claim.

**I need to add or remove receipts from a saved draft.** Cancel the draft and create a new one with the correct selection.

**Records changed while I was choosing a claim.** Close Create claim and reopen it to review the latest records. A routine sync with unchanged records does not invalidate the selection.

**An export fails to load on the phone.** Use the export dialog's **Refresh app** option after saving or clearing any unfinished dispense. For a claim, return to **Claims**, reopen the saved claim and download again. Do not clear browser data to repair an export problem.
