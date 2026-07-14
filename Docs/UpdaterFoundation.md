# Tauri Updater Foundation

## Included in this foundation

- Tauri v2 updater dependencies for the desktop application.
- Desktop-only updater plugin registration.
- The minimum updater capability used by the update check command.
- An App updates panel that displays the packaged application version.
- A manual Check for Updates action that reports results without downloading or installing anything.
- Safe browser and configuration-error fallback messages.
- An intentionally empty updater configuration (`endpoints` is empty and `pubkey` is blank) so the plugin can initialize without enabling production updates.

## Not implemented yet

- Production update endpoints.
- A production signing public key.
- Update artifact signing or publishing.
- Automatic download, installation, restart, or background checks.
- GitHub Release API integration.

## Production configuration requirements

Before enabling update delivery, configure and validate all of the following together:

- `plugins.updater.pubkey` with the production signing public key.
- `plugins.updater.endpoints` with the approved update metadata endpoint.
- `bundle.createUpdaterArtifacts` so release builds generate updater artifacts.
- A release process that signs updater artifacts and publishes `latest.json`, the platform artifacts, and their `.sig` files to GitHub Releases.

Do not add placeholder updater values to the production configuration if they make builds or checks invalid. Until the production values exist, the application must treat update-check errors as an unavailable feature rather than a fatal error.

## Signing key safety

The updater signing private key must never be committed to this repository, written to project files, placed in documentation, printed in logs, or included in release artifacts. Store and use it only through an approved secret-management process when production signing is introduced.

## Candidates for v0.2.0 and later

- Define the GitHub Release update endpoint and production public key.
- Enable updater artifact generation in the release build.
- Add a protected CI release-signing workflow.
- Verify `latest.json`, signatures, platform targeting, and rollback behavior in a staging release.
- Add explicit user approval for download, installation, and application restart.
