# Release Guide

## Overview

手順と注意事項をまとめた、Utility Tools Hub の Windows release 作成ガイド。

## Pre-release Checks

- `git status --short` が clean であること
- `main` が `origin/main` と同期していること
- GitHubトークンや認証情報をログに表示しないこと
- tag / release は明示指示がある場合のみ行うこと

## Version Bump

更新対象:

- `package.json` — `version` フィールド
- `package-lock.json` — 自動更新
- `src-tauri/Cargo.toml` — `[package] version` フィールド
- `src-tauri/tauri.conf.json` — `version` フィールド
- `src-tauri/Cargo.lock` — app package version（自動更新）

検証:

```bash
npm run build
cd src-tauri
cargo check
cd ..
```

## Windows Build

```powershell
npm.cmd run build
npm.cmd run tauri:build
```

### 生成物

- `src-tauri/target/release/bundle/nsis/Utility Tools Hub_<version>_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/Utility Tools Hub_<version>_x64_en-US.msi`

## Tag

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

## GitHub Release

1. GitHub Releases で対象 tag を選択
2. Release title を書く
3. Release notes を書く
4. `setup.exe` と MSI を添付
5. Source code assets は GitHub が自動生成する

## Security Notes

- `git remote -v` を実行しない
- `.git/config` を表示しない
- `env` / `printenv` / `set` を実行しない
- `gh auth token` を実行しない
- token, secret, password, Authorization header, Cookie をログに出さない

## Notes

- Windows 配布物の最終 build は Windows 環境で行う
- OpenHands では `npm run build` までを主な検証対象にする
- cargo が無い環境では SKIP_CARGO_NOT_FOUND と表示する

## v0.2.2 Release Note

- v0.2.2 is a foundation release for account, billing, and app language settings.
- No real login, payment, license activation, or external communication is included.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.2.3 Release Note

- v0.2.3 is a foundation release for plan and feature definitions.
- The current plan remains Free Preview. Pro remains Planned and cannot be purchased or activated yet.
- Account, Billing, and Tools displays can reference shared feature definitions.
- No real login, payment, license activation, Pro unlock, localStorage plan cache, or external communication is included.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.2.4 Release Note

- v0.2.4 is a foundation release for pricing model and license flow design.
- The current plan remains Free Preview, and all pricing is draft or planned and may change before launch.
- Single Tool Pro is planned at ¥500/month, All Tools Pro at ¥1,500/month, and Future Expanded Pro is a ¥2,000/month candidate.
- No real login, payment, Stripe Checkout, Customer Portal, license activation, Pro unlock, localStorage plan cache, or external communication is included.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.2.5 Release Note

- v0.2.5 is a converter tools pack release.
- Adds JSON Formatter / Minifier, CSV to JSON, JSON to CSV, Markdown to HTML, Base64 Encode / Decode, and URL Encode / Decode.
- All converter tools run locally, with no external communication or package dependency added.
- PDF tools are planned for a later phase.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.2.6 Release Note

- v0.2.6 is a converter tools UI polish release.
- Converter Tools now uses a white card-based UI aligned with the rest of the app.
- Converter categories are organized into file, data, and text converter areas, with improved navigation to Excel → HTML Converter.
- No PDF tools, external communication, or package dependency are added.

## v0.2.7 Release Note

- v0.2.7 is a tools catalog and converter navigation cleanup release.
- The Tools list separates Available tools from Planned / Pro tools more clearly.
- Converter Tools links to Text Case Converter and Excel → HTML Converter with clearer role descriptions.
- Text Case Converter and Excel → HTML Converter behavior is unchanged.
- No PDF tools, external communication, or package dependency are added.

## v0.2.8 Release Note

- v0.2.8 is a tools catalog and converter layout cleanup release.
- The Tools list is organized into Converters, Editors, and Planned / Pro tools.
- Converter Tools is organized into vertically stacked File, Data, and Text converter sections.
- Data converters include JSON and CSV / JSON, while Text converters include Text Case navigation, Markdown, Base64, and URL tools.
- File converters include Excel → HTML Converter navigation.
- Converter logic and the behavior of Text Case Converter and Excel → HTML Converter are unchanged.
- No PDF tools, external communication, or package dependency are added.
- Updater verification will be done after the signed build and GitHub Release are created.
- Updater verification will be done after the signed build and GitHub Release are created.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.2.9 Release Note

- v0.2.9 is a PDF tools planning and file workflow foundation release.
- It adds the PDF Tools screen, PDF file selection UI, output destination UI, planned PDF page tools, future advanced tools, and safety notes.
- Planned page tools include merge, split, extract, delete, rotate, and reorder.
- PDF processing is not implemented, no PDF content is modified, and no PDF library, external communication, or package dependency is added.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.3.0 Release Note

- v0.3.0 is the PDF merge MVP release.
- PdfToolsPanel merges multiple PDFs through the local Rust PDF merge bridge, with input and output selection plus loading, success, and error states.
- A Python sidecar is not used; split, extract, rotate, delete, reorder, OCR, redaction, and direct text editing remain unimplemented.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.3.1 Release Note

- v0.3.1 is the PDF split / extract MVP release.
- PdfToolsPanel can split one PDF into separate page PDFs and extract selected pages into a new PDF while Merge PDFs remains available.
- PDF processing stays local without a Python sidecar; rotate, delete, reorder, OCR, redaction, and direct text editing remain unimplemented.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.3.2 Release Note

- v0.3.2 is the PDF rotate / delete MVP release.
- PdfToolsPanel can rotate selected pages by 90, 180, or 270 degrees and delete selected whole pages into a new PDF.
- Merge, split, and extract remain available through the local Rust PDF page-operation core without a Python sidecar.
- Delete pages is not redaction; reorder, watermark, page numbers, OCR, redaction, and direct text editing remain unimplemented.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.3.3 Release Note

- v0.3.3 is the PDF tools QA and UX polish release.
- PdfToolsPanel descriptions, input examples, disabled reasons, and loading, success, and error messages are clearer.
- Delete pages is whole-page deletion, not redaction, and Planned and Research PDF features are separated more clearly.
- `Docs/PdfToolsQaChecklist.md` provides repeatable real-file QA steps.
- No new PDF processing feature was added, the Rust PDF core and bridge were not changed, and no Python sidecar is used.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.3.4 Release Note

- v0.3.4 is a protected PDF merge error and merge stability bugfix release.
- Merge PDFs clearly rejects encrypted or permission-protected inputs while normal unprotected PDF merge remains supported.
- Split, Extract, Rotate, and Delete remain available.
- No decryption, permission bypass, password handling, new PDF operation, or Python sidecar was added.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.4.0 Release Note

- v0.4.0 is the PDF Workbench foundation release.
- PDF Tools is organized as a Workbench, with PDF file summaries, automatic input summaries for single-PDF operations, and Merge multi-file summaries with order, total pages, and protected-PDF warnings.
- Merge, Split, Extract, Rotate, and Delete remain available, with processing kept local and no Python sidecar.
- Preview, thumbnails, reorder, watermark, page numbers, overlay writing, OCR, redaction, and direct PDF text editing are not implemented.
- Updater verification will be done after the signed build and GitHub Release are created.

## v0.4.1 Release Note

- v0.4.1 is a PDF Workbench QA polish release.
- Responsive layout, card density, safety wording, and summary readability are improved.
- Merge, Split, Extract, Rotate, and Delete remain available, with no new PDF processing feature added.
- Preview, thumbnails, reorder, OCR, redaction, and direct PDF text editing are still not implemented.

## v0.4.2 Release Note

- v0.4.2 is a PDF preview research spike that documents implementation options before adding real rendering.
- It compares Rust-side rendering, PDFium, pdf.js, WebView embed, OS viewer, and lightweight pseudo-preview.
- Lightweight operation-plan visualization is the recommended next safe step.
- No PDF rendering, thumbnails, reorder, OCR, redaction, direct PDF text editing, npm dependency, or Cargo dependency is added.

## v0.4.3 Release Note

- v0.4.3 adds lightweight PDF operation-plan preview for merge order, total pages, split output estimates, and selected Extract / Rotate / Delete targets.
- Delete-all-pages risk and protected-PDF warnings remain visible, and Delete pages remains clearly distinguished from redaction.
- Existing Inspect, Merge, Split, Extract, Rotate, and Delete operations remain available.
- This is not PDF rendering. No page rendering, thumbnails, reorder, OCR, redaction, direct PDF text editing, npm dependency, or Cargo dependency is added.
