# PDF Tools Plan

## v0.2.9 planning and file workflow foundation

v0.2.9 adds the PDF Tools planning and local file workflow foundation. PDF processing is not implemented yet: the UI can select a local PDF and an output folder for display, but it does not read, parse, modify, or write PDF content.

No external communication is used, no PDF library is added, and no PDF content modification is performed in this phase.

## Planned PDF page tools

Page-level operations are planned before direct text editing:

- Merge PDFs
- Split PDF
- Extract pages
- Delete pages
- Rotate pages
- Reorder pages

## Future advanced tools

Longer-term candidates include:

- Watermark
- Page numbers
- Text stamp
- Image stamp
- PDF to images
- Images to PDF
- Safe redaction
- OCR-assisted workflow

Direct text editing in existing PDFs is complex and remains a later research topic. Safe redaction must remove the underlying content instead of only covering it visually.

This foundation adds no PDF processing, PDF library, external service, file upload, or output writing behavior.

The v0.2.9 release adds no package dependency. Updater verification will be performed after the signed build and GitHub Release are created.

## Rust merge core foundation

The Rust PDF merge core foundation started as an internal Rust API before the UI connection was added. It does not use a Python sidecar, and PDF text editing, OCR, and redaction remain unimplemented.

The PDF merge command bridge connects the Rust core to the app-side ToolRegistry, JobManager, and `execute_tool` execution layer. PdfToolsPanel can now call this bridge, making Merge PDFs the first UI-connected PDF page operation. Processing stays local without a Python sidecar; split, extract, rotate, delete, reorder, OCR, redaction, and direct text editing remain unimplemented.

## v0.3.0 PDF merge MVP

v0.3.0 connects multiple PDF selection, output PDF selection, and loading, success, and error states in PdfToolsPanel to the local Rust merge bridge. No Python sidecar is used; split, extract, rotate, delete, reorder, OCR, redaction, and direct text editing remain unimplemented.

## v0.3.1 PDF split / extract MVP

PdfToolsPanel now connects to the existing PDF split and extract command bridges through ToolRegistry, JobManager, and `execute_tool`, making Split PDF and Extract pages UI-connected MVPs alongside Merge PDFs. Processing stays local without a Python sidecar; rotate, delete, reorder, OCR, redaction, and direct text editing remain unimplemented. Updater verification will be done after the signed build and GitHub Release are created.

## v0.3.2 rotate / delete core preparation

The Rust rotate and page-delete cores were added in preparation for v0.3.2. Rotate and delete started as Rust-core-only operations; the command bridge is the next foundation step described below. Merge, split, and extract remain available, and no Python sidecar is used.

Reorder, OCR, redaction, watermark, page numbers, and direct PDF text editing are not implemented.

## v0.3.2 rotate / delete command bridge

The PDF rotate and delete command bridges now connect the Rust cores to the app-side ToolRegistry, JobManager, and `execute_tool` execution layer. React UI connection is planned next. Merge, split, and extract remain available, and no Python sidecar is used.

Reorder, watermark, page numbers, OCR, redaction, and direct PDF text editing are not implemented.

## v0.3.2 rotate / delete UI connection

PdfToolsPanel can now call the Rust PDF rotate and delete bridges through the shared execution layer. Rotate pages and Delete pages are UI-connected MVPs alongside Merge, Split, and Extract. Processing stays local and no Python sidecar is used.

Reorder, watermark, page numbers, OCR, redaction, and direct PDF text editing are not implemented.

## v0.3.2 PDF rotate / delete MVP release

v0.3.2 ships the local Rotate pages and Delete pages MVPs alongside Merge, Split, and Extract. Delete removes whole pages and is not redaction; reorder, watermark, page numbers, OCR, redaction, and direct text editing remain unimplemented. Updater verification will follow the signed build and GitHub Release.

## v0.3.3 QA / UX polish

v0.3.3 focuses on clearer guidance, validation reasons, operation status, safety wording, and repeatable real-file QA for the existing Merge, Split, Extract, Rotate, and Delete MVPs. No new PDF processing capability or Rust PDF logic is added; the Rust bridge is unchanged, no Python sidecar is used, and updater verification will follow the signed build and GitHub Release.

## v0.3.4 Merge bugfix

v0.3.4 is a protected PDF merge error and merge stability bugfix release. Normal unprotected PDF merge remains supported, while encrypted or permission-protected inputs are clearly rejected without decryption, permission bypass, or password handling. Split, Extract, Rotate, and Delete remain available; no new PDF operation is added, no Python sidecar is used, and updater verification will follow the signed build and GitHub Release.

## v0.5.0 PDF reorder core / bridge foundation

The local `pdf_reorder` core and bridge can write a new PDF using a complete specified page order. UI connection, drag-and-drop, thumbnails, and real PDF rendering are not implemented yet.

## v0.5.0 PDF reorder UI connection

PDF Workbench now connects to `pdf_reorder`, validates a complete page order, and saves the reordered pages as a new PDF. Drag-and-drop reorder, thumbnails, and real PDF rendering remain unimplemented.

## v0.5.0 PDF reorder foundation release

The PDF reorder core, command bridge, Reorder pages UI, input summary, full-page-order validation, operation plan, and page-order warnings are prepared as the v0.5.0 foundation. Existing PDF operations remain available, processing stays local, and real PDF rendering, thumbnails, drag-and-drop reorder, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.6.0 Watermark foundation planning

Watermark remains in the planning stage. `Docs/PdfWatermarkPlan.md` defines additive text and image watermarks, stamps, overlay writing, implementation risks, and the boundary from direct text editing and safe redaction; no PDF processing or UI implementation is added in this step.

## v0.6.0 Text watermark core / bridge

The additive `pdf_text_watermark` core and shared execution bridge can write printable ASCII text to all or selected pages in a new PDF. UI connection, image watermark, stamps, preview, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.6.0 Text watermark UI connection

PDF Workbench now connects to `pdf_text_watermark` with input summary, all-page or selected-page targeting, style validation, operation plan, and local new-PDF output. Image watermark, stamps, real preview, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.6.1 Compact Workbench layout

PDF Workbench now uses an operation selector and shows only the active operation card. File selections and field state remain in memory while switching operations; PDF processing, preview, thumbnails, OCR, redaction, and direct text editing are unchanged.

## v0.7.0 Page numbers foundation planning

Page numbers remains in the planning stage. `Docs/PdfPageNumbersPlan.md` defines additive numbering, formats, selected-page and start-number semantics, six positioning anchors, margins, font size, staged Rust / `lopdf` risks, and the boundary from direct text editing and redaction; no PDF processing, Rust, bridge, UI, rendering, or dependency change is added in this step.

## v0.7.0 Page numbers core / bridge

The additive `pdf_page_numbers` core and shared execution bridge can write validated page numbers to all or selected pages in a new PDF. Existing PDF text and page numbers are not edited or removed; UI, preview, thumbnails, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.7.0 Page numbers UI connection

PDF Workbench now connects to `pdf_page_numbers` with input summary, all-page or selected-page targeting, bounded numbering settings, operation plan, and local new-PDF output. Page numbers remains additive; real preview, thumbnails, existing page-number removal, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.8.0 Image watermark and stamp planning

`Docs/PdfImageWatermarkStampPlan.md` defines design-only image watermark, image stamp, and text stamp categories, PNG and JPEG/JPG candidates, placement and sizing models, implementation risks, safety boundaries, staged delivery, and QA. No image or stamp processing, Rust, bridge, UI, dependency, rendering, OCR, redaction, or direct PDF text editing is added in this step.

## v0.8.0 Image format research / core feasibility

Image watermark remains planned rather than implemented. Format research recommends a narrow JPEG-only Image watermark core / bridge before PNG alpha support; no Rust, dependency, UI, rendering, OCR, redaction, or direct PDF text editing change is added in this step.

## v0.8.0 JPEG-only Image watermark core / bridge

The additive `pdf_image_watermark` core and shared execution bridge can write validated baseline grayscale/RGB JPEG watermarks to all or selected pages using one shared Image XObject. UI, PNG, WebP, SVG, stamps, rendering, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.8.0 JPEG Image watermark UI connection

PDF Workbench now connects to `pdf_image_watermark` with PDF/JPEG selection, bounded settings, center-placement operation plan, and local new-PDF feedback. PNG, WebP, SVG, stamps, rendering, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.9.0 Text stamp foundation planning

`Docs/PdfTextStampPlan.md` defines the planned additive short-text stamp model, position and styling candidates, safety boundaries, lopdf risks, staged implementation, and QA. Text stamp core, bridge, UI, PDF processing, preview, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.9.0 Text stamp core / bridge

The additive `pdf_text_stamp` core and shared execution bridge write validated short ASCII / Latin-1 stamps to all or selected pages with preset position, margins, font size, opacity, rotation, and black/red/gray color. UI, border/background, preview, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.9.0 Text stamp UI connection

PDF Workbench now connects to `pdf_text_stamp` with input/output PDF selection, input summary, short-text and page validation, bounded placement and styling fields, a lightweight plan, and loading/success/error feedback. The operation remains additive and writes a new PDF; border/background styling, real preview, thumbnails, Image stamp, Overlay writing, OCR, redaction, direct text editing, and existing-content removal remain unimplemented.

## v0.10.0 Text stamp border/background planning

`Docs/PdfTextStampPlan.md` now plans optional rectangle border, background fill, padding, opacity, placement geometry, safety copy, and staged delivery. Border/background remain unimplemented additive visual styling and are not redaction; no Rust, bridge, UI, CSS, PDF-processing, dependency, or version change is added.

## v0.10.0 Text stamp border/background core / bridge

The existing `pdf_text_stamp` core / bridge now supports optional rectangle border, background fill, limited colors, independent bounded opacity, and padding. Existing text-only requests remain compatible; UI, preview, OCR, redaction, and direct PDF text editing are not added.

## v0.10.0 Text stamp border/background UI connection

PDF Workbench now sends the existing optional border/background fields to `pdf_text_stamp` and shows compact controls, validation, plan details, result feedback, and a filled-background not-redaction warning. Preview, OCR, redaction, and direct PDF text editing remain unimplemented.

## v0.11.0 Image stamp foundation planning

`Docs/PdfImageWatermarkStampPlan.md` now defines the planned JPEG-only Image stamp goal, its distinction from Image watermark, position and bounding-box model, shared execution direction, staged delivery, and safety boundaries. Image stamp remains in Planning; no Rust, bridge, React, CSS, PDF-processing, dependency, preview, OCR, redaction, direct text editing, or version change is added.

## v0.11.0 JPEG-only Image stamp core / bridge

The additive `pdf_image_stamp` core and shared execution bridge can place validated baseline grayscale/RGB JPEG stamp-like images on all or selected pages using position presets, margins, width with preserved aspect ratio, opacity, and rotation. UI, PNG alpha, rendering, preview, OCR, redaction, direct PDF text editing, digital signatures, and audit trails remain unimplemented.

## v0.11.0 Image stamp UI connection

PDF Workbench now sends validated PDF/JPEG/output paths, optional page targets, preset position, margins, width, opacity, and rotation to the existing `pdf_image_stamp` shared route. The compact UI includes input summary, operation plan, safety guidance, and loading/success/error feedback; no Rust, PDF-processing, dependency, preview, OCR, redaction, or direct text-editing change is included.

## v0.12.0 PNG alpha research / design

PNG alpha support for Image stamp and Image watermark is in research only. `Docs/PdfImageWatermarkStampPlan.md` documents JPEG-only limits, a narrow non-interlaced 8-bit PNG candidate, PDF color Image XObject plus DeviceGray `SMask` handling, dependency/resource risks, Image stamp-first staging, and the additive/not-redaction boundary; no Rust, dependency, PDF processing, UI, preview, OCR, redaction, or direct text-editing change is added.

## v0.12.0 PNG dependency feasibility spike

The feasibility spike evaluates `png` 0.18.1 as the preferred candidate for a future Image stamp-only, non-interlaced 8-bit RGB/RGBA/grayscale prototype. Dependency-tree, build/debug-size, decoder-limit, malformed-input, alpha-split, and PDF `SMask` considerations are documented; the temporary Cargo dependency was reverted and no Rust, PDF-processing, UI, preview, OCR, redaction, or direct text-editing implementation is added.
