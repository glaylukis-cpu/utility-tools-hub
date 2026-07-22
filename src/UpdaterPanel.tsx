import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { Update } from "@tauri-apps/plugin-updater";
import "./UpdaterPanel.css";

const FALLBACK_VERSION = "0.7.0";

type UpdateMessage = {
  kind: "info" | "success" | "error";
  text: string;
};

type DownloadProgress = {
  downloaded: number;
  total?: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UpdaterPanel() {
  const [currentVersion, setCurrentVersion] = useState(FALLBACK_VERSION);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [installationComplete, setInstallationComplete] = useState(false);
  const [message, setMessage] = useState<UpdateMessage | null>(null);
  const updateRef = useRef<Update | null>(null);

  useEffect(() => {
    let active = true;

    if (isTauri()) {
      void import("@tauri-apps/api/app")
        .then(({ getVersion }) => getVersion())
        .then((version) => {
          if (active) setCurrentVersion(version);
        })
        .catch(() => {
          // Keep the packaged release version fallback without exposing runtime details.
        });
    }

    return () => {
      active = false;
      const update = updateRef.current;
      updateRef.current = null;
      if (update) void update.close().catch(() => undefined);
    };
  }, []);

  const checkForUpdates = async () => {
    if (isChecking || isInstalling) return;

    if (!isTauri()) {
      setMessage({ kind: "info", text: "Updater is available in the desktop app." });
      return;
    }

    setIsChecking(true);
    setInstallationComplete(false);
    setDownloadProgress(null);
    setMessage(null);

    try {
      const previousUpdate = updateRef.current;
      updateRef.current = null;
      setAvailableUpdate(null);
      if (previousUpdate) await previousUpdate.close().catch(() => undefined);

      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update) {
        updateRef.current = update;
        setAvailableUpdate(update);
        setMessage({
          kind: "success",
          text: "A new version is available. Review the details before installing.",
        });
      } else {
        setMessage({ kind: "info", text: "You are using the latest available version." });
      }
    } catch {
      setMessage({
        kind: "error",
        text: "Update checking is not configured yet or is currently unavailable.",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    if (!availableUpdate || isInstalling) return;

    setIsInstalling(true);
    setInstallationComplete(false);
    setDownloadProgress({ downloaded: 0 });
    setMessage({ kind: "info", text: "Downloading the update..." });

    let downloaded = 0;
    let total: number | undefined;

    try {
      await availableUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength;
          setDownloadProgress({ downloaded: 0, total });
          return;
        }

        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setDownloadProgress({ downloaded, total });
          return;
        }

        setDownloadProgress({ downloaded: total ?? downloaded, total });
        setMessage({ kind: "info", text: "Download complete. Installing the update..." });
      });

      setInstallationComplete(true);
      setMessage({
        kind: "success",
        text: "Update installed. Restart the app to finish applying it.",
      });
    } catch {
      setMessage({
        kind: "error",
        text: "The update could not be downloaded or installed. Please try again later.",
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const progressPercent =
    downloadProgress?.total && downloadProgress.total > 0
      ? Math.min(100, Math.round((downloadProgress.downloaded / downloadProgress.total) * 100))
      : null;

  return (
    <section className="updater-panel" aria-labelledby="updater-panel-title">
      <div id="updater-panel-title" className="updater-panel-title">App updates</div>
      <div className="updater-panel-version">Current version: {currentVersion}</div>
      <button type="button" onClick={() => void checkForUpdates()} disabled={isChecking || isInstalling}>
        {isChecking ? "Checking..." : "Check for Updates"}
      </button>
      {availableUpdate && (
        <div className="updater-panel-update">
          <div className="updater-panel-update-label">New version</div>
          <div className="updater-panel-update-version">{availableUpdate.version}</div>
          {availableUpdate.body?.trim() && (
            <p className="updater-panel-notes">{availableUpdate.body}</p>
          )}
          <button
            className="updater-panel-install"
            type="button"
            onClick={() => void downloadAndInstall()}
            disabled={isInstalling || installationComplete}
          >
            {isInstalling ? "Downloading and Installing..." : installationComplete ? "Installed" : "Download and Install"}
          </button>
        </div>
      )}
      {downloadProgress && (
        <div className="updater-panel-progress">
          <div
            className="updater-panel-progress-track"
            role="progressbar"
            aria-label="Update download progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent ?? undefined}
          >
            <span
              className={`updater-panel-progress-fill${progressPercent === null ? " updater-panel-progress-fill-unknown" : ""}`}
              style={progressPercent === null ? undefined : { width: `${progressPercent}%` }}
            />
          </div>
          <div className="updater-panel-progress-text">
            {progressPercent === null
              ? `${formatBytes(downloadProgress.downloaded)} downloaded`
              : `${progressPercent}% (${formatBytes(downloadProgress.downloaded)} / ${formatBytes(downloadProgress.total ?? 0)})`}
          </div>
        </div>
      )}
      {message && (
        <p className={`updater-panel-message updater-panel-message-${message.kind}`} role="status" aria-live="polite">
          {message.text}
        </p>
      )}
    </section>
  );
}
