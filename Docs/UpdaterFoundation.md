# Tauri Updater Production Setup

## Release policy

- v0.2.0 is the first manually distributed release that contains the production updater configuration.
- v0.1.9 does not contain that configuration, so an automatic update from v0.1.9 to v0.2.0 is not expected.
- The first end-to-end update test is performed after installing v0.2.0 and publishing v0.2.1.
- Update checks are user initiated. Checking does not download or install an update.
- Download and installation begin only after the user selects **Download and Install**.
- Automatic relaunch is not included. After installation, the UI asks the user to restart the application.

## Production configuration

The desktop application uses the Tauri v2 updater plugin with:

- updater artifact generation enabled for release builds;
- the production public signing key in application configuration;
- the HTTPS `latest.json` endpoint hosted by GitHub Releases;
- passive Windows installer mode;
- explicit check and download-and-install permissions for the main window.

An unavailable endpoint, missing `latest.json`, invalid metadata, or signature failure must be shown as a safe updater error and must not crash the application.

## v0.2.0 release preparation

1. Keep the updater signing private key outside the repository. Never commit it, copy it into project files, include it in documentation, or print it in logs.
2. At build time, set `TAURI_SIGNING_PRIVATE_KEY` to the private key file path using the approved local or CI secret-management process.
3. Build the Windows release so Tauri generates the updater artifact and its `.sig` file.
4. Attach the updater artifact, its `.sig` file, and `latest.json` to the v0.2.0 GitHub Release.
5. Copy the complete contents of the artifact's `.sig` file into the matching `latest.json` platform entry as `signature`.

The signature value is the content of the `.sig` file. It is not a URL, filename, or filesystem path. Do not place signing secrets or authentication values in `latest.json`.

## Windows x64 latest.json template

Replace `ARTIFACT_FILENAME` with the updater artifact filename and replace `PLACEHOLDER` with the complete `.sig` file contents before publishing:

```json
{
  "version": "0.2.0",
  "notes": "Utility Tools Hub v0.2.0",
  "platforms": {
    "windows-x86_64": {
      "signature": "PLACEHOLDER",
      "url": "https://github.com/glaylukis-cpu/utility-tools-hub/releases/download/v0.2.0/ARTIFACT_FILENAME"
    }
  }
}
```

Publish this file as `latest.json` on the same release. The application endpoint resolves the `latest/download/latest.json` asset from the latest GitHub Release.

## v0.2.1 update verification

v0.2.1 is an updater verification release for confirming that v0.2.0 detects the update and performs **Download and Install** only after the user requests it. This verification does not mean that automatic updates are fully operational in production.

1. Install the manually distributed v0.2.0 release.
2. Build and sign the v0.2.1 updater artifact using the protected signing process.
3. Publish the v0.2.1 artifact, `.sig`, and completed `latest.json` on the v0.2.1 GitHub Release.
4. Start v0.2.0 and select **Check for Updates**.
5. Confirm that v0.2.1 and its notes appear without starting a download.
6. Select **Download and Install**, confirm progress is displayed, and restart the application when instructed.
7. Confirm that the restarted application reports v0.2.1.
