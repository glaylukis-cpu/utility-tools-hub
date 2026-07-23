# PDF Image Watermark and Stamp Plan

## 1. Purpose

This document defines v0.8.0 Step 1 for image watermark, image stamp, and text stamp research. It is a design-only step: no Rust core, command bridge, UI, PDF processing, dependency, preview, or release change is included.

The plan distinguishes several additive overlay categories, records a deliberately narrow image-format policy, defines placement and sizing candidates, and preserves the PDF Workbench safety boundary. The immediate goal is to make a later implementation task small enough to validate with real, non-sensitive PDFs without implying direct PDF text editing or safe redaction.

## 2. Current PDF Workbench status

The PDF Workbench currently supports local Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, Text watermark, and Page numbers workflows. Text watermark was implemented in v0.6.0. Page numbers was implemented in v0.7.0 and demonstrates page-varying additive text. The compact Workbench UI, input summaries, operation-plan guidance, protected-PDF rejection, new-PDF output, validation, and real-file QA patterns are already available.

The current Rust PDF path uses `lopdf` without a dedicated raster-image decoding dependency. Text watermark and Page numbers provide useful patterns for page selection, inherited page geometry, unique resource names, appended content streams, balanced graphics state, source/output conflict checks, protected-input rejection, output reopening, and bridge validation. Image work is harder because it must also validate and interpret raster bytes, construct image XObjects, select PDF filters and color spaces, handle optional transparency, preserve aspect ratio, and avoid multiplying the same image data for every target page.

Real PDF page rendering, thumbnails, PDF.js/PDFium preview, OCR, safe redaction, and direct editing of existing PDF text remain unimplemented.

## 3. Feature goals

- Add a validated raster image as visible content over all pages or selected pages.
- Separate a faint, broadly placed image watermark from a precisely positioned image stamp.
- Define a later text stamp as a compact, position-focused counterpart to the existing Text watermark.
- Preserve page count and existing page content while writing a complete new PDF.
- Reuse the established page-selection, validation, execution-bridge, protected-input, and output-safety patterns where they fit.
- Define explicit and bounded controls for position, size, opacity, rotation, margins, and target pages.
- Preserve image aspect ratio by default and make clipping or excessive size a validation concern.
- Reuse one embedded image resource across target pages where PDF resource structure permits it.
- Keep format support narrow and evidence-based, with real-file compatibility and output-size QA before expanding it.
- State clearly that every feature in this plan is additive and provides neither direct PDF text editing nor safe redaction.

## 4. Non-goals

v0.8.0 Step 1 does not implement or promise:

- direct editing or replacement of existing PDF text;
- removal or replacement of existing images;
- removal or replacement of existing page numbers;
- OCR or editing text inside image-only PDFs;
- safe redaction or removal of underlying text, images, annotations, metadata, hidden content, or residual objects;
- describing a visual mask as redaction;
- PDF decryption, permission bypass, or a password-entry UI;
- PDF.js or PDFium preview;
- real PDF rendering or page thumbnails;
- drag-and-drop page reorder;
- editing text inside an image PDF;
- advanced layout, flowing text, templates, or desktop-publishing behavior;
- Japanese font embedding;
- SVG or WebP input in the initial implementation;
- arbitrary annotation editing, signature workflows, or approval audit trails; or
- changes to Rust, the Tauri bridge, React, CSS, dependencies, version metadata, or release artifacts in this planning step.

## 5. Feature categories

### Image watermark

An image watermark adds a faint logo or other raster image over all pages or selected pages. Its main controls are opacity, size, position, rotation, and target pages. Typical defaults should favor a centered, low-opacity image that remains visible without pretending to secure or remove underlying content.

### Image stamp

An image stamp adds a seal, approval mark, signature-like mark, or `Reviewed` badge at a specified position. Position and physical size are more important than for a general watermark. A stamp may normally use higher opacity and a corner or custom anchor, but it remains an additive visual mark rather than proof of identity, a cryptographic signature, or an approval audit record.

### Text stamp

A text stamp adds short text such as `Approved`, `Reviewed`, or `Paid`. It is normally smaller and more position-focused than a Text watermark. It can reuse some existing text-writing concepts, but should have a separate request contract and UI semantics so watermark defaults do not become stamp defaults.

### Text watermark

Text watermark, implemented in v0.6.0, adds text such as `DRAFT` or `CONFIDENTIAL` over all pages or selected pages. It is generally larger, fainter, and more repetitive than a text stamp. It is additive and does not edit existing PDF text.

### Page numbers

Page numbers, implemented in v0.7.0, adds page-varying text using the selected format, start number, position, margins, size, and target pages. It is a useful precedent for per-page content generation, but it does not remove or replace numbers already present in the source PDF.

### Overlay writing

Overlay writing is the broader concept of adding new text or vector shapes over an existing page. It may eventually provide constrained labels, lines, rectangles, or similar primitives. It is not direct editing of existing PDF text and should remain a separate research area after narrow watermark and stamp operations are stable.

### Visual mask

A visual mask places an opaque shape or image over content. It only hides that content visually; the underlying text, image, annotation, metadata, or other object may remain extractable or recoverable. A visual mask is not redaction and must never be described or offered as safe redaction.

## 6. Image format policy

### Initial candidates

- **PNG:** A strong product candidate because logos and seals commonly need transparency. PNG decoding can involve multiple color types, bit depths, scanline filters, palettes, and alpha data. PDF transparency may require a separate soft-mask image XObject, so accepting PNG safely is not equivalent to copying its bytes into a PDF stream.
- **JPEG / JPG:** A strong first-core candidate because compatible JPEG data may be embedded with PDF `DCTDecode` without re-encoding. JPEG has no alpha channel, and validation still needs pixel dimensions, component/color-space handling, malformed-file limits, and compatibility testing.

The first implementation may intentionally support only one of PNG or JPEG/JPG if that creates a smaller, testable core. The selected format must be documented in the UI and validated by file content rather than filename extension alone.

### Deferred formats

WebP and SVG are deferred and unimplemented. WebP would add decode and conversion questions. SVG is vector content with external-resource, font, script, sizing, and rendering concerns; it must not be treated as a simple raster-image alias. Format conversion should not be silently introduced as part of the first core.

### Dimensions, points, and DPI

Raster dimensions are measured in pixels, while PDF placement is measured in points (72 points per inch) in a page coordinate system. Embedded DPI metadata is optional and frequently inconsistent, so the implementation must not blindly treat DPI as authoritative physical size. Explicit output width or height in PDF points should determine placement. Pixel dimensions remain important for aspect ratio, memory limits, and effective print resolution.

An “original size” option is risky because it requires a trustworthy physical-size interpretation that many images do not provide. If ever offered, it needs a documented DPI fallback and clear bounds. It should not be part of the first implementation.

### Reuse, compression, and output size

The same source image should normally be embedded once and referenced from each target page, rather than duplicated once per page. The implementation must verify that page-local or inherited resource dictionaries can reference a shared image XObject safely without name collisions.

JPEG passthrough may preserve compact DCT compression. PNG may need decoded and recompressed pixel data plus a separate alpha mask, which can increase CPU, memory, and output size. The core should define limits for input bytes and pixel count, reject malformed or unreasonable dimensions, and measure output growth across one-page and many-page fixtures.

This planning step adds no dependency. Before implementation, a format spike must determine whether the existing dependency graph can safely validate and embed the chosen format. If a decoder or parser dependency is required, it must be proposed and reviewed in a separate task with package size, security, licensing, maintenance, and Tauri build impact recorded. “No new dependency” is a scope constraint, not a reason to implement an unsafe ad-hoc decoder.

## 7. Placement and sizing model

### Position presets

The candidate position set is:

- center;
- top-left, top-center, and top-right;
- bottom-left, bottom-center, and bottom-right; and
- custom `x` / `y` coordinates.

Preset positions should resolve against a documented effective page box, with CropBox preferred when present and MediaBox used as the fallback. Margins should move the image inward from the selected box edge. Custom coordinates should use a clearly documented page-space origin and units; a later UI must not imply screen-pixel coordinates.

### Sizing modes

- **Fixed width:** Set width in PDF points and calculate height from the image aspect ratio.
- **Fixed height:** Set height in PDF points and calculate width from the image aspect ratio.
- **Scale percentage:** Scale relative to a clearly named reference, preferably the effective page width or a validated base size. An undefined “percentage” is not sufficient.
- **Fit page:** Fit inside the effective page box minus margins while keeping aspect ratio; never stretch independently in both axes by default.
- **Original size:** Deferred because image DPI and physical size are unreliable.

Aspect ratio should be preserved by default. Any future stretch mode would need an explicit name and separate validation.

### Shared controls

- opacity, with bounded numeric input and a safe default;
- rotation in degrees, with a documented pivot, preferably the placed image center;
- horizontal and vertical margins;
- all pages or validated selected pages;
- width, height, or scale according to the selected sizing mode; and
- an explicit keep-aspect-ratio rule.

Image watermark defaults should favor lower opacity and broader placement. Image stamp defaults should favor precise position and predictable fixed size. Text stamp should use compact text-oriented defaults rather than inheriting image sizing controls.

### Geometry risks

- mixed page sizes can make one fixed size appropriate on one page and excessive on another;
- CropBox and MediaBox may differ or have non-zero origins;
- rotated pages require a documented mapping between visual positions and raw PDF coordinates;
- insufficient margins can place content against or outside the visible box;
- existing headers, footers, signatures, or page numbers can be overlapped;
- without a real preview, placement is harder to judge before output;
- an image that is too large can clip or cover most of a page; and
- transparency and blend behavior can differ across PDF viewers, printers, and older compatibility levels.

The first core should prefer a small set of presets and bounded dimensions over unrestricted coordinates. Custom `x` / `y` should follow only after the coordinate contract and mixed-page tests are stable.

## 8. Implementation approach

The implementation should remain staged and additive.

1. Validate that input PDF and output path use the existing safe boundary: supported unprotected PDF, no source overwrite, and a new output PDF.
2. Validate image bytes, supported format, byte length, pixel dimensions, color model, and any alpha data before editing the PDF.
3. Resolve the target pages, selected-page syntax, inherited CropBox/MediaBox, non-zero origins, and page rotation using established PDF utilities where possible.
4. Convert the validated raster data into one PDF image XObject, with an appropriate color space, bits per component, filter, and optional soft mask.
5. Add a uniquely named XObject resource without overwriting inherited or page-local resources, and reuse the same image object for every target page.
6. Calculate a per-page transform matrix from the selected anchor, sizing mode, margins, rotation, and effective page geometry.
7. Append a short content stream using balanced graphics state (`q` / `Q`), optional ExtGState opacity, the transform matrix, and the image draw operation.
8. Preserve unrelated page content and objects, write a complete new PDF, reopen it, and verify page count and basic structure.
9. Return safe result metadata through a narrow bridge contract without exposing full local paths or document content.
10. Perform real-file visual checks in more than one PDF viewer and compare output size before connecting a full UI.

Reusable Text watermark and Page numbers patterns include target-page parsing, bounded option validation, page geometry lookup, graphics-state isolation, unique resource naming, appended streams, protected-PDF rejection, output conflict checks, output reopening, result metadata, bridge execution, and fixture-based tests.

Image embedding remains materially harder. Raster parsing, color-space mapping, compression filters, transparency soft masks, image-object reuse, effective resolution, malformed-image defense, memory use, and output-size behavior require dedicated research and tests. The image core should not be implemented by merely expanding the existing text request.

## 9. Safety principles

- Image watermarks and stamps are additive.
- Text stamps are additive.
- Existing text content is not modified or replaced.
- Existing images and page numbers are not removed or replaced.
- Hidden or underlying content is not removed.
- Watermarks and stamps are not redaction.
- A visual mask is not safe redaction.
- Protected PDFs are not decrypted or bypassed.
- No password-entry UI is added by this plan.
- Original files are not overwritten by default.
- Output is written as a new PDF.
- Input, image or text source, target pages, placement, size, opacity, rotation, and output destination should be visible before execution.
- File validation and error messages must avoid exposing full local paths or sensitive document content.
- A seal, approval image, or `Approved` text stamp must not be described as a cryptographic signature or independently verified approval.

Safe redaction remains a separate safety-critical research area. It requires removal of underlying and residual data followed by extraction and object-level verification. No image, rectangle, watermark, or stamp in this plan provides that behavior.

## 10. Risks

- **Image parsing:** Malformed, truncated, oversized, or adversarial raster data can cause excessive memory use or incorrect dimensions.
- **PNG complexity:** Palette, grayscale, RGB, alpha, bit depth, interlacing, filters, and soft-mask generation broaden the implementation and test matrix.
- **JPEG compatibility:** Component count, color interpretation, CMYK/YCCK behavior, orientation metadata, and unusual encodings may render differently across viewers.
- **Transparency:** Alpha and opacity may require separate resources and can behave differently during printing, flattening, or export.
- **Coordinates and boxes:** MediaBox, CropBox, non-zero origins, mixed page sizes, and rotated pages can shift presets or custom positions.
- **Sizing:** Large physical dimensions may clip or obscure content; small pixel dimensions may look blurred when printed.
- **No preview:** Operation-plan text cannot show collisions with existing content, making real-file output review essential.
- **Resource inheritance:** Adding XObject or ExtGState entries incorrectly can overwrite or disconnect inherited resources.
- **File growth:** Duplicating image streams per page or recompressing poorly can make output unreasonably large.
- **Compatibility:** Rewriting may affect signatures, forms, annotations, optional content, object streams, incremental updates, or viewer behavior.
- **Security wording:** Users may mistake a stamp for verified approval or a visual mask for removed information.
- **Protected PDFs:** Encryption or permission restrictions must result in rejection, never decryption or bypass.
- **Font scope:** A future Text stamp may inherit the existing printable ASCII limitation; Japanese font embedding is not implicitly solved by image support.
- **Dependency pressure:** Supporting formats safely may require a maintained decoder, but dependency selection has packaging, licensing, security, and update costs.

## 11. Recommended staged path

1. **v0.8.0 Step 1 - Design (current):** Define categories, format policy, placement model, safety boundary, risks, stages, and QA without code or dependency changes.
2. **Format research:** Build disposable test evidence for PNG and JPEG/JPG validation and PDF embedding; select one narrow initial format and document whether a dependency proposal is necessary.
3. **Image watermark core / bridge:** Add one supported format, one safe sizing mode, a small preset set, all or selected pages, opacity, new-PDF output, protected-input rejection, and structural tests.
4. **Image watermark UI:** Add image/PDF/output selection, bounded controls, operation-plan wording, loading/result states, and explicit additive/not-redaction guidance.
5. **Image stamp positioning polish:** Add stamp-oriented defaults, fixed physical size, additional corner presets, mixed-page handling, rotation QA, and only then consider custom `x` / `y`.
6. **Text stamp core / bridge:** Add a separate compact additive text contract using the proven text path, initially within existing font limits.
7. **Text stamp UI:** Add short-text validation, position and size controls, operation plan, and clear separation from Text watermark.
8. **Real PDF QA:** Test representative PNG/JPEG samples as supported, portrait/landscape/mixed-size/rotated pages, CropBox/MediaBox cases, transparency, printing, multiple viewers, page count, and output growth.
9. **Preview research:** Re-evaluate PDF.js, PDFium, an OS viewer, or another local rendering approach only after output generation is stable; do not make preview a hidden prerequisite of the first core.
10. **Overlay writing research:** Define constrained additive text/shape primitives and repeat the direct-text-editing/not-redaction boundary before any broad overlay implementation.

Each step needs its own completion conditions and should preserve existing PDF operations. PNG and JPEG/JPG support should not be bundled merely to make the first release appear broader.

## 12. QA checklist

### Planning and safety

- [ ] Confirm this design document exists and no Rust, bridge, UI, dependency, version, or release file changed in Step 1.
- [ ] Confirm Image watermark, Image stamp, and Text stamp are described as additive content.
- [ ] Confirm none of these features is described as direct editing of existing PDF text.
- [ ] Confirm a visual mask is explicitly not safe redaction.
- [ ] Confirm existing images and page numbers are not claimed to be removed or replaced.
- [ ] Confirm OCR, safe redaction, direct PDF text editing, password UI, rendering, thumbnails, and drag-and-drop reorder remain unimplemented.

### Image validation and embedding

- [ ] Verify each implemented format by file signature and parsed structure, not extension alone.
- [ ] Reject unsupported, malformed, truncated, oversized, and unreasonable-dimension images safely.
- [ ] Test portrait, landscape, square, low-resolution, and high-resolution source images.
- [ ] For PNG support, test opaque, transparent, palette, grayscale, and representative bit-depth cases within the declared contract.
- [ ] For JPEG/JPG support, test RGB and every other explicitly supported color model; reject unsupported variants clearly.
- [ ] Confirm pixel dimensions determine aspect ratio and explicit PDF-point size determines placement.
- [ ] Confirm DPI metadata is not blindly trusted.
- [ ] Confirm the image is embedded once and reused across target pages where intended.
- [ ] Compare output size for one, ten, and many target pages to detect accidental image duplication.

### Placement and output

- [ ] Test center, every implemented corner/edge preset, margins, opacity, rotation, and size boundaries.
- [ ] Test all pages and selected pages using the established page-selection conventions.
- [ ] Test portrait, landscape, mixed-size, 0/90/180/270-degree rotated, CropBox, MediaBox, and non-zero-origin pages.
- [ ] Confirm fixed-width, fixed-height, scale, or fit behavior exactly matches the implemented contract and preserves aspect ratio.
- [ ] Confirm excessive size, insufficient margins, clipping risk, and invalid custom coordinates are rejected or clearly warned.
- [ ] Confirm output opens in more than one viewer, keeps the source page count, and retains existing page content.
- [ ] Confirm alpha and opacity render acceptably on screen and in print/export where supported.
- [ ] Confirm the source remains unchanged and output is a new PDF.
- [ ] Confirm protected PDFs are rejected without decryption, permission bypass, or password handling.

### Regression

- [ ] Confirm Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, Text watermark, and Page numbers continue to work.
- [ ] Confirm Text watermark remains the v0.6.0 additive text feature.
- [ ] Confirm Page numbers remains the v0.7.0 page-varying additive text feature and existing numbers are not removed.
- [ ] Run `git diff --check`, the frontend build, Rust formatting check, Rust check, and Rust tests.

## 13. Next implementation step

**v0.8.0 Step 2 - Image format research spike**

In a separate task, create a bounded, non-product research spike that compares PNG and JPEG/JPG against the current Rust / `lopdf` dependency graph. The spike should determine the smallest safe initial format, prove image XObject creation and reuse on representative non-sensitive fixtures, measure output size, document transparency and color-space limits, and state whether a maintained decoding dependency is required. It should not add Workbench UI, Text stamp, custom coordinates, SVG/WebP, preview, OCR, redaction, or direct PDF text editing.
