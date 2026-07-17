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

The Rust PDF merge core foundation has started. Merge is currently available only as an internal Rust API, with UI connection planned next; it does not use a Python sidecar, and PDF text editing, OCR, and redaction remain unimplemented.

The PDF merge command bridge now connects the Rust core to the app-side ToolRegistry, JobManager, and `execute_tool` execution layer. React UI connection is planned next; no Python sidecar is used, and PDF text editing, OCR, redaction, split, extract, rotate, delete, and reorder remain unimplemented.
