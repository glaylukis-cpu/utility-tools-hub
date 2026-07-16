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
