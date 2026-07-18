# PDF Tools QA Checklist

## v0.3.3 QA / UX polish

Use local, non-sensitive test PDFs with known page counts and visible page numbers. Keep the source files unchanged so each operation can be repeated. Record only file names and page counts in QA notes; do not copy private local paths.

## v0.3.4 Merge bugfix QA

- [ ] Recheck the two real PDFs that exposed the v0.3.3 Merge failure, even though each input opens on its own.
- [ ] Repeat the merge with an output PDF directly under the Desktop folder.
- [ ] Confirm a successful output opens, has the combined page count, and preserves input order.
- [ ] If the merge fails, confirm the UI distinguishes unreadable or unsupported input, encryption, an input/output conflict, and an unwritable output without exposing full paths.

## Merge PDFs

- [ ] Select two or more PDF files.
- [ ] Confirm the numbered list matches the intended merge order.
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
