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

## v0.4.4 Operation plan preview QA polish

- [ ] Confirm every Operation plan is labeled as a planning aid and cannot be mistaken for rendered PDF pages or thumbnails.
- [ ] Confirm Merge order and Total pages remain readable at 1280, 1600, 1920, and mobile widths.
- [ ] Confirm Split shows its output estimate and a prefix-based output-name example.
- [ ] Confirm Extract, Rotate, and Delete show readable target-page chips for `1`, `1,3,5`, `1-3`, and `1,3,5-7`.
- [ ] Confirm `0`, `-1`, `abc`, `3-1`, duplicate pages, and empty input receive clear validation or setup guidance.
- [ ] Confirm a page above the inspected page count shows an out-of-range warning.
- [ ] Confirm Delete warns when every source page would be removed and continues to state that Delete pages is not redaction.
- [ ] Confirm protected PDF warnings remain visible without implying decryption or permission bypass.
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

- [ ] Confirm Merge, Split, Extract, Rotate, Delete, and Reorder are labeled as page-operation MVPs.
- [ ] Confirm Delete pages is described as whole-page removal, not redaction.
- [ ] Confirm safe redaction is labeled Research / Safety critical and unavailable.
- [ ] Confirm OCR-assisted workflow is labeled Research / Safety critical and unavailable.
- [ ] Confirm direct PDF text editing is labeled Research / Safety critical and unavailable.
- [ ] Confirm the UI states that PDF files stay on this device.

## Planned tools

- [ ] Confirm Reorder pages is Available while drag-and-drop reorder remains Planned.
- [ ] Confirm real PDF page preview, thumbnails, page numbers, watermark, and overlay writing are Planned and disabled.
- [ ] Confirm none of the planned or research items appear available or clickable.

## Regression checks

- [ ] Converter Tools opens and JSON / CSV / Markdown / Base64 / URL conversions still work.
- [ ] Excel HTML Converter opens and its existing conversion flow is unchanged.
- [ ] Text Case Converter opens and its existing conversion flow is unchanged.
- [ ] HTML Editor opens and its existing editing, project, and export flows are unchanged.
- [ ] Account, Billing, Settings, and Updater panels still open.
- [ ] Tools navigation and Back to Tools behavior remain intact.

## v0.5.0 Step 1 PDF reorder core / bridge

- [ ] Confirm `pdf_reorder` can reorder pages using a complete page order.
- [ ] Confirm empty, invalid, duplicate, missing, and out-of-range page orders are rejected.
- [ ] Confirm protected PDFs are rejected without decryption or permission bypass.
- [ ] Confirm reorder UI, drag-and-drop, thumbnails, and real PDF rendering are not implemented yet.

## v0.5.0 Step 2 PDF reorder UI connection

- [ ] Confirm Reorder pages UI appears in PDF Workbench.
- [ ] Confirm the Reorder input PDF summary is displayed.
- [ ] Confirm a full page order such as `3,1,2` is accepted.
- [ ] Confirm missing, duplicate, invalid, and out-of-range page orders show warnings.
- [ ] Confirm `pdf_reorder` can execute and write a new PDF.
- [ ] Confirm drag-and-drop reorder, thumbnails, and real PDF rendering are not implemented.

## v0.5.0 Step 3 Reorder QA polish

- [ ] Confirm the Reorder pages card, input picker, input PDF summary, page-order field, output picker, and run button are visible.
- [ ] Confirm a full page order such as `3,1,2` is Valid for a three-page PDF.
- [ ] Confirm empty, missing, duplicate, invalid, and out-of-range page orders show clear warnings.
- [ ] Confirm the Reorder operation plan is labeled as a planning aid, not a real PDF preview.
- [ ] Confirm `pdf_reorder` writes a new readable PDF with the same page count and the requested page order.
- [ ] Confirm protected PDFs are warned about or rejected without decryption or permission bypass.
- [ ] Confirm drag-and-drop reorder, thumbnails, and real PDF rendering remain unimplemented.
- [ ] Confirm Inspect, Merge, Split, Extract, Rotate, Delete, and Reorder remain available.

## v0.6.0 Step 1 Watermark planning

- [ ] Confirm `Docs/PdfWatermarkPlan.md` exists.
- [ ] Confirm watermark is described as additive overlay content, not direct PDF text editing.
- [ ] Confirm visual masks are not described as safe redaction.
- [ ] Confirm OCR, redaction, and direct PDF text editing remain unimplemented.
- [ ] Confirm Inspect, Merge, Split, Extract, Rotate, Delete, and Reorder still work.

## v0.6.0 Step 2 Text watermark core / bridge

- [ ] Confirm `pdf_text_watermark` writes a new readable PDF without overwriting the source.
- [ ] Confirm all-page and selected-page watermarking validate their page selections.
- [ ] Confirm protected PDFs are rejected without decryption or permission bypass.
- [ ] Confirm watermarking is additive and is not described as redaction or direct text editing.
- [ ] Confirm watermark UI, image watermark, stamps, preview, OCR, and redaction remain unimplemented.

## v0.6.0 Step 3 Text watermark UI connection

- [ ] Confirm the Text watermark card appears in PDF Workbench and displays the selected input PDF summary.
- [ ] Confirm printable ASCII text such as `DRAFT` can be entered and non-ASCII text shows an unsupported warning.
- [ ] Confirm an empty page field targets all pages and selected-page formats such as `1,3,5-7` are validated.
- [ ] Confirm opacity, rotation, and font-size warnings prevent invalid execution.
- [ ] Confirm `pdf_text_watermark` can execute and write a new PDF with loading, success, and safe error feedback.
- [ ] Confirm watermarking is described as additive and not redaction or direct PDF text editing.
- [ ] Confirm image watermark, stamps, real preview, OCR, and redaction remain unimplemented.

## v0.6.0 Step 4 Text watermark QA polish

- [ ] Confirm the Text watermark card and input PDF summary remain visible and readable.
- [ ] Confirm ASCII text such as `DRAFT`, `CONFIDENTIAL`, and `SAMPLE` is accepted.
- [ ] Confirm empty, non-ASCII, and over-128-character text shows a clear warning.
- [ ] Confirm all pages and selected pages (`1`, `1,3,5`, `1-3`, `1,3,5-7`) can be targeted.
- [ ] Confirm invalid, reversed, zero, negative, non-numeric, and out-of-range page input shows a warning.
- [ ] Confirm opacity, rotation, and font-size validation appears beside the related field.
- [ ] Confirm `pdf_text_watermark` writes a new PDF that opens and keeps the source page count.
- [ ] Confirm all-page and selected-page output contains the requested additive watermark text.
- [ ] Confirm watermarking is not described as PDF text editing or redaction.
- [ ] Confirm protected PDFs are warned about or rejected without decryption or permission bypass.
- [ ] Confirm image watermark, stamps, overlay writing, OCR, and redaction remain unimplemented.
- [ ] Confirm Inspect, Merge, Split, Extract, Rotate, Delete, and Reorder remain available.

## v0.6.1 Compact layout

- [ ] Confirm the operation selector shows Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, and Text watermark.
- [ ] Confirm only the active operation card and its operation plan are shown.
- [ ] Confirm switching operations preserves selected files, inputs, outputs, and results.
- [ ] Confirm Text watermark is selectable without scrolling to the bottom of the page.
- [ ] Confirm the selected-files and right-side information panels are compact and remain usable at 1280px and mobile widths.
- [ ] Confirm all existing PDF operations still execute through the existing flow.
- [ ] Confirm no PDF preview, thumbnails, OCR, redaction, or direct PDF text editing was added.

## v0.6.2 Compact layout overflow hotfix

- [ ] Confirm selecting a PDF does not break the compact layout.
- [ ] Confirm long PDF file names stay inside their cards.
- [ ] Confirm the input summary stays inside the active operation card.
- [ ] Confirm the operation selector stays inside the center column.
- [ ] Confirm 1280px width has no horizontal overflow.
- [ ] Confirm all existing PDF operations still execute through the existing flow.

## v0.7.0 Step 1 Page numbers planning

- [ ] Confirm `Docs/PdfPageNumbersPlan.md` exists.
- [ ] Confirm Page numbers is described as additive content, not direct PDF text editing.
- [ ] Confirm Page numbers is not described as redaction.
- [ ] Confirm existing page numbers are not claimed to be removed or replaced.
- [ ] Confirm OCR, redaction, and direct PDF text editing remain unimplemented.
- [ ] Confirm Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, and Text watermark still work.

## v0.7.0 Step 2 Page numbers core / bridge

- [ ] Confirm `pdf_page_numbers` writes a new readable PDF without overwriting the source.
- [ ] Confirm all pages and selected pages are validated and numbered in PDF page order.
- [ ] Confirm start number and every supported page-number format are validated.
- [ ] Confirm all six positions, bounded margins, and bounded font size are validated.
- [ ] Confirm protected PDFs are rejected without decryption or permission bypass.
- [ ] Confirm Page numbers is additive and is not described as redaction or direct text editing.
- [ ] Confirm existing page numbers are not removed and the Page numbers UI is still unimplemented.

## v0.7.0 Step 3 Page numbers UI connection

- [ ] Confirm Page numbers appears in PDF Workbench and the nine-item operation selector does not overflow.
- [ ] Confirm selecting an input PDF displays file name, size, page count, PDF version, and protection status.
- [ ] Confirm empty Pages targets all pages and selected ranges such as `1,3,5-7` are validated.
- [ ] Confirm start number, format, position, margins, and font size validation works.
- [ ] Confirm `pdf_page_numbers` writes a new PDF and loading, success, and safe error states appear.
- [ ] Confirm Page numbers is additive, is not redaction, and does not remove existing page numbers.
- [ ] Confirm preview, thumbnails, OCR, redaction, and direct PDF text editing remain unimplemented.
- [ ] Confirm Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, and Text watermark remain available.

## v0.7.0 Step 4 Page numbers QA polish

- [ ] Confirm Page numbers appears in the operation selector and its card is the only active center card.
- [ ] Confirm the input PDF summary shows file name, size, page count, PDF version, and protection status.
- [ ] Confirm blank Pages targets all pages and valid selected-page lists and ranges are accepted.
- [ ] Confirm start number, format, position, margins, and font size validation works.
- [ ] Confirm `pdf_page_numbers` writes a new readable PDF with the same page count.
- [ ] Confirm all-page and selected-page output, representative formats, start numbers, and positions.
- [ ] Confirm Page numbers is additive, is not PDF text editing or redaction, and does not remove existing page numbers.
- [ ] Confirm protected PDFs are warned or rejected without decryption or permission bypass.
- [ ] Confirm file summaries and long file names stay inside the compact layout after PDF selection.
- [ ] Confirm preview, thumbnails, OCR, and redaction remain unimplemented.
- [ ] Confirm Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, and Text watermark still execute through their existing flows.

## v0.7.1 Page numbers real PDF QA

- [x] Confirm real-PDF checks cover all-pages and selected-pages output, representative start number / format / position cases, readable output, and unchanged page count.
- [x] Confirm the compact layout does not overflow after PDF selection, including long file names; native-dialog visual confirmation remains a manual desktop check where unavailable.
- [x] Confirm Page numbers remains additive and is not redaction, and existing page numbers are not removed.
- [x] Confirm preview, thumbnails, OCR, redaction, and direct PDF text editing remain unimplemented.
- [x] Confirm existing Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, and Text watermark operations still execute through their existing tests and flows.

## v0.8.0 Step 1 Image watermark and stamp planning

- [ ] Confirm `Docs/PdfImageWatermarkStampPlan.md` exists.
- [ ] Confirm image watermarks and stamps are described as additive content, not direct PDF text editing.
- [ ] Confirm visual masks are explicitly not safe redaction.
- [ ] Confirm OCR, redaction, direct PDF text editing, and image/stamp processing remain unimplemented.
- [ ] Confirm Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, Text watermark, and Page numbers still work.
