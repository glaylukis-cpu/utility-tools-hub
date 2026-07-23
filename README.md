# Utility Tools Hub

A desktop hub for small, local-first productivity tools.

- **Official website:** [Utility Tools Hub](https://glaylukis-cpu.github.io/utility-tools-hub-site/)
- **Latest release:** [v0.9.1](https://github.com/glaylukis-cpu/utility-tools-hub/releases/tag/v0.9.1)

## Current Status

- Latest release: v0.9.1
- Windows desktop app
- Excel to HTML Converter is available
- The Tools catalog is organized into Converters, Editors, and Planned / Pro tools
- Converter Tools stacks File, Data, and Text converter sections, with each active editor shown inside its category
- Text Case Converter navigation and Excel → HTML Converter navigation are maintained
- v0.9.1 polishes the compact Text stamp helper layout around Stamp text, Pages, and Position without changing validation, `pdf_text_stamp`, request/response formats, or PDF processing
- v0.9.0 adds the PDF Text stamp foundation: short ASCII / Latin-1 stamps such as `APPROVED`, `REVIEWED`, `PAID`, `VOID`, or `COPY` can target all or selected pages with preset positions, margins, font size, opacity, rotation, color, input summary, validation, operation plan, and new-PDF feedback
- Additive printable ASCII / Latin watermarks such as `DRAFT` or `CONFIDENTIAL` can target all or selected pages and are saved to a new PDF
- PDF inspect shows file summaries, single-PDF operation inputs are inspected automatically, and Merge PDFs shows selected-file order, size, page count, PDF version, total pages, and protected-PDF warnings
- Merge, Split, Extract, Rotate, Delete, and Reorder remain available; watermarking does not edit existing PDF text and is not redaction
- PDF page operations use the local Rust core without a Python sidecar or external communication
- PNG alpha, WebP, SVG, CMYK/YCCK JPEG, progressive JPEG, image stamp UI, border/background stamps, Japanese font embedding, multi-line stamps, real PDF preview, thumbnails, overlay writing, direct PDF text editing, OCR, and redaction are not implemented
- Delete pages removes whole pages and is not redaction
- Billing shows a pricing model draft, and Account shows a planned license activation flow
- Real authentication, payment, Stripe Checkout, Customer Portal, license activation, Pro unlock, and external communication are not implemented yet

## Features

### Excel to HTML Converter

- Built-in converter sidecar
- No external converter folder required
- Select `.xlsx` files
- Drag and drop `.xlsx` files
- Convert and preview generated HTML
- Sheet tab switching in preview
- Optional ZIP output for current single-file conversion

### Free / Pro UI Placeholder

- Free plan indicator
- Pro feature cards
- Upgrade placeholder message
- No real login, payment, or server communication yet

## Screenshots

![Excel Converter Free Pro UI](Docs/images/excel-converter-free-pro.png)

![GitHub Release v0.1.4](Docs/images/github-release-v014.png)

## Download

Download the latest Windows installer from [GitHub Releases](https://github.com/glaylukis-cpu/utility-tools-hub/releases).

- **For most Windows users**: download the `setup.exe` installer
- MSI package is also available for Windows installer workflows

## Install

**Windows:**

1. Download the latest `setup.exe` from [GitHub Releases](https://github.com/glaylukis-cpu/utility-tools-hub/releases)
2. Run the installer
3. Launch **Utility Tools Hub**
4. Open **Tools -> Excel to HTML Converter**

## Usage

**Excel Converter:**

1. Open **Tools**
2. Open **Excel to HTML Converter**
3. Select or drag and drop an `.xlsx` file
4. Click **Convert and Preview**
5. Review the generated HTML preview
6. Use sheet tabs inside the preview when available

## Release Notes

### v0.9.1

- Polished the Text stamp helper layout around the Stamp text, Pages, and Position fields so long guidance no longer feels cramped in the compact three-column card
- Kept Text stamp validation, `pdf_text_stamp`, request/response formats, PDF processing logic, and existing PDF operations unchanged
- Text stamp remains additive and is not redaction or direct PDF text editing; `APPROVED` / `REVIEWED` style stamps are not digital signatures or audit trails
- Added no new PDF feature, border/background, preview, thumbnails, OCR, npm dependency, or Cargo dependency

### v0.9.0

- Added the local `pdf_text_stamp` core / bridge and connected Text stamp to the compact PDF Workbench UI
- Added short printable ASCII / Latin-1 stamps for all or selected pages with preset positions, margins, font size, opacity, rotation, black/red/gray colors, input summary, validation, operation plan, and result feedback
- Text stamp remains additive: it does not edit existing PDF text, remove existing images, text, page numbers, or watermarks, and `APPROVED` / `REVIEWED` style stamps are not digital signatures or audit trails
- Kept existing PDF operations and compact layout fixes; no border/background, Japanese font embedding, multi-line layout, image stamp UI, overlay writing, rendering, preview, thumbnails, OCR, redaction, direct editing, npm dependency, or Cargo dependency was added

### v0.8.0

- Added the local `pdf_image_watermark` core / bridge and connected JPEG-only Image watermark to the compact PDF Workbench UI
- Added all-pages or selected-pages targeting, center placement, fixed width with preserved aspect ratio, opacity, rotation, input summary, validation, operation plan, and result feedback
- Embedded grayscale/RGB JPEG streams as one shared `DCTDecode` Image XObject without recompression; Image watermark remains additive, is not redaction or PDF text editing, and does not remove existing content
- Kept existing PDF operations and layout overflow fixes; no PNG/WebP/SVG, stamps, rendering, preview, thumbnails, OCR, redaction, direct editing, npm dependency, or Cargo dependency was added

### v0.1.4

- Added auth/payment planning documentation
- Added Free / Pro UI placeholders
- Added Pro feature cards
- Clarified Advanced ZIP export wording

### v0.1.3

- Bundled Excel Converter sidecar
- Removed external converter folder requirement from normal user flow
- Confirmed conversion preview and sheet tab switching

### v0.1.2

- Added Excel Converter entry flow inside the hub
- Improved file selection and drag/drop UX

## Development Notes

- Tauri + React desktop app
- Python-based Excel converter bundled as a Tauri sidecar
- Windows release builds generate `setup.exe` and MSI
- Auth/payment is planned but not implemented

## Documentation

- [Auth Payment Plan](Docs/AuthPaymentPlan.md)
