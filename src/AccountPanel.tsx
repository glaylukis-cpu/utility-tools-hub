import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentPlan, getProPlannedFeatures } from "./planFeatures";
import "./AccountPanel.css";

const FALLBACK_VERSION = "0.2.1";

export default function AccountPanel() {
  const plan = getCurrentPlan();
  const proPlannedFeatures = getProPlannedFeatures();
  const [appVersion, setAppVersion] = useState(FALLBACK_VERSION);
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseMessage, setLicenseMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (isTauri()) {
      void import("@tauri-apps/api/app")
        .then(({ getVersion }) => getVersion())
        .then((version) => {
          if (active) setAppVersion(version);
        })
        .catch(() => {
          // Keep the packaged version fallback without exposing runtime details.
        });
    }

    return () => {
      active = false;
    };
  }, []);

  const handleActivateLicense = () => {
    setLicenseMessage("License activation is not available yet.");
  };

  return (
    <section className="account-panel" aria-labelledby="account-panel-title">
      <div className="page-header">
        <h1 id="account-panel-title">Account</h1>
        <p>Account and license controls are planned. The app currently runs as {plan.label}.</p>
      </div>

      <div className="account-summary-grid">
        <div className="card account-status-card">
          <h2>Account status</h2>
          <dl className="account-status-list">
            <div>
              <dt>Current plan</dt>
              <dd>{plan.label}</dd>
            </div>
            <div>
              <dt>License status</dt>
              <dd>Not activated</dd>
            </div>
            <div>
              <dt>App version</dt>
              <dd>{appVersion}</dd>
            </div>
          </dl>
        </div>

        <div className="card account-status-card">
          <h2>Planned services</h2>
          <div className="account-planned-row">
            <span>Sign in</span>
            <span className="account-planned-badge">Planned</span>
          </div>
          <div className="account-planned-row">
            <span>Billing</span>
            <span className="account-planned-badge">Planned</span>
          </div>
          <p className="account-muted-copy">Pro features are planned and are not currently available for purchase.</p>
        </div>
      </div>

      <div className="card account-license-card">
        <div className="account-card-heading">
          <div>
            <h2>License</h2>
            <p>License verification will be connected to a future service.</p>
          </div>
          <span className="account-status-pill">Not activated</span>
        </div>

        <label className="account-field-label" htmlFor="account-license-key">
          License key
        </label>
        <input
          id="account-license-key"
          className="account-license-input"
          type="password"
          value={licenseKey}
          onChange={(event) => {
            setLicenseKey(event.target.value);
            setLicenseMessage(null);
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter a license key"
        />
        <p className="account-field-help">The entered value stays only in this screen and is not saved or sent.</p>

        <div className="account-action-row">
          <button type="button" className="btn btn-primary" onClick={handleActivateLicense}>
            Activate License
          </button>
          <button type="button" className="btn btn-disabled" disabled>
            Deactivate License (Planned)
          </button>
        </div>

        {licenseMessage && (
          <div className="account-message" role="status">
            {licenseMessage}
          </div>
        )}
      </div>

      <div className="account-detail-grid">
        <div className="card account-detail-card">
          <h2>Billing</h2>
          <p>Billing and the customer portal are not implemented yet.</p>
          <button type="button" className="btn btn-disabled" disabled>
            Manage billing (Planned)
          </button>
        </div>

        <div className="card account-detail-card">
          <h2>Pro features planned</h2>
          <ul className="account-feature-list">
            {proPlannedFeatures.map((feature) => (
              <li key={feature.id}>{feature.label}</li>
            ))}
          </ul>
          <p className="account-muted-copy">You can continue using the currently available {plan.label} features.</p>
        </div>
      </div>
    </section>
  );
}
