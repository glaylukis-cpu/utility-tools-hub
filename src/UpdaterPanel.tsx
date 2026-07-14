import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import "./UpdaterPanel.css";

const FALLBACK_VERSION = "0.1.9";

type UpdateMessage = {
  kind: "info" | "success" | "error";
  text: string;
};

export default function UpdaterPanel() {
  const [currentVersion, setCurrentVersion] = useState(FALLBACK_VERSION);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<UpdateMessage | null>(null);

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
    };
  }, []);

  const checkForUpdates = async () => {
    if (isChecking) return;

    if (!isTauri()) {
      setMessage({ kind: "info", text: "Updater is available in the desktop app." });
      return;
    }

    setIsChecking(true);
    setMessage(null);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update) {
        setMessage({
          kind: "success",
          text: `Update ${update.version} is available. Download and install are not enabled yet.`,
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

  return (
    <section className="updater-panel" aria-labelledby="updater-panel-title">
      <div id="updater-panel-title" className="updater-panel-title">App updates</div>
      <div className="updater-panel-version">Current version: {currentVersion}</div>
      <button type="button" onClick={() => void checkForUpdates()} disabled={isChecking}>
        {isChecking ? "Checking..." : "Check for Updates"}
      </button>
      {message && (
        <p className={`updater-panel-message updater-panel-message-${message.kind}`} role="status" aria-live="polite">
          {message.text}
        </p>
      )}
    </section>
  );
}
