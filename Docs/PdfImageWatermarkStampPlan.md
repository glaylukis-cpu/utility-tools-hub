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

## 13. v0.8.0 Step 2 - Image format research and core feasibility

Step 2 reviews the existing implementation and dependency graph without changing Rust, the bridge, UI, PDF processing, or dependencies. Its purpose is to choose a narrow first image core and make the next implementation contract testable.

### Existing rendering approach review

The existing `add_text_watermark` implementation provides these reusable patterns:

- validate a `.pdf` output, reject source overwrite, load through the common unprotected-PDF boundary, and validate all or selected pages;
- add one shared Type 1 font and one shared ExtGState object to the document;
- materialize inherited `Resources`, `MediaBox`, `CropBox`, and `Rotate` values before changing a page;
- clone resolved page resources into a page-local dictionary and install unique `Font` and `ExtGState` names;
- calculate placement from the effective CropBox, falling back to MediaBox;
- append an isolated `q / gs / BT / Tm / Tj / ET / Q` content stream with `Document::add_page_contents`; and
- save a new PDF without deleting or replacing existing page content.

The existing `add_page_numbers` implementation reuses the same input/output and page validation, sorts selected pages into document order, generates different text for each target page, installs a shared font under a collision-safe page resource name, calculates six edge positions from margins, and appends a separate content stream per page. Its existing comment also records that viewer-facing rotation placement still needs later polish.

`src-tauri/src/lib.rs` supplies a useful bridge pattern: a registered tool ID, an input struct with `deny_unknown_fields`, an empty options object, a validated internal request, a `spawn_blocking` handler, a narrow core call, safe string errors, and serializable result metadata. A future image request can follow this pattern, but image validation belongs in the Rust core rather than in JSON parsing alone.

There is no application helper that creates or installs an Image XObject. The existing font and ExtGState helpers can be generalized carefully, but the image stream, `XObject` resource dictionary, `Do` operation, image validation, and shared-object lifetime are new work.

### Current dependency findings

The active `src-tauri/Cargo.toml` configuration uses `lopdf 0.34` with `default-features = false` and only `nom_parser`. It has no direct `image`, `png`, JPEG decoder, WebP decoder, SVG rasterizer, or `flate2` dependency.

The lockfile contains `png` through Tauri build/code-generation dependencies and `flate2` through `lopdf`, but transitive crates are not stable, directly usable application dependencies. Their presence in `Cargo.lock` must not be treated as an approved image-decoding API.

`lopdf 0.34` has an optional `embed_image` feature that enables its optional `image 0.25` dependency. That feature is currently disabled. Enabling it would change `Cargo.toml` features and the resolved dependency graph, so it requires a separate dependency review even though the direct package name would remain `lopdf`.

The local `lopdf` source contains:

- `xobject::image` / `image_from` behind `embed_image`;
- JPEG passthrough using an Image XObject with `DCTDecode`;
- decoded non-JPEG byte compression into an Image XObject;
- `Document::add_xobject` and `Document::insert_image`; and
- general `Stream` construction and Flate compression.

These helpers do not remove the need for product-side validation. In particular, the reviewed `image_from` path does not construct a separate PDF soft-mask (`SMask`) for alpha data, so it is not sufficient evidence for correct transparent-PNG support. The reviewed `insert_image` helper creates a new image object per call and rewrites decoded page content; calling it once per page would not meet the desired shared-image-object and append-only design. A first core should instead add one validated image stream, reference that same object from each target page under a unique `XObject` name, and append a small isolated drawing stream.

### Format comparison

| Format | Current active decode support | PDF embedding path | Transparency | Initial decision |
| --- | --- | --- | --- | --- |
| JPEG / JPG | No direct decoder; strict metadata parsing is still required | Preserve validated bytes and use `DCTDecode` | None | Recommended first format |
| PNG without alpha | No direct decoder | Parse PNG, use decoded samples or carefully mapped IDAT/`FlateDecode` predictor data | None | Defer until a decoder/dependency decision |
| PNG with alpha | No direct decoder | Decode color and alpha, create main image plus grayscale `SMask` | Yes | Defer; do not claim through the current lopdf helper |
| WebP | No direct decoder | Decode to samples and re-encode/compress for PDF | Possible after decode | Exclude from initial support |
| SVG | No rasterizer or constrained SVG renderer | Rasterize or translate a broad vector specification | Specification-dependent | Exclude from initial support |

### PNG findings

PNG is the most natural long-term watermark format because logos and seals commonly use transparent backgrounds. It also has a well-defined signature and IHDR fields for dimensions, bit depth, color type, compression, filter, and interlace mode.

PNG bytes cannot be embedded wholesale as a PDF Image XObject. A narrow non-alpha implementation could theoretically accept only non-interlaced 8-bit grayscale or RGB PNG, concatenate validated IDAT data, and use `FlateDecode` with correct PNG predictor parameters. That still requires robust chunk-length, CRC, color-type, palette, bit-depth, interlace, decompression-limit, and malformed-input handling. It must not rely only on IHDR or the filename extension.

Transparent PNG is substantially harder. The color samples and alpha channel must be decoded and separated so the PDF main image can reference a grayscale soft-mask image through `SMask`. The existing Text watermark opacity ExtGState controls whole-object opacity; it does not replace per-pixel alpha. Palette transparency and 16-bit data further expand the cases.

The existing direct dependencies do not provide an approved PNG decoder. `lopdf::Stream::compress` can Flate-compress raw samples after decoding, but it does not decode the source PNG for the application. Enabling `lopdf/embed_image` or adding a maintained `png`/`image` dependency is possible only in a separate approved task. Because the reviewed lopdf image helper does not establish correct `SMask` handling, Step 3 should not start with transparent PNG. A hand-written general PNG decoder is not recommended.

### JPEG findings

JPEG is the smallest credible first format. After validating the file structure, dimensions, and supported color model, the original JPEG stream can be stored in an Image XObject with `Filter /DCTDecode`, avoiding pixel decode, re-encoding, and a large raw image buffer. JPEG has no alpha channel, which removes `SMask` from the first core.

Width and height can be read by scanning validated JPEG markers until a supported Start of Frame segment. This is technically possible without an additional crate, but it is still parser work: segment lengths, truncation, marker stuffing, supported SOF variants, maximum dimensions, component count, and overflow must be checked. A maintained parser/decoder dependency would reduce custom parsing risk but would change the dependency graph. The next task must choose explicitly between a small strict metadata parser and a reviewed dependency; it must not infer dimensions from JFIF DPI or the filename.

The first core should accept only clearly identified grayscale and three-component JPEG data that maps to `DeviceGray` or `DeviceRGB`. CMYK, YCCK, ambiguous Adobe transforms, unusual component layouts, and unsupported SOF forms should be rejected until viewer compatibility is proven. EXIF orientation is not automatically applied by a raw `DCTDecode` stream, so orientation must be documented as ignored/rejected or handled explicitly later.

JPEG is less natural for a transparent logo watermark because the rectangular background remains. Whole-image opacity can still make it useful for faint photographs, scanned seals with a matching background, and stamp-like marks. It is enough to prove the shared Image XObject, placement, opacity, bridge, validation, and output-safety architecture before PNG alpha expands the scope.

### WebP and SVG findings

WebP remains excluded because PDF has no equivalent common direct WebP image filter. It would need decoding and conversion, format-specific limits, and additional dependency coverage. Existing lockfile entries whose names contain `webpki` relate to Web PKI certificates, not WebP image decoding.

SVG remains excluded because it is a broad vector document and rendering specification rather than a raster byte stream. Safe support would need a constrained parser/rasterizer, external-resource and font policy, sizing rules, filter/mask behavior, and dependency review. Silently rasterizing SVG is outside the first image watermark core.

### Image XObject, opacity, and placement design

The recommended core should create one Image XObject with at least `Type /XObject`, `Subtype /Image`, validated `Width`, `Height`, `ColorSpace`, `BitsPerComponent`, and the selected filter. It should add that object once, then install a unique reference in each target page's page-local `Resources /XObject` dictionary. It must not overwrite an inherited or existing resource name.

Each target page should receive an appended content stream using `q`, optional `gs`, `cm`, `Do`, and `Q`. The six-value `cm` matrix must combine PDF-point width/height, rotation around a documented pivot, and translation from the effective CropBox/MediaBox origin. A shared ExtGState can provide bounded whole-image non-stroking opacity (`ca`); `CA` may be set consistently but does not provide per-pixel transparency.

Main risks include:

- multiplying output size by creating one image stream per page;
- using a shared resource dictionary in a way that changes unrelated pages;
- resource-name collisions or indirect resource dictionaries;
- wrong matrix order, rotation pivot, CropBox/MediaBox origin, or viewer-facing page rotation;
- clipping from excessive width/height or margins;
- mutually conflicting width, height, and scale options;
- low effective resolution after scaling, or unreasonable pixel-count memory limits;
- JPEG color-space mismatches and ignored EXIF orientation;
- treating ExtGState opacity as PNG alpha; and
- the absence of real preview or thumbnails, which makes placement an operation-plan estimate until the output is opened.

### Provisional core and bridge API

The following is a design candidate, not an implemented or final contract:

```rust
pub struct PdfImageWatermarkResult {
    pub input_path: String,
    pub output_path: String,
    pub image_path: String,
    pub pages: Vec<usize>,
    pub page_count: usize,
    pub position: String,
}

pub struct PdfImageWatermarkOptions {
    pub pages: Option<Vec<usize>>,
    pub position: Option<String>,
    pub width: Option<f32>,
    pub height: Option<f32>,
    pub scale: Option<f32>,
    pub margin_x: Option<f32>,
    pub margin_y: Option<f32>,
    pub opacity: Option<f32>,
    pub rotation_degrees: Option<f32>,
}

pub fn add_image_watermark(
    input_path: PathBuf,
    output_path: PathBuf,
    image_path: PathBuf,
    options: PdfImageWatermarkOptions,
) -> Result<PdfImageWatermarkResult, PdfToolError>;
```

Provisional tool ID: `pdf_image_watermark`.

```json
{
  "tool_id": "pdf_image_watermark",
  "input": {
    "input_path": "input.pdf",
    "output_path": "watermarked.pdf",
    "image_path": "logo.jpg",
    "pages": [1, 2, 3],
    "position": "center",
    "width": 180,
    "margin_x": 36,
    "margin_y": 36,
    "opacity": 0.25,
    "rotation_degrees": 0
  },
  "options": {}
}
```

Before implementation, the first contract should be trimmed to only supported behavior. In particular, Step 3 should prefer fixed `width` with preserved aspect ratio and a `center` default. `width`, `height`, and `scale` must be mutually exclusive if more than one mode is eventually accepted. Unsupported position or sizing fields must be rejected rather than silently ignored. New `PdfToolError` variants should distinguish missing/unsupported image input, malformed image data, unsupported color model, unreasonable dimensions, invalid position, invalid size, invalid margin, invalid opacity, and invalid rotation without exposing sensitive paths.

### Initial implementation candidate comparison

| Candidate | Difficulty | Dependency risk | User value | PDF compatibility / QA | Reuse and failure scope |
| --- | --- | --- | --- | --- | --- |
| A. JPEG-only image stamp core | Low to medium | Low only with a strict custom metadata parser; otherwise reviewed dependency needed | Moderate | Narrowest matrix; `DCTDecode` is widely supported | High reuse of page selection, resources, ExtGState, and placement; small failure scope |
| B. PNG-only non-alpha image watermark core | Medium to high | Medium; a safe PNG decoder is preferable | Moderate, but transparent-logo expectations are unmet | Predictor, color-type, bit-depth, and interlace cases expand QA | Reuses placement but adds container/decode risk |
| C. PNG with alpha from the start | High | High | High for logos and seals | Requires decoded color data plus correct `SMask` across viewers | Large new surface and misleading transparency claims if incomplete |
| D. PNG and JPEG together | Very high | High | Broad | Combines both format and QA matrices before architecture is proven | Largest first-step failure scope |
| E. Text stamp first | Low | None | Useful, but does not validate image architecture | Existing text path is already understood | Highest code reuse but postpones the requested image foundation |

Candidate A is the safest technical base, but the next product slice should expose it through the proposed `pdf_image_watermark` core rather than introduce final Image stamp semantics prematurely. The narrow Step 3 recommendation is therefore a **JPEG-only Image watermark core / bridge with stamp-compatible placement foundations**: grayscale/RGB JPEG only, all or selected pages, one shared Image XObject, center placement, fixed width with preserved aspect ratio, bounded whole-image opacity and rotation, new-PDF output, protected-input rejection, and no UI. Additional position presets may be included only if rotated and mixed-box fixtures prove the matrix calculations.

PNG support should follow in a separately approved step after choosing a maintained decoding strategy and defining real `SMask` behavior. Text stamp remains a later low-risk feature, not a substitute for proving image embedding.

### Step 2 safety and non-goals

- Image watermark and Image stamp remain additive operations.
- They are not direct PDF text editing and are not redaction.
- A visual mask is not safe redaction.
- Existing images, text, and page numbers are not removed or replaced.
- Protected PDFs are rejected without decryption, permission bypass, or password handling.
- The source PDF is not overwritten; output is a new PDF.
- Without PDF preview or thumbnails, pre-execution placement confirmation remains limited.
- Step 2 adds no image implementation, Rust/bridge/UI change, dependency, rendering, OCR, redaction, or version change.

## 14. v0.8.0 Step 3 - JPEG-only Image watermark core / bridge

Step 3 adds the additive `pdf_image_watermark` Rust core and shared execution bridge for validated baseline grayscale/RGB JPEG watermarks, using one shared `DCTDecode` Image XObject across all or selected pages. UI, PNG alpha, WebP, SVG, Image stamp UI, preview, OCR, redaction, and direct PDF text editing are not added yet.

## 15. v0.8.0 Step 4 - JPEG Image watermark UI connection

Step 4 connects JPEG-only Image watermark to the compact PDF Workbench UI with input PDF, JPEG image, target pages, width, opacity, rotation, center placement, output, validation, operation plan, and result feedback. PNG alpha, WebP, SVG, preview, OCR, redaction, direct PDF text editing, Image stamp UI, and Text stamp UI remain unimplemented.

## 16. v0.8.0 Step 5 - JPEG Image watermark QA

Step 5 validates the JPEG-only Image watermark UI and real all-pages / selected-pages PDF output. PNG alpha, WebP, SVG, preview, OCR, redaction, direct PDF text editing, Image stamp UI, and Text stamp UI are not added.

## 17. v0.8.1 - Installer, updater, and installed-app QA

v0.8.1 focuses on installer, updater, and installed-app QA for JPEG Image watermark. No PNG alpha, WebP, SVG, preview, OCR, redaction, direct text editing, Image stamp UI, or Text stamp UI is added.

## 18. v0.9.0 Step 1 - Text stamp foundation planning

`Docs/PdfTextStampPlan.md` separates the planned position-focused Text stamp from the still-unimplemented Image stamp. Both remain additive operations, but v0.9.0 Step 1 adds design documentation only and no stamp processing or UI.

## 19. v0.11.0 Step 1 - JPEG-only Image stamp foundation planning

v0.11.0 Step 1 plans Image stamp foundation. Image stamp is additive visual styling for placing JPEG stamp-like images on all or selected PDF pages. It does not edit or remove existing PDF content, is not redaction, and is not a digital signature. This step adds design documentation only: no Rust core, bridge, UI, PDF processing, dependency, or version change is included.

### Goal and Image watermark boundary

Image stamp is intended for placing a logo, confirmation mark, approval mark, `COPY` / `PAID` mark, or company-seal-like image at a deliberate page position. It targets all pages or an explicit page selection and plans bounded width, opacity, rotation, and margins. It places the image itself; image padding and any future border/background treatment are separate styling concerns.

| Category | Image watermark | Image stamp |
| --- | --- | --- |
| Primary use | A faint document-wide `DRAFT` mark or logo | A visible logo, seal, status mark, or confirmation mark |
| Placement | Center placement is the established default | Presets such as top-right, bottom-right, and center are important |
| Typical opacity | Low opacity is common | Full opacity (`1.0`) is a natural option |
| Visual intent | Broad watermarking across the document | Precise stamp, seal, or logo placement |
| Content semantics | Additive visual styling | Additive visual styling |

Both operations preserve the underlying page content. Placing an opaque watermark or stamp over content does not remove that content and is not safe redaction. Neither operation edits, deletes, or replaces images already stored in the PDF.

The existing JPEG-only Image watermark implementation is the technical reference for strict JPEG parsing, `DCTDecode` Image XObjects, page resource updates, graphics-state opacity, rotation, selected-page handling, protected-input rejection, and new-PDF output. Whether those internals should be extracted into shared helpers is an implementation-step decision; Step 1 does not refactor the existing core.

### Initial request candidate

The proposed initial contract is intentionally JPEG-only and position-oriented:

| Field | Initial meaning |
| --- | --- |
| `input_path` | Existing unprotected source PDF |
| `output_path` | A separate new PDF; source overwrite is rejected |
| `image_path` | Baseline grayscale or RGB JPEG/JPG stamp image |
| `pages` | Empty/omitted for all pages, otherwise validated selected pages |
| `position` | `center`, `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, or `bottom-right` |
| `margin_x` / `margin_y` | Bounded offsets from the selected position anchor |
| `width` | Display width in PDF points; height is derived from the image aspect ratio |
| `opacity` | Bounded whole-image opacity, including `1.0` |
| `rotation_degrees` | Bounded rotation applied around the planned stamp placement |

The provisional tool ID is `pdf_image_stamp`. A later bridge step should continue through `execute_tool` -> `ToolRegistry` -> `JobManager`; it should not add a direct Tauri command. The implementation contract must reject unsupported or silently ignored fields and preserve the existing request/result error-safety conventions.

### Image format policy

The first implementation candidate accepts only validated baseline grayscale and three-component RGB JPEG/JPG. JPEG can reuse the established `DCTDecode` embedding approach without re-compressing image pixels, and its lack of alpha avoids introducing `SMask` into the first Image stamp slice.

PNG is attractive for transparent seals and logos, but alpha requires explicit decode, color-type, bit-depth, predictor, and `SMask` handling. PNG and alpha support therefore require a separate research and implementation step. SVG needs a rendering or conversion path, and WebP is not a direct PDF image-stream fit; both remain outside the initial scope.

The initial scope also defers custom RGB conversion, CMYK/YCCK JPEG, complete EXIF orientation handling, progressive or otherwise unsupported JPEG variants, and any format accepted only by file extension. The existing strict JPEG parser/embedding policy is the safest starting point.

### Placement and bounding box policy

- Position, margins, width, and rotation define the planned placement.
- Display height is calculated from the validated JPEG aspect ratio; stretching width and height independently is not planned.
- Page-fit validation uses the image bounding box, including the rotated bounding box when rotation is non-zero.
- CropBox / MediaBox selection and coordinate handling should follow the existing PDF tools policy and be verified with portrait, landscape, mixed-box, and non-zero-origin fixtures.
- A stamp that extends outside the usable page box must produce a clear rejection or pre-execution warning; the implementation step must choose and test one consistent rule.
- Complete compensation for existing page rotation is deferred until representative fixtures prove the coordinate model.
- Without real PDF rendering, placement can only be described by settings and an operation plan. Users must open the generated PDF to confirm collisions with existing content.
- Preview, thumbnails, and drag positioning may improve later UX, but are not prerequisites for the JPEG-only foundation.

### Safety copy

- Image stamp is additive visual styling.
- It does not edit existing PDF text.
- It does not remove existing PDF content.
- It does not remove existing images.
- It does not remove existing page numbers.
- It does not remove existing watermarks.
- It is not redaction.
- Placing an image over content is not safe redaction.
- Hidden text, images, and metadata remain unless a real redaction process removes them.
- `APPROVED`, `REVIEWED`, `PAID`, seal-like, and signature-like images are not digital signatures, identity verification, or audit trails.
- Protected PDFs are rejected; they are not decrypted and their permission restrictions are not bypassed.
- Original PDFs are not overwritten by default; output is written to a new PDF.

### Recommended staged path

1. **Image stamp design:** Complete this JPEG-only contract, safety boundary, non-goals, and QA plan without implementation.
2. **JPEG-only Image stamp core / bridge:** Add the narrow Rust/lopdf core and `pdf_image_stamp` shared execution route, reusing proven Image watermark concepts where appropriate.
3. **Image stamp UI connection:** Add bounded PDF/JPEG/output selection, pages, position, margins, width, opacity, rotation, validation, and operation-plan controls.
4. **Image stamp QA / real PDF check:** Verify all/selected pages, every supported position, rotation bounds, mixed boxes, source preservation, multiple viewers, and regression behavior.
5. **Version bump / release:** Update versions and release documentation only after implementation and QA are complete.
6. **PNG alpha research:** Evaluate a reviewed decoder, supported color types, `SMask`, resource limits, output size, and viewer compatibility as a separate scope.
7. **PDF preview / thumbnails research:** Evaluate local rendering only after output generation is stable.
8. **Drag positioning research:** Consider pointer-based placement only after a reliable preview coordinate model exists.
9. **Safe redaction research:** Keep real content removal as an independent safety-critical feature with extraction and object-level verification.

### Non-goals for Step 1 and the initial JPEG slice

- safe redaction or describing a visual mask as redaction;
- direct editing or replacement of existing PDF text;
- deleting or replacing existing PDF images;
- deleting existing page numbers or watermarks;
- OCR;
- PDF.js / PDFium rendering, preview, or thumbnails;
- arbitrary `x` / `y`, drag positioning, preview-based placement, cropping, or resize UI;
- PNG alpha, `SMask`, SVG, WebP, or custom image decoding;
- an Image stamp library or multiple Image stamps per page;
- digital signatures, identity verification, or audit trails;
- decrypting protected PDFs, bypassing permission restrictions, or adding password input; or
- Rust, React, CSS, PDF-processing, dependency, version, updater, or release changes in this design step.

## 20. v0.11.0 Step 2 - JPEG-only Image stamp core / bridge

v0.11.0 Step 2 adds the JPEG-only `pdf_image_stamp` core / bridge. Image stamp can place baseline grayscale/RGB JPEG stamp-like images on all or selected pages with preset position, margins, width with preserved aspect ratio, opacity, and rotation; UI, PNG alpha, preview, OCR, redaction, direct text editing, digital signatures, and audit trails are not added yet.

## 21. v0.11.0 Step 3 - Image stamp UI connection

PDF Workbench now connects the existing `pdf_image_stamp` route with PDF/JPEG/output selection, optional pages, seven position presets, bounded margins, width, opacity, rotation, an operation plan, and local result feedback. The operation remains additive and writes a new PDF; PNG alpha, preview, thumbnails, drag positioning, OCR, redaction, direct PDF text editing, digital signatures, and audit trails remain unimplemented.

## 22. v0.11.0 Step 4 - Image stamp QA polish

v0.11.0 Step 4 verifies Image stamp UI, validation, operation plan, compact layout, and real all-page / selected-page PDF output. Image stamp remains additive visual styling and is not redaction or a digital signature; PNG alpha, preview, OCR, redaction, and direct PDF text editing remain unimplemented.
