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
