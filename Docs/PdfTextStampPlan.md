# PDF Text Stamp Foundation Plan

## 1. Purpose

This document defines v0.9.0 Step 1 for a future PDF Text stamp foundation. It is a design, research, and roadmap step only: it adds no Rust core, command bridge, React UI, CSS, PDF processing, dependency, preview, or version change.

A Text stamp is a narrow additive operation that places short text such as `APPROVED`, `REVIEWED`, `PAID`, `VOID`, or `COPY` at a deliberate position on existing PDF pages. It must not be presented as direct editing of existing PDF text, removal of content, a cryptographic approval, or safe redaction.

## 2. Current PDF Workbench status

PDF Workbench currently provides local Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, Text watermark, Page numbers, JPEG-only Image watermark, and Text stamp operations. Text stamp now connects the Step 2 `pdf_text_stamp` core / bridge to the compact Workbench UI.

The current additive text implementations provide useful references for page selection, protected-PDF rejection, new-PDF output, resource handling, opacity, rotation, operation-plan wording, validation, and result feedback. They do not solve stamp-specific anchoring, text rectangles, borders, backgrounds, padding, or compact high-opacity styling.

Real PDF page rendering, preview, thumbnails, drag-and-drop reorder, OCR, safe redaction, direct PDF text editing, Image stamp UI, Text stamp border/background styling, and general Overlay writing remain unimplemented. PDF processing stays local and uses no Python sidecar.

## 3. Feature goals

- Add a short text element over all pages or selected pages without changing existing page content.
- Support stamp-oriented position presets, margins, font size, opacity, rotation, and a small color policy.
- Keep the first request and UI narrower than a general annotation or desktop-publishing system.
- Reuse proven Text watermark and Page numbers patterns where their safety and geometry assumptions apply.
- Keep output deterministic, write a new PDF, and preserve the source by default.
- Reject protected PDFs without decryption, password handling, or permission bypass.
- Make the additive, not-text-editing, and not-redaction boundary visible in Docs, operation plans, UI copy, and QA.
- Define later border, background, preview, and Overlay writing work without promising them in the first implementation.

## 4. Non-goals

v0.9.0 Step 1 does not implement or promise:

- direct editing or replacement of existing PDF text;
- removal of existing images, page numbers, watermarks, hidden content, annotations, metadata, or residual objects;
- OCR or editing text inside scanned/image PDFs;
- safe redaction or describing a visual mask as redaction;
- decryption of encrypted PDFs, permission bypass, password handling, or password input UI;
- PDF.js or PDFium rendering, real preview, thumbnails, or drag-and-drop reorder;
- Text stamp core, bridge, UI, or any PDF-processing change;
- Image stamp or general Overlay writing implementation;
- Japanese font embedding, arbitrary font embedding, arbitrary font selection, or full Unicode shaping;
- multi-line layout, automatic wrapping, advanced typography, or long-form PDF annotations;
- signatures, identity verification, approval audit records, or tamper-evident certification;
- source-file overwrite by default;
- npm, Cargo, or Python-sidecar dependencies.

## 5. Feature categories

### Text stamp

Text stamp adds short text such as `APPROVED`, `REVIEWED`, `PAID`, `VOID`, or `COPY` at a specified position. It is normally smaller and more position-focused than Text watermark and is suited to document review, processing, status, or approval-like labels. Typical presets include top right, bottom right, and center, but a stamp is not a cryptographic signature or verified approval record.

### Text watermark

Text watermark, implemented in v0.6.0, adds broad, usually faint text such as `DRAFT` or `CONFIDENTIAL` across all or selected pages. It is intended to remain visible over a wider page area and uses different defaults from a compact stamp.

### Page numbers

Page numbers, implemented in v0.7.0, add text whose value changes per page. They are an additive text operation with page-specific formatting and edge-oriented placement, not a replacement for static Text stamp semantics.

### Image watermark

Image watermark, implemented as JPEG-only in v0.8.0, places a validated JPEG/JPG image at the page center with bounded width, opacity, rotation, and page selection. It does not provide stamp-oriented image positions.

### Image stamp

Image stamp would place a seal, logo, or reviewed mark at a deliberate position and size. It remains unimplemented and requires separate image-format, geometry, transparency, and identity-wording decisions.

### Overlay writing

Overlay writing is the broader concept of adding new text or vector shapes over existing pages. It is not direct PDF text editing. General Overlay writing should remain a later research area after narrow stamp operations have stable contracts and QA.

### Visual mask

A visual mask only covers content visually. Underlying text, images, annotations, metadata, and residual objects may remain extractable or recoverable. A visual mask is not redaction and must never be described or offered as safe redaction.

## 6. Text stamp model

### Candidate inputs

| Input | Purpose | Initial direction |
| --- | --- | --- |
| Input PDF | Source document | Required; normal unprotected PDF only |
| Output PDF | New document path | Required; must not equal the input path |
| Stamp text | Short status label | Required; bounded length |
| Target pages | All or selected pages | Empty may mean all pages; explicit selections validated |
| Position | Anchor preset | Required; start with a small preset set |
| Margin X / Y | Distance from the selected edge | Bounded non-negative values |
| Font size | Text size in PDF points | Bounded positive value |
| Opacity | Whole-stamp opacity | Bounded value using a reviewed ExtGState pattern |
| Rotation | Rotation around the stamp center | Bounded, normalized value |
| Color | Text color | Initially black or red; gray may follow |
| Border | Optional stamp rectangle | Deferred until rectangle geometry is proven |
| Background fill | Optional filled rectangle | Deferred and never described as redaction |
| Padding | Space around text | Deferred with border/background |
| Alignment | Text placement inside its rectangle | Deferred unless one fixed alignment is required |

### Initial implementation candidate

The first future implementation should include input PDF, output PDF, short stamp text, all or selected pages, one of a small set of position presets, margin X/Y, font size, opacity, rotation, and a fixed black or red color choice. Border, background fill, padding, custom alignment, and custom coordinates should remain later steps until basic geometry is validated.

### Text constraints

- Begin with the printable ASCII / Latin-1-equivalent scope already understood by the additive text path.
- Japanese font embedding and arbitrary font embedding remain unsupported.
- Treat stamp text as a short label, not a paragraph or annotation body.
- Reject empty, control-character, and overlong input before PDF processing.
- Defer multiple lines, advanced shaping, automatic wrapping, rich text, and complex layout.

## 7. Placement and sizing model

### Position candidates

- center;
- bottom center;
- bottom right;
- bottom left;
- top center;
- top right;
- top left;
- custom X/Y in a later implementation step.

The initial slice should prefer a limited preset set such as center, top right, and bottom right. Each preset needs an explicit anchor definition against the effective page box, not an assumption that every page starts at `(0, 0)` or uses the same dimensions.

### Geometry model

- Font size defines the primary text height.
- A reviewed text-width estimate defines the initial text bounding rectangle.
- Margin X/Y offsets edge presets inward from the effective page box.
- Padding expands the text rectangle only when border or background support is introduced.
- Border and background rectangles must be derived from the same measured bounds as the text.
- Rotation should be applied around the stamp rectangle center rather than the page origin.
- The calculated rotated bounds should remain inside the effective page area or fail validation with a clear warning.
- Mixed page sizes require placement to be calculated independently for every target page.

### Page-box and rotation policy

The implementation must explicitly choose how CropBox and MediaBox define the visible placement area and must preserve non-zero box origins. Existing page rotation must be included in the coordinate model so a top-right stamp remains visually top right after viewing. Custom X/Y should not be added until preset behavior is tested on portrait, landscape, rotated, cropped, and mixed-size documents.

## 8. Styling model

### Initial candidates

- bounded font size;
- bounded opacity;
- bounded rotation;
- limited colors such as black, red, and later gray;
- optional border after core placement is stable;
- optional background fill after border geometry and safety wording are stable.

High-opacity red text may be a useful stamp default, while Text watermark defaults generally remain larger and fainter. Defaults must communicate visual styling only and must not imply verified approval or removal of underlying content.

### Deferred styling

- Japanese font embedding and general Unicode font fallback;
- arbitrary font selection or embedding;
- bold and italic variants unless supported by reviewed embedded/base fonts;
- multiple lines and automatic text wrapping;
- rich-text alignment and advanced typography;
- SVG-like decoration or arbitrary vector artwork;
- shadows, blur, gradients, blend modes, and filters.

## 9. Implementation approach

### Reusable foundations

The future Rust/lopdf core can study the existing Text watermark and Page numbers implementations for input/output validation, protected-PDF rejection, source-overwrite prevention, page selection, page resource updates, content-stream insertion, font resource handling, opacity ExtGState reuse, rotation normalization, shared execution bridge behavior, and structural output tests.

Text stamp still requires separate semantics and tests. Its position is more exact than a broad Text watermark, and its rectangle, center of rotation, margins, color, optional border, background, and padding introduce geometry that Page numbers and Text watermark do not fully cover. A separate request contract and `tool_id` should be considered only in a later approved implementation task; none is added by this plan.

### Future core responsibilities

- Validate paths, extensions, source/output separation, text length, pages, preset, margins, size, opacity, rotation, and color.
- Reject protected PDFs without attempting decryption or permission bypass.
- Resolve each target page's effective box and rotation independently.
- Estimate text bounds using the selected limited font policy.
- Build one reviewed transform for placement and rotation around the stamp center.
- Reuse font and ExtGState resources where safe without replacing inherited resources.
- Append new content streams without modifying or removing existing content.
- Write and reopen a new PDF for structural verification.

No Rust or bridge work is included in v0.9.0 Step 1.

## 10. Safety principles

- Text stamp is additive.
- It does not modify or replace existing text content.
- It does not remove hidden or underlying content.
- It is not redaction.
- A visual mask is not safe redaction.
- It does not remove existing images, page numbers, or watermarks.
- Protected PDFs are not decrypted, bypassed, or handled through password UI.
- Original files are not overwritten by default.
- Output should be written as a new PDF.
- A stamp such as `APPROVED` is not a cryptographic signature, verified identity, or audit trail.
- Safe redaction remains a separate safety-critical research area that must remove underlying and residual data and verify the result.

## 11. Risks

- **Mixed page sizes:** one transform cannot be reused blindly across different page dimensions.
- **CropBox and MediaBox:** visible bounds, non-zero origins, and inherited boxes can change placement.
- **Rotated pages:** page rotation and content transformation can make logical and visual corners differ.
- **Text metrics:** width estimates depend on the chosen font and encoding; inaccurate bounds break centering, border, and background placement.
- **Long text:** an overlong stamp can leave the page even with a valid font size and preset.
- **Rotation:** rotated rectangles need corner-based bounds checks around a defined center.
- **Opacity compatibility:** ExtGState insertion and reuse must work with inherited resources and common viewers.
- **Resource collisions:** font and graphics-state names must not overwrite existing page resources.
- **No preview:** users cannot visually confirm placement before output without rendering or thumbnails.
- **Inherited limitations:** ASCII/Latin text, font metrics, content ordering, and viewer differences from Text watermark or Page numbers may carry forward.
- **Border/background wording:** an opaque fill can be mistaken for redaction even though underlying content remains.
- **Approval semantics:** status words can be mistaken for authenticated approval or legal certification.
- **Protected input:** encrypted or permission-restricted PDFs must continue to fail safely.

## 12. Recommended staged path

1. **v0.9.0 Step 1 - Text stamp design (current):** Define categories, model, placement, styling, safety boundaries, risks, stages, and QA only.
2. **Step 2 - Text stamp core / bridge:** Add a narrow ASCII/Latin contract, preset placement, black or red text, all or selected pages, new-PDF output, and structural tests.
3. **Step 3 - Text stamp UI connection:** Add PDF/output selection, short text, pages, position, margins, font size, opacity, rotation, limited color, operation plan, validation, and feedback.
4. **Step 4 - Text stamp QA / real PDF check:** Validate portrait, landscape, rotated, cropped, mixed-size, all-page, selected-page, long-name, and protected-PDF cases.
5. **Step 5 - Version bump / release:** Perform version and release work only after core, UI, regression, installed-app, and updater QA are separately approved.
6. **Step 6 - Border/background polish:** Add shared text-rectangle geometry, padding, explicit visual-mask warnings, and viewer QA.
7. **Step 7 - Color preset polish:** Expand only to a small reviewed palette with accessibility and print checks.
8. **Step 8 - Preview research:** Evaluate safe page rendering separately; do not couple it to the initial stamp core.
9. **Step 9 - Overlay writing research:** Define constrained text/shape primitives only after narrow stamp behavior is stable.

Each stage should remain independently reviewable and should not combine Text stamp with Image stamp, preview, OCR, redaction, or direct PDF text editing.

## 13. QA checklist

### Planning and categories

- [ ] Confirm Text stamp, Text watermark, Page numbers, Image watermark, Image stamp, Overlay writing, and Visual mask have distinct definitions.
- [ ] Confirm Text stamp examples remain short status labels and do not imply cryptographic approval.
- [ ] Confirm Text stamp is described as additive and not direct PDF text editing.
- [ ] Confirm Text stamp and Visual mask are not described as safe redaction.

### Model and validation

- [ ] Confirm the candidate model covers input/output PDF, text, pages, position, margins, font size, opacity, rotation, and limited color.
- [ ] Confirm border, background, padding, alignment, custom coordinates, multiple lines, and advanced styling are staged separately.
- [ ] Confirm ASCII/Latin-first and short-text constraints are explicit.
- [ ] Confirm source overwrite, protected PDFs, invalid pages, invalid bounds, and overlong text have planned rejection behavior.

### Geometry and styling

- [ ] Confirm placement is defined against reviewed CropBox/MediaBox behavior and non-zero origins.
- [ ] Confirm mixed page sizes and existing page rotation are calculated per page.
- [ ] Confirm rotation is centered on the stamp bounds and rotated bounds stay inside the page.
- [ ] Confirm font-dependent width estimation, borders, backgrounds, and no-preview limitations are documented.

### Safety and regression

- [ ] Confirm no existing text, images, page numbers, watermarks, hidden content, or metadata are described as removed.
- [ ] Confirm OCR, redaction, direct PDF text editing, preview, thumbnails, and password handling remain unimplemented.
- [ ] Confirm protected PDFs are rejected without decryption or permission bypass.
- [ ] Confirm output is a new PDF and the original is preserved by default.
- [ ] Confirm existing Inspect, Merge, Split, Extract, Rotate, Delete, Reorder, Text watermark, Page numbers, and Image watermark operations remain available.

## 14. Next implementation step

The next separately approved task should be v0.9.0 Step 4: Text stamp QA and real-PDF checks across representative page geometry, page selections, styling values, protected input, and compact layouts.

That step should confirm short ASCII/Latin-1 text, all supported presets and colors, all or selected pages, mixed page sizes, rotated and cropped pages, source preservation, protected-input rejection, and desktop layout behavior. It should not include border/background, preview, Image stamp, Overlay writing, OCR, redaction, direct PDF text editing, dependency additions, version changes, or release work unless separately requested.

## 15. v0.9.0 Step 2 - Text stamp core / bridge

Step 2 adds the additive `pdf_text_stamp` Rust core and shared execution bridge for short printable ASCII / Latin-1 text, preset positions, margins, font size, opacity, rotation, and limited color presets. UI, border/background, preview, OCR, redaction, Japanese font embedding, and direct PDF text editing are not added yet.

## 16. v0.9.0 Step 3 - Text stamp UI connection

Step 3 connects `pdf_text_stamp` to the compact PDF Workbench with input and output PDF selection, input summary, short-text and page validation, position, margins, font size, opacity, rotation, black/red/gray color, a lightweight operation plan, and loading/success/error feedback. Empty Pages sends an empty list so the core targets all pages. Text stamp remains additive and is not redaction or direct PDF text editing; border/background styling, real preview, thumbnails, Image stamp, Overlay writing, OCR, and removal of existing text, images, page numbers, or watermarks remain unimplemented.

## 17. v0.9.0 Step 4 - Text stamp QA and real-PDF checks

Step 4 validates all-page and selected-page output with real generated PDFs, representative placement, color, opacity, and rotation, source preservation, validation boundaries, safety copy, and compact layouts. No new PDF processing, dependency, version, release, or direct-editing feature is added.

## 18. v0.10.0 Step 1 - Text stamp border/background foundation planning

v0.10.0 Step 1 plans optional border and background styling for the existing Text stamp operation. It is a design, safety, and staged-delivery step only: no Rust core, bridge, React UI, CSS, request/response, `pdf_text_stamp`, PDF processing, dependency, or version change is added yet.

### Feature goal

- Improve the readability of short stamps such as `APPROVED`, `REVIEWED`, `PAID`, `VOID`, and `COPY`.
- Allow a simple rectangle border and background fill to make a stamp stand out from page content.
- Preserve the existing Text stamp position, margins, font size, text opacity, rotation, color, page selection, and new-PDF output behavior.
- Treat border/background as additive visual styling only. It does not edit, delete, replace, sanitize, or securely hide existing PDF content.
- Keep the boundaries that Text stamp is not redaction, a digital signature, identity verification, or an audit trail.

### Candidate request model

These fields are candidates for a later separately approved request/response change. Step 1 does not add them to the current contract.

| Candidate input | Initial direction | Notes |
| --- | --- | --- |
| `border_enabled` | Boolean on/off | `false` preserves the current text-only output |
| `border_color` | `black`, `red`, or `gray` | Limited presets only |
| `border_width` | `0.5` to `6` pt | Rectangle stroke width; reject non-finite or out-of-range values |
| `border_opacity` | Optional `0.1` to `1.0` | If omitted, inherit text opacity; an explicit value allows later independent control |
| `background_enabled` | Boolean on/off | `false` preserves the current transparent background |
| `background_color` | `white`, `yellow`, `red`, or `gray` | Black is excluded from the initial preset candidate because it is easily mistaken for a visual mask |
| `background_opacity` | `0.1` to `1.0` | Visual coverage only; even `1.0` does not remove underlying content |
| `padding` | One bounded non-negative pt value | Expands the estimated text bounds equally on all sides for the first slice |

The later core/bridge step must define defaults and serialization explicitly, preserve compatibility for callers that do not send styling fields, and reject unknown presets or invalid numeric values. No such contract change occurs in Step 1.

### Border model

The narrow initial candidate is an axis-aligned rectangle derived from the text bounding estimate plus padding, then transformed with the stamp as one unit.

- Support border on/off.
- Use only black, red, and gray presets initially.
- Bound border width to `0.5` through `6` pt.
- Let an omitted border opacity inherit the existing text opacity; allow a later independent `border_opacity` only after ExtGState behavior is tested.
- Draw a rectangle stroke only. The border must not clip, erase, replace, or otherwise alter page content.
- Use the same padding and rectangle geometry as the background so fill, stroke, and text stay aligned.

Rounded corners (`border_radius`) are not an initial candidate because portable PDF path construction, corner geometry, rotated bounds, and viewer QA add disproportionate complexity. Dashed borders, custom RGB colors, shadows, gradients, blend effects, and complex vector styles are also deferred.

### Background fill model

The initial background candidate is a solid rectangular fill behind the stamp text.

- Support background on/off.
- Use only white, yellow, red, and gray presets initially.
- Bound background opacity to `0.1` through `1.0`.
- Estimate text width and height using the same limited font metrics as Text stamp, then expand the rectangle by the shared padding.
- Paint the background fill before the border and text so the border and stamp remain visible above it.
- Keep fill opacity independent from text and stroke graphics state in the implementation design; do not let a graphics-state change leak into existing page content.

An opaque fill or dark-looking rectangle can resemble a black box or visual mask. It only covers content visually: underlying text, images, annotations, metadata, and residual PDF objects remain in the document and may remain searchable, selectable, extractable, or recoverable. Background fill must never be named or marketed as redaction or safe redaction.

### Placement and bounding-box model

- Preserve the existing Text stamp position presets, margin X/Y, font size, rotation, page selection, and per-page placement behavior.
- Use the reviewed text-width estimate as the inner bounds and add padding to obtain the shared fill/stroke rectangle.
- Account for stroke width when checking the outer bounds; a thick border must not extend past an otherwise valid rectangle unnoticed.
- Rotate background, border, and text around the same stamp-rectangle center with one reviewed transform.
- Calculate geometry per target page and respect non-zero page-box origins.
- Prefer the effective CropBox when defined and fall back to MediaBox according to one documented policy.
- Reject output geometry that clearly leaves the effective page box, or return a precise warning in a later UI step; silent clipping is not acceptable.
- Treat complete correction for inherited/existing page rotation as a follow-up geometry risk that requires dedicated fixtures.
- Document that placement confidence is limited without real rendering or preview.

Rotated bounds should be checked from all four transformed rectangle corners, not only from the unrotated width and height. Portrait, landscape, rotated, cropped, mixed-size, and non-zero-origin pages need separate real-PDF fixtures in the later QA step.

### Safety copy

Future Docs, operation-plan copy, and UI warnings should preserve these statements without implying content removal:

- Border/background are additive visual styling.
- They do not edit existing PDF text.
- They do not remove existing PDF content.
- They are not redaction.
- A filled rectangle is not safe redaction.
- Hidden text, images, annotations, and metadata remain unless a real redaction process removes and verifies them.
- Existing images, text, page numbers, and watermarks are not removed.
- `APPROVED` / `REVIEWED` style stamps are not digital signatures, identity verification, or audit trails.
- Protected PDFs are not decrypted and permission restrictions are not bypassed.
- Original PDFs are not overwritten by default; output is written to a new PDF.

Real redaction is a separate safety-critical feature. It must remove targeted underlying content and relevant residual data, handle annotations and metadata according to an explicit policy, and verify the sanitized output. A visual rectangle alone does none of this.

### Recommended Rust/lopdf implementation path

1. **v0.10.0 Step 1 - Border/background design (current):** Define the candidate model, geometry, opacity policy, safety boundary, risks, stages, and QA only.
2. **Step 2 - Border/background core / bridge:** In a separately approved task, extend the existing Text stamp path with validated optional fields, fill/stroke operators, resource-safe ExtGState handling, content-stream ordering, and structural tests.
3. **Step 3 - Border/background UI connection:** Add compact controls, validation, operation-plan details, and prominent not-redaction copy without changing unrelated PDF operations.
4. **Step 4 - Real PDF QA polish:** Test representative pages, rotations, bounds, opacity combinations, preset colors, printing/viewers, extraction of underlying content, protected input, and regressions.
5. **Step 5 - Version bump / release:** Perform version and release work only after the implementation and QA steps are separately approved.
6. **Step 6 - Color preset polish:** Review accessibility, print contrast, limited additional presets, and whether independent border opacity is justified.
7. **Step 7 - Preview research:** Evaluate PDF.js/PDFium or another reviewed renderer as an independent feature; do not couple it to border/background delivery.
8. **Step 8 - Safe redaction research:** Treat content removal and sanitization as a distinct safety-critical feature, never as an extension of background fill.

The future core can reuse the existing Text stamp page selection, path checks, protected-PDF rejection, font resource, content-stream append, transform, and output verification patterns. The candidate drawing order is background fill first, border stroke second, and text last.

Opacity needs an explicit graphics-state policy. PDF non-stroking alpha (`ca`) affects fills and text, while stroking alpha (`CA`) affects the border. A later implementation should use reviewed, collision-safe ExtGState resources for text/fill/stroke combinations, wrap new operators in balanced graphics-state save/restore operations, and avoid changing inherited page graphics state. Resource names must be allocated without replacing inherited or page-local entries.

### Implementation risks

- Text-width estimates can mis-size the rectangle, especially near page edges.
- Padding and border width enlarge rotated bounds and can create clipping that text-only validation did not catch.
- Incorrect content-stream order can place fill above the text or behave differently across viewers.
- Reusing one ExtGState blindly can couple text, fill, and stroke opacity or leak state into existing content.
- Resource-name collisions can replace inherited font or graphics-state resources.
- Rotation around different centers can separate text, fill, and border.
- CropBox, MediaBox, non-zero origins, mixed page sizes, and existing page rotation can move a logical preset away from its visual location.
- Without rendering/preview, users cannot confirm coverage, contrast, or clipping before output.
- An opaque background can be misunderstood as redaction even when extraction still exposes the underlying content.

### Non-goals

v0.10.0 Step 1 does not implement or promise:

- safe redaction or calling a visual mask redaction;
- direct editing or replacement of existing PDF text;
- removal of existing text, images, page numbers, watermarks, annotations, hidden content, metadata, or residual objects;
- OCR;
- PDF.js/PDFium rendering, real preview, or thumbnails;
- Japanese font embedding, arbitrary fonts, multiple lines, or advanced typography;
- rounded corners, dashed borders, shadows, gradients, custom RGB, or complex vector styling;
- Image stamp or general Overlay writing;
- digital signatures, identity verification, or audit trails;
- decryption, permission bypass, password handling, or password input UI;
- Rust, bridge, React, CSS, PDF-processing, dependency, version, build-signing, or release changes.

### Step 1 documentation QA

- [ ] Confirm border/background are consistently described as additive visual styling.
- [ ] Confirm a filled rectangle or visual mask is never described as safe redaction.
- [ ] Confirm underlying text, images, annotations, and metadata are described as remaining in the PDF.
- [ ] Confirm border, fill, padding, opacity, bounding-box, rotation-center, page-box, and no-preview risks are documented.
- [ ] Confirm the staged path separates design, core/bridge, UI, real-PDF QA, release, preview research, and safe-redaction research.
- [ ] Confirm existing PDF operations remain available and no implementation is added in Step 1.

## 19. v0.10.0 Step 2 - Text stamp border/background core / bridge

Step 2 extends the existing `pdf_text_stamp` core / bridge with optional rectangle border, background fill, opacity, limited color presets, and padding while preserving text-only request compatibility. Border/background are additive visual styling and are not redaction; UI, preview, OCR, redaction, Japanese font embedding, direct PDF text editing, Image stamp UI, and Overlay writing are not added yet.

## 20. v0.10.0 Step 3 - Text stamp border/background UI connection

Step 3 connects the existing border/background fields to the compact PDF Workbench UI with limited colors, width, opacity, padding, validation, operation-plan details, and result feedback. Border/background remain additive visual styling and are not redaction; filled rectangles do not remove underlying PDF content.

## 21. v0.10.0 Step 4 - Text stamp border/background QA

Step 4 verifies the Text stamp border/background UI, validation, operation plan, compact layout, protected-PDF rejection, and real PDF output. Border/background remain additive visual styling rather than redaction, and filled rectangles do not remove underlying PDF content.
