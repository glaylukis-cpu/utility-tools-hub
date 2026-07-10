# Utility Tools Hub


Utility Tools Hub is a Tauri desktop app foundation for bundling multiple useful PC tools into one application.


## Download


Download the latest Windows installer from the GitHub Releases page.


Release page:


https://github.com/glaylukis-cpu/utility-tools-hub/releases/tag/v0.1.0


Recommended installer:


- `Utility.Tools.Hub_0.1.0_x64-setup.exe`


Alternative installer:


- `Utility.Tools.Hub_0.1.0_x64_en-US.msi`


For normal Windows installation, use the `setup.exe` installer.
The `.msi` package is also available for installer-based distribution.


## Current Status


- Tauri v2 desktop app shell
- React + TypeScript + Vite UI
- Dashboard UI
- Tools UI
- Account UI mock
- Billing UI mock
- Settings UI
- Free / Pro / All Tools Pro plan display
- Auth integration coming soon message
- Billing integration coming soon message
- Payment processing is not implemented yet
- Authentication is not implemented yet
- Actual tool integrations are not implemented yet


## Repository


glaylukis-cpu/utility-tools-hub


## Requirements


- Windows 11
- Git
- Node.js / npm
- Rust / Cargo
- Microsoft Visual Studio Build Tools 2022
  - Desktop development with C++
  - MSVC v143
  - Windows 10 SDK or Windows 11 SDK


## Setup


```powershell
git clone https://github.com/glaylukis-cpu/utility-tools-hub.git
cd utility-tools-hub
npm.cmd install
```


## Build Web UI


```powershell
npm.cmd run build
```


## Run Tauri Desktop App


```powershell
npm.cmd run tauri:dev
```


When startup succeeds, the `Utility Tools Hub` desktop window opens.


## Build Tauri Desktop App


```powershell
npm.cmd run tauri:build
```


## Implemented Screens


### Dashboard


* Current plan display
* Monthly free usage count
* Upgrade to Pro button
* Recently used tools
* Recommended tools


### Tools


* Excel to HTML Converter
* HTML Table Editor
* CSV Formatter
* Image Compressor
* Batch File Renamer
* Coming Soon Tool


### Account


Authentication UI mock.


* Not signed in
* Sign in with Email
* Sign in with Google
* Auth integration coming soon


### Billing


Billing UI mock.


* Current plan: Free
* Free Plan: 0 JPY
* Single Tool Pro: 500 JPY / month
* All Tools Pro: 1,500 JPY / month
* Billing integration coming soon


### Settings


* Theme
* Language
* Local processing
* Data privacy
* App version


## Current Limitations


* Supabase Auth or other real authentication is not implemented
* Stripe Checkout / Billing or other real payment processing is not implemented
* Excel HTML Converter processing is not integrated yet
* HTML Table Editor is not implemented yet
* CSV Formatter is not implemented yet
* Image Compressor is not implemented yet
* Batch File Renamer is not implemented yet


## Roadmap


* Integrate Excel HTML Converter
* Add HTML Table Editor
* Add authentication with Supabase Auth or similar
* Add subscriptions with Stripe Checkout / Billing
* Add local tool execution foundation
* Create Windows installer
* Create GitHub Release
