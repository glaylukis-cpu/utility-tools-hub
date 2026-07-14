import "./SettingsPanel.css";

export default function SettingsPanel() {
  return (
    <section className="settings-panel" aria-labelledby="settings-panel-title">
      <div className="page-header">
        <h1 id="settings-panel-title">Settings</h1>
        <p>App preferences and future language options.</p>
      </div>

      <div className="card settings-preferences-card">
        <div>
          <span className="settings-section-eyebrow">App preferences</span>
          <h2>Language</h2>
          <p>Current language: English</p>
        </div>
        <span className="settings-status-badge settings-status-current">English · Current</span>
      </div>

      <div className="settings-language-grid" aria-label="Language availability">
        <article className="card settings-language-card settings-language-card-current">
          <div className="settings-language-heading">
            <div>
              <span className="settings-section-eyebrow">Current language</span>
              <h2>English</h2>
            </div>
            <span className="settings-status-badge settings-status-current">Current</span>
          </div>
          <p>The existing interface remains English-based.</p>
          <button type="button" className="btn btn-disabled" disabled>
            English (Current)
          </button>
        </article>

        <article className="card settings-language-card">
          <div className="settings-language-heading">
            <div>
              <span className="settings-section-eyebrow">Future language</span>
              <h2>Japanese</h2>
            </div>
            <span className="settings-status-badge">Planned</span>
          </div>
          <p>Japanese UI copy and layout will be introduced gradually.</p>
          <button type="button" className="btn btn-disabled" disabled>
            Japanese (Planned)
          </button>
        </article>
      </div>

      <div className="card settings-language-note" role="note">
        <h2>Language switching</h2>
        <p>Language switching is planned and not active yet. This setting is not changed or saved by this screen.</p>
      </div>
    </section>
  );
}
