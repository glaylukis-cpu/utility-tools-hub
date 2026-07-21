# PDF Tools QA Checklist

## v0.3.3 QA / UX polish

Use local, non-sensitive test PDFs with known page counts and visible page numbers. Keep the source files unchanged so each operation can be repeated. Record only file names and page counts in QA notes; do not copy private local paths.

## v0.3.4 Merge bugfix QA

- [ ] Recheck the two real PDFs that exposed the v0.3.3 Merge failure, even though each input opens on its own.
- [ ] Repeat the merge with an output PDF directly under the Desktop folder.
- [ ] Confirm a successful output opens, has the combined page count, and preserves input order.
- [ ] Confirm normal unencrypted PDFs, including Delete / Rotate outputs, can still be merged.
- [ ] Confirm an encrypted or permission-protected PDF is rejected with a specific, actionable message.
- [ ] Remember that a PDF can open in Windows while still carrying encryption or permission protection internally.
- [ ] If the merge fails, confirm the UI distinguishes unreadable or unsupported input, protection, an input/output conflict, and an unwritable output without exposing full paths.

## v0.4.0 PDF inspect UI QA

- [ ] Select a normal PDF and confirm file name, readable file size, page count, PDF version, and Normal status are shown without a full path.
- [ ] Confirm Title, Author, Creator, and Producer appear only when present, and missing metadata is handled clearly.
- [ ] Select an encrypted or permission-protected PDF and confirm Protected status and the no-decryption/no-permission-bypass warning.
- [ ] Confirm invalid or damaged PDFs show a safe error, PDF files stay on this device is visible, and Preview / thumbnails / Reorder remain unavailable.
- [ ] Select an input in each Split / Extract / Rotate / Delete card and confirm file size, page count, PDF version, and protection status appear automatically.
- [ ] Confirm protected inputs show an operation-card warning and that all four existing operations can still be executed with supported PDFs.

## v0.4.1 PDF Workbench QA polish

- [ ] Confirm the three-column Workbench remains readable without horizontal overflow at 1280, 1600, and 1920 px widths, and falls back to one column at mobile width.
- [ ] Confirm Inspect PDF shows file name, size, page count, PDF version, and Normal / Protected status without exposing a full path.
- [ ] Confirm the Merge summary shows every selected PDF, merge order, Total pages, and a warning when a protected PDF is included.
- [ ] Confirm Split, Extract, Rotate, and Delete show their input PDF summaries after selection.
- [ ] Confirm Delete pages is clearly described as whole-page removal, not redaction.
- [ ] Confirm Preview, thumbnails, and Reorder remain labeled Planned and unavailable.
- [ ] Confirm OCR, redaction, and direct PDF text editing remain labeled Research / not implemented.
- [ ] Run Merge, Split, Extract, Rotate, and Delete with supported real PDF files and confirm their existing execution flows still complete.

## v0.4.2 PDF preview research spike

- [ ] Confirm `Docs/PdfPreviewResearch.md` documents the candidate approaches, comparison, risks, staged path, and next implementation step.
- [ ] Confirm the Workbench does not claim that PDF page rendering or preview is implemented.
- [ ] Confirm Preview, thumbnails, and Reorder remain Planned and unavailable.
- [ ] Confirm OCR, redaction, and direct PDF text editing remain Research / not implemented.
- [ ] Confirm Delete pages remains described as whole-page removal, not redaction.
- [ ] Run Merge, Split, Extract, Rotate, and Delete with supported PDF files and confirm the research-only changes do not alter their existing flows.

## v0.4.3 Operation plan preview

- [ ] Confirm the Merge operation plan shows merge order, per-file page counts and status, and total pages.
- [ ] Confirm the Split operation plan estimates single-page output files and shows a prefix-based filename example.
- [ ] Confirm Extract, Rotate, and Delete operation plans show their selected page targets and range-check status.
- [ ] Confirm Delete shows a strong warning when the plan would remove every page and still states that page deletion is not redaction.
- [ ] Confirm the Operation plan preview does not claim to render actual PDF pages or thumbnails.
- [ ] Run Merge, Split, Extract, Rotate, and Delete with supported PDF files and confirm their existing execution flows still work.

## Merge PDFs

- [ ] Select two or more PDF files.
- [ ] Confirm the summary list shows merge order, file name, file size, page count, PDF version, and Normal / Protected status for each input.
- [ ] Confirm Total pages is shown, and an uncounted file is explained without crashing the app.
- [ ] Confirm a protected input shows a warning before Merge and does not imply decryption or permission bypass.
- [ ] Select an output PDF and run Merge PDFs.
- [ ] Confirm the success state reports the input count, total page count, and output file name.
- [ ] Open the output PDF and confirm all pages are readable and follow the selected file order.

## Split PDF

- [ ] Select one multi-page PDF.
- [ ] Select an output folder and enter a valid prefix such as `document`.
- [ ] Run Split PDF and confirm files such as `document-page-001.pdf` are created.
- [ ] Confirm the generated file count matches the source page count.
- [ ] Open every generated PDF and confirm each contains the expected single page.

## Extract pages

- [ ] Extract `1,3` and confirm the output contains those two pages in order.
- [ ] Extract `1-3,5` and confirm the output contains four pages in order.
- [ ] Confirm page numbers are interpreted as 1-based.
- [ ] Enter a page outside the source range and confirm a clear error is shown.
- [ ] Open each successful output PDF and confirm it is readable.

## Rotate pages

- [ ] Rotate one or more selected pages by 90 degrees.
- [ ] Repeat with 180 degrees.
- [ ] Repeat with 270 degrees.
- [ ] Confirm only the selected pages are rotated.
- [ ] Confirm unselected pages retain their original orientation.
- [ ] Confirm a new output PDF is created and the source PDF is not overwritten.

## Delete pages

- [ ] Delete one selected page and confirm the remaining page order.
- [ ] Delete a page range and confirm only those whole pages are removed.
- [ ] Attempt to delete every page and confirm the operation is rejected.
- [ ] Confirm a new output PDF is created and the source PDF is not overwritten.
- [ ] Confirm the UI clearly states that Delete pages is not redaction.
- [ ] Confirm no text-level or personal-information masking capability is implied.

## Error cases

- [ ] Try each operation without selecting an input PDF and confirm the disabled reason is clear.
- [ ] Try each operation without selecting its required output destination.
- [ ] Try Split PDF with an empty prefix.
- [ ] Try Split PDF with a prefix containing a path separator.
- [ ] Try Extract, Rotate, and Delete with an empty page selection.
- [ ] Try invalid page selections such as `0`, `3-1`, `1,,3`, and non-numeric text.
- [ ] Attempt to select a non-PDF file and confirm it is rejected.
- [ ] Confirm errors suggest the field or selection that should be corrected without exposing a full local path.

## Loading and result states

- [ ] Confirm the loading message names the active operation.
- [ ] Confirm other PDF operations cannot start while one operation is running.
- [ ] Confirm success messages include useful counts and only the output file or folder name.
- [ ] Confirm failure messages do not expose internal details or full local paths.
- [ ] Confirm polling stops after success, failure, navigation away, and component unmount.

## Safety notes

- [ ] Confirm Merge, Split, Extract, Rotate, and Delete are labeled as page-operation MVPs.
- [ ] Confirm Delete pages is described as whole-page removal, not redaction.
- [ ] Confirm safe redaction is labeled Research / Safety critical and unavailable.
- [ ] Confirm OCR-assisted workflow is labeled Research / Safety critical and unavailable.
- [ ] Confirm direct PDF text editing is labeled Research / Safety critical and unavailable.
- [ ] Confirm the UI states that PDF files stay on this device.

## Planned tools

- [ ] Confirm Reorder pages is Planned and disabled.
- [ ] Confirm page numbers, watermark, text stamp, image stamp, PDF to images, and Images to PDF are Planned and disabled.
- [ ] Confirm none of the planned or research items appear available or clickable.

## Regression checks

- [ ] Converter Tools opens and JSON / CSV / Markdown / Base64 / URL conversions still work.
- [ ] Excel HTML Converter opens and its existing conversion flow is unchanged.
- [ ] Text Case Converter opens and its existing conversion flow is unchanged.
- [ ] HTML Editor opens and its existing editing, project, and export flows are unchanged.
- [ ] Account, Billing, Settings, and Updater panels still open.
- [ ] Tools navigation and Back to Tools behavior remain intact.
