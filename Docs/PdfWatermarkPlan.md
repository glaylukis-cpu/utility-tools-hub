# PDF Watermark Foundation Plan

## 1. Purpose

This document defines the v0.6.0 PDF watermark foundation before any Rust, UI, or PDF-processing implementation begins. It separates additive watermark and stamp features from direct PDF text editing and safety-critical redaction, records the expected risks of a staged Rust / `lopdf` implementation, and proposes an order that can be tested with real, non-sensitive PDF files.

## 2. Current PDF Workbench status

The PDF Workbench currently provides local PDF inspection plus Merge, Split, Extract, Rotate, Delete, and Reorder page operations. File summaries, Merge multi-file summaries, operation-plan previews, protected-PDF warnings, and the “Delete pages is not redaction” boundary are already available. PDF rendering, page thumbnails, and drag-and-drop reorder are not implemented. Processing stays on this device and no Python sidecar is used.

## 3. Watermark goals

- Add new visible drawing elements over existing PDF pages without replacing existing page content.
- Support a narrow text-watermark MVP before image or general-purpose overlay features.
- Preserve page count and existing page content while writing the result to a new PDF.
- Make target pages, placement, opacity, rotation, and output destination explicit before processing.
- Reject protected or unsupported inputs without attempting decryption or permission bypass.
- Keep the core, command bridge, UI, operation plan, and real-file QA as separate implementation steps.

## 4. Non-goals

The watermark foundation does not provide or imply:

- direct editing of existing PDF text;
- replacement of existing PDF text;
- OCR or editing text inside image-only PDFs;
- safe redaction or removal of underlying text, images, annotations, or metadata;
- encrypted PDF decryption, permission bypass, or password input;
- PDF.js or PDFium preview;
- real PDF rendering or page thumbnails;
- drag-and-drop reorder;
- repair of malformed PDFs; or
- guaranteed preservation of every advanced PDF feature without real-file compatibility testing.

## 5. Feature categories

### Text watermark

Examples include `DRAFT`, `CONFIDENTIAL`, and `SAMPLE`. A text watermark places low-emphasis text over every page or selected pages. It is normally larger and more repetitive than a stamp, and may use opacity and rotation to remain visible without hiding the document.

### Image watermark

An image watermark places a logo or other raster image over a page. It requires safe image loading, format validation, embedding, color-space handling, scaling, compression, transparency handling, and resource management. It should follow the text-watermark MVP rather than share its first implementation step.

### Text stamp

Examples include `Approved`, `Reviewed`, and `Paid`. A text stamp is generally smaller than a watermark and depends more strongly on precise positioning. Stamp placement must account for page boxes, page rotation, margins, and differing page sizes.

### Overlay writing

Overlay writing adds new text or vector shapes over an existing page. It does not edit the existing PDF text objects and must not be described as direct PDF text editing. General overlay writing is broader than a predefined watermark or stamp and therefore requires a separate design and QA phase.

### Visual mask

A visual mask only covers content visually. The covered text, image, annotation, metadata, or other underlying object may remain extractable or recoverable. A visual mask is not redaction and must never be presented as safe removal of sensitive information.

## 6. Implementation approach

An eventual Rust / `lopdf` implementation should remain additive and non-destructive:

1. Load and validate an unprotected input PDF using the existing local PDF boundary.
2. Resolve the target page dictionaries, inherited page boxes, page rotation, and resource dictionaries.
3. Create new drawing commands inside a balanced graphics-state scope (`q` / `Q`).
4. Add uniquely named font or graphics-state resources without overwriting existing resource names.
5. Append a new content stream so the watermark is drawn over existing content.
6. Preserve unrelated page objects and write a complete new output PDF instead of overwriting the source.
7. Reopen and inspect the output, then perform real-file visual QA in a PDF viewer.

The first core should use a deliberately narrow text and placement contract. Japanese text must not be promised until font embedding, glyph coverage, Type 0 / CID font behavior, subsetting, licensing, and output portability have been validated. Image embedding and general overlay primitives should remain separate research items.

## 7. Safety principles

- Watermark is additive.
- It does not modify existing text content.
- It does not remove hidden content.
- It is not redaction.
- A visual mask is not safe redaction.
- Protected PDFs are not decrypted or bypassed.
- Original files are not overwritten by default.
- Output should be written as a new PDF.
- Input, target pages, operation settings, and output destination should be visible before execution.
- Errors and logs must avoid exposing full local paths or sensitive document content.

Safe redaction is a separate, safety-critical research area. It requires removing underlying text, images, annotations, metadata, hidden content, and relevant residual objects, followed by extraction and object-level verification. No such behavior is included in this foundation.

## 8. Risks

- **Fonts and Japanese text:** Built-in Latin fonts do not provide reliable Japanese glyph coverage. Embedded and subset fonts introduce licensing, mapping, size, extraction, and portability risks.
- **Opacity:** Transparency requires compatible graphics-state resources. Incorrect state handling can affect later page content or render differently across viewers and printers.
- **Coordinates:** PDF coordinates originate from the page coordinate system, which may differ from screen coordinates. CropBox, MediaBox, non-zero origins, and mixed page sizes must be handled.
- **Rotation:** Existing page rotation and watermark rotation can combine unexpectedly. Placement must be tested at 0, 90, 180, and 270 degrees.
- **Resource collisions:** Font, image, and ExtGState names can collide with inherited or page-local resources unless unique names and inheritance are handled safely.
- **Content-stream order:** Appending a stream normally draws above existing content, but transparency groups, clipping, optional content, annotations, and unusual page structures can affect the result.
- **Image embedding:** Image formats, alpha channels, color spaces, DPI, compression, memory use, and malformed input increase the scope beyond text watermarking.
- **Compatibility:** Rewriting a PDF can affect signatures, forms, annotations, incremental updates, object streams, and viewer compatibility even when page content appears simple.
- **Protected inputs:** Encryption or permission restrictions must result in rejection, not an attempt to decrypt or bypass controls.
- **Misleading security:** A dark watermark, stamp, or rectangle can look like content removal while leaving the original information accessible.

## 9. Recommended staged path

1. **Text watermark core:** Fixed Latin test text, a safe placement preset, all-page application, new output file, and protected-input rejection.
2. **Text watermark UI:** Input and output selection, text field, operation-plan summary, loading/result states, and explicit safety wording.
3. **Stamp positioning:** A limited set of positions such as top-left, top-right, center, bottom-left, and bottom-right.
4. **Page selection:** All pages or validated explicit ranges, using existing page-selection conventions where appropriate.
5. **Style controls:** Bounded opacity, rotation, and font-size controls with safe defaults and range validation.
6. **Image watermark research:** Supported image formats, validation, embedding, scaling, transparency, and resource limits.
7. **Overlay writing research:** Constrained text and shape primitives with an explicit “not text editing / not redaction” boundary.
8. **Real preview backend selection:** Re-evaluate PDF.js, PDFium, OS viewer, or another rendering approach only after the output pipeline is stable.

Each stage should have its own completion condition, unit tests where practical, and real-file QA before the next stage begins. Image watermark, general overlay writing, and real rendering should not be bundled into the first text-watermark implementation.

## 10. QA checklist

- [ ] Confirm the plan describes watermarking as additive overlay content, not direct text editing.
- [ ] Confirm a visual mask is never described as safe redaction.
- [ ] Confirm protected PDFs are rejected without decryption, permission bypass, or password handling.
- [ ] Confirm the source file remains unchanged and output is written to a new PDF.
- [ ] Confirm page count and existing content remain intact after adding a watermark.
- [ ] Test portrait, landscape, mixed-size, rotated, CropBox, and non-zero-origin pages.
- [ ] Test opacity, placement, rotation, and font-size boundaries without leaking graphics state into existing content.
- [ ] Confirm resource names do not overwrite inherited or page-local font and graphics-state resources.
- [ ] Confirm unsupported Japanese text or fonts fail clearly until font embedding is explicitly supported.
- [ ] Reopen output in more than one PDF viewer and verify printing or export where practical.
- [ ] Confirm text extraction still exposes original underlying content, demonstrating why watermarking is not redaction.
- [ ] Run Inspect, Merge, Split, Extract, Rotate, Delete, and Reorder regression checks.
- [ ] Confirm OCR, redaction, direct PDF text editing, rendering, thumbnails, and drag-and-drop reorder remain unavailable.

## 11. Next implementation step

**v0.6.0 Step 2 - Text watermark core proposal**

In a separate implementation task, define a narrow Rust request/result contract and test fixtures for an all-pages Latin text watermark with a fixed placement preset. The core should reject protected PDFs, avoid source overwrite, write a new PDF, reopen the output for structural checks, and add no UI or real rendering. Japanese font embedding, image watermarking, stamps, arbitrary overlay writing, opacity and rotation controls, and page selection should remain later steps until their risks have dedicated tests.

### v0.6.0 Step 2 - Text watermark core / bridge

Step 2 adds the additive `pdf_text_watermark` Rust core and shared execution bridge without editing existing PDF text. UI, image watermark, stamps, preview, OCR, redaction, and direct text editing are not added yet.

### v0.6.0 Step 3 - Text watermark UI connection

Step 3 connects `pdf_text_watermark` to the PDF Workbench UI so printable ASCII / Latin text can be added to all or selected pages in a new PDF. Image watermark, stamps, real preview, OCR, redaction, and direct text editing are still not added.

### v0.6.0 Step 4 - Text watermark QA polish

Step 4 polishes Text watermark validation and QA checks. Text watermark remains additive; image watermark, stamps, preview, OCR, redaction, and direct text editing are still not added.

### v0.8.0 Step 1 - Image watermark and stamp planning

`Docs/PdfImageWatermarkStampPlan.md` now defines design-only image watermark, image stamp, and text stamp categories, format and placement candidates, implementation risks, safety boundaries, staged delivery, and QA. No image or stamp processing, UI, dependency, preview, OCR, redaction, or direct PDF text editing is added in this step.

### v0.8.0 Step 2 - Image format research

Image watermark and stamp remain in format-research and core-feasibility planning. JPEG is the recommended narrow first core; PNG transparency and dependency choices require later dedicated work, and no image processing is implemented in Step 2.

### v0.8.0 Step 3 - JPEG-only Image watermark core / bridge

The additive JPEG-only Image watermark core / bridge supports validated baseline grayscale/RGB JPEG input and shared Image XObject output. UI, PNG and other image formats, stamps, preview, OCR, redaction, and direct PDF text editing remain unimplemented.

### v0.8.0 Step 4 - JPEG Image watermark UI connection

PDF Workbench now connects to the JPEG-only Image watermark core with bounded settings, an additive operation plan, and new-PDF result feedback. PNG alpha and other image formats, stamps, preview, OCR, redaction, and direct PDF text editing remain unimplemented.

### v0.9.0 Step 1 - Text stamp foundation planning

`Docs/PdfTextStampPlan.md` defines the planned short-text stamp model, precise placement, limited styling, additive/not-redaction safety boundary, and staged implementation. Text stamp processing and UI remain unimplemented.

### v0.9.0 Step 2 - Text stamp core / bridge

The additive `pdf_text_stamp` core and shared bridge support validated short ASCII / Latin-1 text with preset placement and limited styling. Text stamp UI, border/background, preview, OCR, redaction, and direct PDF text editing remain unimplemented.

### v0.9.0 Step 3 - Text stamp UI connection

PDF Workbench now connects to `pdf_text_stamp` with input summary, all-page or selected-page targeting, bounded stamp settings, limited color presets, operation plan, and local new-PDF feedback. Text stamp is additive; border/background, preview, thumbnails, OCR, redaction, direct text editing, and existing-content removal remain unimplemented.

### v0.10.0 Step 1 - Text stamp border/background planning

Text stamp border/background remains in the planning stage. It is defined as additive visual styling rather than redaction; no fill/stroke processing, UI, preview, OCR, direct text editing, or existing-content removal is implemented in this step.

### v0.10.0 Step 2 - Text stamp border/background core / bridge

The existing `pdf_text_stamp` core / bridge now accepts optional rectangle border and background fill styling with bounded opacity, limited colors, and padding. The styling is additive and not redaction; UI, preview, OCR, and direct text editing remain unimplemented.

### v0.10.0 Step 3 - Text stamp border/background UI connection

PDF Workbench now connects the existing Text stamp border/background fields with compact controls, visible validation, plan details, and not-redaction guidance. Preview, OCR, redaction, and direct PDF text editing remain unimplemented.

### v0.11.0 Step 1 - Image stamp foundation planning

Image stamp is in the design stage as JPEG-only additive visual styling with position-oriented placement. It remains separate from the existing JPEG Image watermark workflow; no Image stamp processing, UI, preview, OCR, redaction, or direct PDF text editing is added yet.

### v0.11.0 Step 2 - JPEG-only Image stamp core / bridge

The additive `pdf_image_stamp` core / bridge now places validated baseline grayscale/RGB JPEG images using preset position, margins, width, opacity, and rotation. Image stamp UI, PNG alpha, preview, OCR, redaction, direct PDF text editing, digital signatures, and audit trails remain unimplemented.
