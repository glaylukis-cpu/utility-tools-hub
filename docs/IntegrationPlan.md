# Utility Tools Hub Integration Plan

## Purpose

This document defines how Utility Tools Hub integrates external or heavy processing tools, starting with Excel to HTML Converter.

## Current Decision

Use the Python sidecar / CLI approach for Excel to HTML Converter integration.

The Hub remains a unified Tauri + React desktop app. Heavy conversion logic is called through a CLI or sidecar process instead of embedding separate web servers into the Hub.

## Why Not FastAPI Local Server as the Main Strategy

FastAPI remains useful for the standalone Excel to HTML Converter web app, but it should not become the default integration strategy for Utility Tools Hub.

Reasons:

- It splits the product UI between Hub screens and external web screens.
- It requires localhost server startup and shutdown management.
- It adds port management and process lifecycle complexity.
- It becomes hard to scale cleanly when the Hub grows to many tools.
- It makes packaging and offline desktop distribution more fragile.

## Why Not Immediate TypeScript or Rust Rewrite

Rewriting the Excel converter immediately in TypeScript or Rust is not the best first step.

Reasons:

- Existing conversion quality depends on openpyxl.
- Excel features such as merged cells, styles, display formatting, sheet handling, and conditional formatting are already implemented in Python.
- Rewriting too early risks breaking conversion fidelity.
- Rust or TypeScript Excel libraries may not match the current openpyxl behavior without significant rework.

## Chosen Strategy: Python CLI / Sidecar

The chosen direction is:

```text
React UI
  -> Tauri command
  -> Python CLI / sidecar
  -> HTML or ZIP output
  -> React preview and download UI
```

The Excel converter CLI already supports the following planned interface:

```bash
python -m app.cli input.xlsx --out output.html
python -m app.cli input.xlsx --out output.zip --zip
```

## Tool Architecture Rule for 30 Apps

Utility Tools Hub should use one common rule for future tools:

### TypeScript-only tools

Use React and TypeScript when the tool is small and does not need OS-level access.

Examples:

* Text formatter
* CSV formatter
* JSON formatter
* Simple HTML table editor
* Small calculators

### Tauri Rust command tools

Use Rust commands when the tool needs local file system access, safe file operations, or native desktop behavior.

Examples:

* Batch file renamer
* Folder scanner
* File metadata viewer
* Local archive utilities

### Sidecar / CLI tools

Use sidecar or CLI tools when the processing is heavy, already exists in another language, or depends on specialized libraries.

Examples:

* Excel to HTML conversion through Python openpyxl
* PDF processing
* OCR
* Image compression or conversion
* Video/audio processing

### Avoid per-tool local web servers

Do not use a local FastAPI, Express, or other web server as the default integration style unless there is a strong reason.

## Excel to HTML Converter Integration Plan

### Phase 1: CLI entry point

Status: Done in excel-html-converter.

The converter has a CLI entry point:

```bash
python -m app.cli input.xlsx --out output.html
python -m app.cli input.xlsx --out output.zip --zip
```

### Phase 2: Hub integration design

Status: This document.

Define how Utility Tools Hub will call the converter without changing runtime behavior yet.

### Phase 3: Tauri command prototype

Add a Tauri command in Utility Tools Hub, for example:

```text
convert_excel_to_html(input_path, output_path) -> result
```

The command should call the converter CLI and return structured success or error data to React.

### Phase 4: React tool screen integration

Update the Excel tool page to include:

* File picker
* Convert button
* Conversion status
* HTML preview
* Download HTML button
* Download ZIP button

### Phase 5: Packaging strategy

Decide how the Python converter is distributed with the Windows desktop app.

Possible options:

1. Bundle a Python runtime and converter code as a sidecar.
2. Package the converter with PyInstaller and call the generated executable.
3. Vendor the converter source into the Hub repository.
4. Keep the converter as a separate repository and copy artifacts during release build.

Preferred first packaging experiment:

```text
PyInstaller-built converter executable as a Tauri sidecar
```

This avoids requiring users to install Python manually.

## Repository Relationship Options

### Option A: Keep separate repositories

Pros:

* Existing converter remains independently releasable.
* Cleaner history.
* Existing standalone FastAPI app remains intact.

Cons:

* Release coordination is manual.
* Hub build must fetch or receive converter artifacts.

### Option B: Git submodule

Pros:

* Keeps source linked to the original repository.
* Clear version pinning.

Cons:

* Submodules add workflow friction.
* Easy to confuse during clone/build.

### Option C: Vendor copy into Hub

Pros:

* Simplest build structure.
* Everything needed is inside one repository.

Cons:

* Duplicate source.
* Harder to sync improvements back to the standalone converter.

### Option D: Build artifact dependency

Pros:

* Hub consumes a packaged converter executable.
* Clean runtime boundary.
* Best long-term fit for sidecar design.

Cons:

* Requires release/build automation.

Recommended direction:

```text
Short term: separate repositories with manual artifact copy.
Mid term: PyInstaller sidecar artifact consumed by Hub.
Long term: automated build pipeline that packages the converter sidecar into Hub releases.
```

## Proposed Runtime Flow

```text
User selects .xlsx file in React
  -> Tauri open file dialog returns input path
  -> React invokes convert_excel_to_html
  -> Rust command creates output path in app temp/cache directory
  -> Rust command starts sidecar process
  -> Sidecar writes output.html or output.zip
  -> Rust command reads JSON stdout
  -> React receives result
  -> React displays preview or download action
```

## Expected CLI Result Shape

Success:

```json
{
  "ok": true,
  "mode": "html",
  "input": "input.xlsx",
  "output": "output.html"
}
```

Failure:

```json
{
  "ok": false,
  "error": "Only .xlsx files are supported."
}
```

## Security Notes

* Do not execute arbitrary user-provided commands.
* Only pass file paths to the known converter sidecar.
* Validate input extension before invoking conversion.
* Prefer app-managed output directories.
* Avoid writing output beside the original user file unless explicitly requested.
* Do not expose local server ports for this integration.
* Keep conversion offline and local.

## Current Open Questions

* Should the first Hub prototype call the system Python interpreter or only a packaged sidecar?
* Should the converter output HTML string, file path, or both?
* Should preview HTML be rendered in an iframe, sanitized container, or external viewer?
* Where should temporary outputs be stored?
* How should large-file progress be reported?
* Should ZIP generation be handled by the converter CLI or by the Hub after HTML output?
* How will converter sidecar version be tracked inside Hub releases?

## Recommended Next Step

Create a minimal Tauri command prototype that calls a known CLI command and returns JSON to React.

Initial development-only version may call:

```bash
python -m app.cli input.xlsx --out output.html
```

Production version should use a packaged sidecar executable instead of relying on a user-installed Python environment.

## Non-goals

The following are not part of the immediate next implementation:

* Rewriting the converter in Rust
* Rewriting the converter in TypeScript
* Starting a FastAPI server from the Hub
* Embedding the existing Jinja2 UI inside the Hub
* Changing the standalone excel-html-converter web app
* Building the final installer packaging pipeline
