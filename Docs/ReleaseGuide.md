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
- Updater verification will be done after the signed build and GitHub Release are created.
- Updater verification will be done after the signed build and GitHub Release are created.
