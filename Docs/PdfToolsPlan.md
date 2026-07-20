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

v0.3.4 targets the real-file Merge failure found during v0.3.3 QA by improving general PDF compatibility coverage and preserving safe, actionable merge errors through the existing bridge and UI. Encrypted or permission-protected inputs are detected and clearly rejected without attempting decryption or bypass; no new PDF operation is added.
