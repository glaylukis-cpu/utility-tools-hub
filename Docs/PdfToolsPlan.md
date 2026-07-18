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

## v0.3.1 split / extract core preparation

PDF split and extract command bridges now connect the Rust cores to the app-side ToolRegistry, JobManager, and `execute_tool` execution layer while Merge PDFs remains available. React UI connection is planned next; no Python sidecar is used, and rotate, delete, reorder, OCR, redaction, and direct text editing remain unimplemented.
