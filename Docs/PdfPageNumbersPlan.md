# PDF Page Numbers Foundation Plan

## 1. Purpose

This document defines the v0.7.0 PDF page numbers foundation before any Rust, bridge, UI, or PDF-processing implementation begins. Page numbers are treated as additive text drawn over existing pages. They do not edit or replace existing PDF text, remove existing page numbers, or provide redaction.

The plan records the feature boundary, numbering semantics, format and positioning choices, expected Rust / `lopdf` risks, safety requirements, staged implementation path, and QA expectations.

## 2. Current PDF Workbench status

The PDF Workbench currently provides local PDF inspection and Merge, Split, Extract, Rotate, Delete, Reorder, and Text watermark operations. It includes file summaries, operation-plan guidance, protected-PDF warnings, compact one-active-operation navigation, and containment fixes for long file names and summaries.

Text watermark can add printable ASCII / Latin text to all or selected pages in a new PDF. PDF rendering, real page preview, thumbnails, OCR, redaction, direct PDF text editing, encrypted-PDF decryption, permission bypass, and password handling are not implemented. Processing remains local and no Python sidecar is used.

## 3. Page numbers goals

- Add a visible page number to every page or a validated selection of pages.
- Allow numbering to start from a custom integer.
- Provide a small, explicit set of display formats.
- Provide six predictable page-edge positions with configurable margins.
- Provide a bounded font-size control.
- Show the target pages, numbering sequence, format, position, and output destination before execution.
- Save the result as a new PDF without overwriting the source by default.
- Keep the operation local and compatible with the existing protected-PDF boundary.

Page numbers and Text watermark both add new content streams, but they serve different purposes. Text watermark repeats the same user-supplied text on each target page and may use opacity or rotation. Page numbers generate page-specific text from a numbering sequence, may need the total page count, and are anchored near page edges using margins. Reusing carefully isolated watermark helpers may be possible, but Page numbers must not be implemented as a simple repeated watermark string.

## 4. Non-goals

The foundation does not include:

- direct editing of existing PDF text;
- replacement of existing PDF text;
- detection, removal, replacement, or renumbering of existing page numbers;
- editing text inside image-only PDFs;
- OCR;
- safe redaction or visual masking presented as redaction;
- encrypted-PDF decryption, permission bypass, or password input;
- PDF.js or PDFium preview;
- real PDF rendering or page thumbnails;
- drag-and-drop page reorder;
- advanced typesetting, automatic collision avoidance, or content reflow;
- image watermark, stamp UI, or general-purpose overlay writing;
- Japanese or other international font embedding in the first implementation stage.

Safe redaction is a separate safety-critical research area. It must remove the underlying text, images, annotations, metadata, hidden content, and relevant residual objects. Adding a page number does none of this and must never be described as redaction.

## 5. Feature design

### Operation model

The operation accepts one unprotected input PDF, a target-page mode, numbering settings, placement settings, and a new output PDF destination. The source remains unchanged.

| Setting | Foundation behavior |
| --- | --- |
| Target pages | All pages, or an explicit validated selection such as `1,3,5-7` |
| Start number | Integer used for the first target page; default `1` |
| Prefix | Optional printable ASCII / Latin text placed before the number |
| Suffix | Optional printable ASCII / Latin text placed after the number |
| Format | One of the documented presets, with a constrained custom prefix/suffix form |
| Position | Bottom center, bottom right, bottom left, top center, top right, or top left |
| Margin X / Y | Bounded distances from the chosen page-box edges |
| Font size | Bounded positive value with a safe default |
| Opacity / color | Future extension; not required for the first core |
| Output | A new `.pdf` file; source overwrite is rejected by default |

### Target and sequence semantics

- Page references are 1-based physical input-page indexes.
- Target pages are normalized into document order after validation unless a later explicit product decision introduces custom target order.
- The first target receives `start number`; every subsequent target increments by one.
- Non-target pages receive no new page-number content and do not consume a sequence number.
- The UI and operation plan must distinguish the physical input-page index from the displayed number.
- Duplicate, reversed, zero, negative, non-numeric, empty, and out-of-range selections must be rejected or explained before execution.

For example, selected physical pages `2,5,7` with a start number of `10` would display `10`, `11`, and `12` on those pages. The plan must not imply that the displayed number is always the same as the physical input-page index.

## 6. Page number formats

Candidate presets are:

- `1`
- `Page 1`
- `Page 1 of 10`
- `1 / 10`
- `- 1 -`
- custom prefix and suffix around the generated number

### Total-page semantics

Formats containing a total require an explicit definition:

- With **all pages**, the total is the input document page count.
- With **selected pages**, the safe MVP definition is the number of selected target pages. The UI must label this as the selected-set total so it is not confused with the document page count.
- A future option could use the full document page count for selected-page numbering, but it must be an explicit setting rather than an implicit change.
- The total is a count, not the last displayed number. A start number of `10` across three target pages still has a selected-set total of `3`.

The operation plan should show sample output before execution, such as `Page 10 of 3` when that exact selected-set rule is chosen. Because that wording can look surprising, the first implementation may limit total-based formats to all-pages mode until the selected-page UX is proven clear.

### Prefix, suffix, and start number

- Prefix and suffix are escaped and encoded as PDF text, never interpreted as PDF operators or markup.
- The initial character set should follow the proven printable ASCII / Latin boundary until font embedding is designed.
- Start number must be a bounded integer. Negative and zero starts should be rejected in the first MVP unless a later product requirement justifies them.
- Sequence overflow, excessively long prefix/suffix values, and output strings wider than the available margin area must produce validation or a clear warning.

## 7. Positioning model

The foundation supports six anchor positions:

- bottom center;
- bottom right;
- bottom left;
- top center;
- top right;
- top left.

Horizontal placement is derived from the selected left, center, or right anchor plus margin X. Vertical placement is derived from the top or bottom anchor plus margin Y. Center and right placement require measuring the generated text width with the selected font and size.

Implementation must account for:

- different page sizes within one document;
- `MediaBox` and `CropBox`, including inherited boxes;
- non-zero box origins;
- existing page rotation and the difference between PDF coordinates and the viewer-visible orientation;
- insufficient margins or text extending outside the visible crop area;
- overlap with headers, footers, existing page numbers, or other page content;
- the absence of real preview, which makes placement confirmation harder.

The first core should use one documented visible-box rule consistently, preferably the effective `CropBox` when present and the effective `MediaBox` otherwise. Rotated pages require explicit coordinate transforms and real-file tests at 0, 90, 180, and 270 degrees. It must not silently assume every page begins at `(0, 0)` or uses portrait A4 dimensions.

Without rendering, the operation plan should show page size, effective box, rotation, anchor, margins, font size, and sample text. This is guidance, not a visual preview.

## 8. Implementation approach

No implementation is included in this planning step. A future Rust / `lopdf` implementation should proceed conservatively:

1. Load and validate one unprotected PDF through the existing local boundary.
2. Resolve target page dictionaries, inherited page boxes, rotation, and resource dictionaries.
3. Determine the displayed number and formatted text independently for each target page.
4. Create collision-safe font/resource names without overwriting inherited or page-local resources.
5. Calculate text width and anchor coordinates for the effective visible box.
6. Append a small, isolated content stream to each target page without replacing existing streams.
7. Preserve page count, document structure, and non-target page content.
8. Save to a different output path and reopen the output for structural validation.

The existing Text watermark core may provide reusable patterns for protected-PDF rejection, page selection, content-stream appending, resource handling, output-path validation, and local execution. The key difference is that watermark text is usually constant, while Page numbers generates different text for every target page and may depend on target count, document count, start number, and measured text width.

The first implementation should avoid Japanese font embedding and advanced styling. International text requires font-file validation, embedding and subsetting rules, encoding decisions, licensing awareness, output-size limits, and cross-viewer testing.

## 9. Safety principles

- Page numbers are additive.
- They do not modify existing text content.
- They do not remove hidden content.
- They are not redaction.
- They do not remove or replace existing page numbers.
- Existing content may remain extractable beneath or near the added number.
- Protected PDFs are not decrypted or bypassed.
- No permission restriction is removed or circumvented.
- Original files are not overwritten by default.
- Output should be written as a new PDF.
- Full local paths and document content must not be exposed in user-facing errors or logs.
- Input, target pages, sequence settings, placement settings, and output destination should be visible before execution.

## 10. Risks

- **Coordinate systems:** Page rotation, non-zero origins, and mixed page boxes can place text incorrectly.
- **Mixed page sizes:** A single coordinate assumption can move numbers off-page or into content.
- **Text width:** Center and right alignment require reliable width calculation for the selected font.
- **Resource collisions:** Font or graphics-state names can conflict with inherited resources.
- **Content order:** Appended streams may render above existing content but can interact with clipping paths, graphics state, or malformed PDFs.
- **Existing page numbers:** The operation does not detect or remove them, so duplicate visible numbering can occur.
- **No real preview:** Users cannot visually confirm exact placement before output; the operation plan must be explicit and output must be easy to discard.
- **Selected-page totals:** `of N` can be ambiguous when only some pages are targeted.
- **Start-number mismatch:** Displayed numbers can differ from physical page indexes and must be clearly labeled.
- **Fonts and encoding:** Built-in font assumptions limit scripts and glyph coverage; unsupported text must fail clearly.
- **Malformed or protected PDFs:** Inputs may fail parsing or reject modification and must be handled safely without bypass attempts.
- **Viewer differences:** Content-stream and font behavior must be checked in multiple viewers where practical.
- **Large documents:** Per-page stream creation and validation require bounded memory and execution behavior.

## 11. Recommended staged path

1. **Step 1 - Foundation planning:** Define formats, target semantics, start number, placement, risks, safety boundaries, and QA. This document completes that planning step only.
2. **Step 2 - Page numbers core / bridge:** Add a narrow all-pages ASCII / Latin core with one format and one position, writing to a new PDF. Do not add UI in the same step.
3. **Step 3 - Page numbers UI:** Connect the validated core to PDF Workbench with input summary, output selection, operation plan, loading, success, and safe error states.
4. **Step 4 - Selected pages and start number polish:** Add validated selection semantics, displayed-sequence explanation, and boundary tests.
5. **Step 5 - Format variations:** Add total-aware presets and constrained prefix/suffix handling after total semantics are proven clear.
6. **Step 6 - Positioning and margin polish:** Add all six anchors, bounded margins, mixed page-size handling, and rotated-page QA.
7. **Step 7 - Preview research:** Re-evaluate real rendering only after output behavior is stable; do not present operation-plan guidance as real preview.
8. **Step 8 - Font embedding / international text research:** Evaluate safe embedding, encoding, subsetting, licensing, file-size, and viewer compatibility before adding Japanese text.

Each stage requires focused unit tests where practical and real, non-sensitive PDF checks before the next stage. Core, UI, format expansion, rendering, and international fonts should not be bundled into one release step.

## 12. QA checklist

- [ ] Confirm this plan exists before Rust, bridge, UI, or PDF-processing changes begin.
- [ ] Confirm Page numbers is described as additive content, not direct PDF text editing.
- [ ] Confirm Page numbers is never described as redaction.
- [ ] Confirm existing page numbers are not claimed to be detected, removed, or replaced.
- [ ] Confirm the source remains unchanged and output is written to a new PDF by default.
- [ ] Confirm protected PDFs are rejected without decryption, permission bypass, or password handling.
- [ ] Confirm all-pages and selected-pages numbering semantics are documented and 1-based.
- [ ] Confirm start number, prefix, suffix, format, position, margins, and font size have bounded validation plans.
- [ ] Confirm total-based formats distinguish document total from selected-set total.
- [ ] Confirm effective `CropBox` / `MediaBox`, mixed sizes, non-zero origins, and rotation risks are covered.
- [ ] Confirm unsupported Japanese or international text fails clearly until font embedding is explicitly supported.
- [ ] Confirm operation-plan guidance is not described as real PDF rendering or preview.
- [ ] Confirm PDF rendering, thumbnails, drag-and-drop reorder, OCR, redaction, and direct PDF text editing remain unimplemented.
- [ ] Confirm Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, and Text watermark continue to work.

## 13. Next implementation step

**v0.7.0 Step 2 - Page numbers core / bridge**

Step 2 adds the additive `pdf_page_numbers` Rust / `lopdf` core and shared execution bridge for all or selected pages, validated formats and positions, start number, margins, font size, and new-file output. It does not edit existing PDF text or remove existing page numbers; UI, preview, OCR, redaction, and direct text editing are not added. Placement uses each page's effective CropBox / MediaBox, while viewer-facing rotation polish remains a later QA step.

**v0.7.0 Step 3 - Page numbers UI connection**

Step 3 connects `pdf_page_numbers` to PDF Workbench with input summary, all-page or selected-page targeting, numbering settings, operation plan, output selection, loading, success, and safe error feedback. Page numbers remains additive and writes a new PDF; preview, thumbnails, existing page-number removal, OCR, redaction, and direct text editing are still not added.

**v0.7.0 Step 4 - Page numbers UI QA polish**

Step 4 polishes Page numbers validation and operation-plan QA. Page numbers remains additive and does not add preview, thumbnails, existing page-number removal, OCR, redaction, or direct text editing.
