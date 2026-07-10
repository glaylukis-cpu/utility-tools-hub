import { useState } from "react";
import "./App.css";

// Tauri v2 runtime invoke (only available inside the Tauri app)
declare const __TAURI__:
  | { core: { invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> } }
  | undefined;

function invokeTauri<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (__TAURI__?.core) return __TAURI__.core.invoke(cmd, args);
  throw new Error("Tauri runtime not available");
}

type Page = "dashboard" | "tools" | "account" | "billing" | "settings";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const openTool = (tool: string) => {
    setSelectedTool(tool);
    setPage("tools");
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-title">Utility Tools Hub</div>
        <ul className="sidebar-nav">
          {[
            { id: "dashboard" as Page, label: "Dashboard", icon: "\u{1F3E0}" },
            { id: "tools" as Page, label: "Tools", icon: "\u{1F4EA}" },
            { id: "account" as Page, label: "Account", icon: "\u{1F464}" },
            { id: "billing" as Page, label: "Billing", icon: "\u{1F4B0}" },
            { id: "settings" as Page, label: "Settings", icon: "\u{2699}\u{FE0F}" },
          ].map((item) => (
            <li key={item.id}>
              <button
                className={page === item.id && !selectedTool ? "active" : ""}
                onClick={() => { setPage(item.id); setSelectedTool(null); }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="main-content">
        {selectedTool === "excel-html-converter" && <ExcelToolPage onBack={() => setSelectedTool(null)} />}
        {(selectedTool == "html-table-editor" || selectedTool == "batch-file-renamer") && (
          <PendingToolPage tool={selectedTool!} onBack={() => setSelectedTool(null)} />
        )}
        {!selectedTool && page === "dashboard" && <DashboardPage onOpenTool={openTool} />}
        {!selectedTool && page === "tools" && <ToolsPage onOpenTool={openTool} />}
        {!selectedTool && page === "account" && <AccountPage />}
        {!selectedTool && page === "billing" && <BillingPage />}
        {!selectedTool && page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

/* ── Dashboard ── */

function DashboardPage({ onOpenTool }: { onOpenTool?: (tool: string) => void }) {
  return (
    <div>
      <div className="page-header">
        <h1>Utility Tools Hub</h1>
        <p>複数のPC便利ツールをまとめて使えるデスクトップアプリ</p>
      </div>

      <div className="info-box">
        <span>{"💸"}</span>
        <div>
          <strong>現在のプラン: Free</strong>
          <br />
          今月の無料利用: 3 / 10
        </div>
      </div>

      <div className="usage-bar">
        <div className="usage-fill" style={{ width: "30%" }} />
      </div>

      <button
        className="btn btn-primary"
        style={{ marginTop: 16 }}
        onClick={() => {}}
      >
        Upgrade to Pro
      </button>

      <div className="section-title">最近使ったツール</div>
      <div className="recent-tools">
        <button className="recent-tag" onClick={() => onOpenTool?.("excel-html-converter")}>
          Excel → HTML Converter
        </button>

        <span className="recent-tag">Image Compressor</span>
        <span className="recent-tag">CSV Formatter</span>
      </div>

      <div className="section-title">おすすめツール</div>
      <div className="card-grid">
        <ToolCardMini
          name="HTML Table Editor"
          desc="ブラウザでHTMLテーブルを編集・エクスポート"
          onClick={() => onOpenTool?.("html-table-editor")}
        />
        <ToolCardMini
          name="Batch File Renamer"
          desc="複数のファイルを一度にリネーム"
          onClick={() => onOpenTool?.("batch-file-renamer")}
        />
      </div>
    </div>
  );
}

function ToolCardMini({ name, desc, onClick }: { name: string; desc: string; onClick?: () => void }) {
  return (
    <div className="tool-card" style={{ cursor: "default" }} onClick={onClick}>
      <div className="tool-name">{name}</div>
      <div className="tool-desc">{desc}</div>
      <span className="badge badge-pro">Pro</span>
    </div>
  );
}

/* ── Tools ── */

const tools = [
  {
    name: "Excel → HTML Converter",
    desc: "Excel ファイルをHTMLテーブルに変換",
    badge: "Free",
    status: "Available",
    locked: false,
  },
  {
    name: "HTML Table Editor",
    desc: "ブラウザでHTMLテーブルを編集・エクスポート",
    badge: "Pro",
    status: "Locked",
    locked: true,
  },
  {
    name: "CSV Formatter",
    desc: "CSVファイルのフォーマット変換とクリーニング",
    badge: "Pro",
    status: "Locked",
    locked: true,
  },
  {
    name: "Image Compressor",
    desc: "画像ファイルを圧縮して容量を削減",
    badge: "All Tools Pro",
    status: "Locked",
    locked: true,
  },
  {
    name: "Batch File Renamer",
    desc: "複数のファイルを一度にリネーム",
    badge: "Pro",
    status: "Locked",
    locked: true,
  },
  {
    name: "Coming Soon Tool",
    desc: "今後の機能は随時追加されます",
    badge: "Coming Soon",
    status: "Locked",
    locked: true,
  },
];

function ToolsPage({ onOpenTool }: { onOpenTool?: (tool: string) => void }) {
  return (
    <div>
      <div className="page-header">
        <h1>Tools</h1>
        <p>使えるツールを一覧で確認できます</p>
      </div>

      <div className="card-grid">
        {tools.map((t, i) => (
          <ToolCard key={i} tool={t} onOpenTool={onOpenTool} />
        ))}
      </div>
    </div>
  );
}

function ToolCard({
  tool: { name, desc, badge, status, locked },
  onOpenTool,
}: {
  tool: {
    name: string;
    desc: string;
    badge: string;
    status: string;
    locked: boolean;
  };
  onOpenTool?: (tool: string) => void;
}) {
  const badgeClass =
    badge === "Free"
      ? "badge-free"
      : badge === "Pro"
        ? "badge-pro"
        : badge === "All Tools Pro"
          ? "badge-all-pro"
          : "badge-coming-soon";

  return (
    <div className="tool-card">
      <div className="tool-name">{name}</div>
      <div className="tool-desc">{desc}</div>
      <span className={`badge ${badgeClass}`}>{badge}</span>
      <div className="tool-footer">
        {locked ? (
          <button className="btn btn-disabled" disabled>
            Open
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => onOpenTool?.("excel-html-converter")}>
            Open
          </button>
        )}
        <span
          className={`status-text ${
            status === "Available" ? "status-available" : "status-locked"
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

/* ── Account ── */

function AccountPage() {
  const [toast, setToast] = useState(false);

  return (
    <div>
      <div className="page-header">
        <h1>Account</h1>
        <p>認証設定を管理します</p>
      </div>

      {toast && (
        <div className="toast">Auth integration coming soon</div>
      )}

      <div className="auth-container">
        <div className="card">
          <div className="auth-avatar">{"👤"}</div>
          <div className="auth-title">Not signed in</div>

          <div className="auth-buttons">
            <button
              className="auth-btn auth-btn-primary"
              onClick={() => setToast(true)}
            >
              Sign in with Email
            </button>
            <button
              className="auth-btn auth-btn-google"
              onClick={() => setToast(true)}
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Billing ── */

function BillingPage() {
  const [toast, setToast] = useState(false);

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
        <p>サブスクリプションと課金を管理します</p>
      </div>

      {toast && (
        <div className="toast">Billing integration coming soon</div>
      )}

      <div className="info-box">
        <span>{"💰"}</span>
        <strong>Current plan: Free</strong>
      </div>

      <div className="plan-grid">
        {/* Free */}
        <div className="plan-card current">
          <div className="plan-name">Free Plan</div>
          <div className="plan-price">\u00A50</div>
          <div className="plan-period">無料</div>
          <ul className="plan-features">
            <li>\u2713 Free ツールの利用</li>
            <li>\u2713 月間 10 回までの処理</li>
            <li>\u2717 Pro ツール不可</li>
            <li>\u2717 優先サポートなし</li>
          </ul>
          <button className="btn btn-disabled" disabled>
            Current Plan
          </button>
        </div>

        {/* Single Tool Pro */}
        <div className="plan-card">
          <div className="plan-name">Single Tool Pro</div>
          <div className="plan-price">\u00A5500</div>
          <div className="plan-period">/ month</div>
          <ul className="plan-features">
            <li>\u2713 選択した Pro ツールを無制限利用</li>
            <li>\u2713 Free ツールの利用</li>
            <li>\u2717 他のProツール不可</li>
          </ul>
          <button
            className="btn btn-outline"
            onClick={() => setToast(true)}
          >
            Upgrade
          </button>
        </div>

        {/* All Tools Pro */}
        <div className="plan-card">
          <div className="plan-name">All Tools Pro</div>
          <div className="plan-price">\u00A51,500</div>
          <div className="plan-period">/ month</div>
          <ul className="plan-features">
            <li>\u2713 全ツールを無制限利用</li>
            <li>\u2713 優先サポート</li>
            <li>\u2713 新機能の早期アクセス</li>
          </ul>
          <button
            className="btn btn-primary"
            onClick={() => setToast(true)}
          >
            Upgrade
          </button>
        </div>
      </div>

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button
          className="btn btn-outline"
          onClick={() => setToast(true)}
        >
          Manage subscription
        </button>
      </div>
    </div>
  );
}

/* ── Settings ── */

function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>アプリの設定を管理します</p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <ul className="settings-list">
          <li className="settings-item">
            <span className="settings-label">Theme</span>
            <span className="settings-value">Light</span>
          </li>
          <li className="settings-item">
            <span className="settings-label">Language</span>
            <span className="settings-value">日本語</span>
          </li>
          <li className="settings-item">
            <span className="settings-label">Local processing</span>
            <span className="settings-value">Enabled</span>
          </li>
          <li className="settings-item">
            <span className="settings-label">Data privacy</span>
            <span className="settings-value">データはローカルに保存されます</span>
          </li>
          <li className="settings-item">
            <span className="settings-label">App version</span>
            <span className="settings-value">0.1.0</span>
          </li>
        </ul>
      </div>
    </div>
  );
}


/* ── Dev CLI Bridge for Excel conversion ── */

interface DevCliBridgeState {
  converterDir: string;
  inputPath: string;
  outputPath: string;
  zipOutput: boolean;
  status: "idle" | "running" | "success" | "error";
  result: string | null;
}

function DevCliBridge() {
  const [s, setS] = useState<DevCliBridgeState>({
    converterDir: "../excel-html-converter",
    inputPath: "/tmp/cli_test.xlsx",
    outputPath: "/tmp/utility_tools_hub_cli_test_output.html",
    zipOutput: false,
    status: "idle",
    result: null,
  });

  const runConversion = async () => {
    if (!s.converterDir || !s.inputPath || !s.outputPath) {
      setS((p) => ({ ...p, status: "error", result: "All fields are required." }));
      return;
    }
    setS((p) => ({ ...p, status: "running", result: null }));
    try {
      const res = await invokeTauri<string>("convert_excel_to_html_dev", {
        inputPath: s.inputPath,
        outputPath: s.outputPath,
        converterDir: s.converterDir,
        zip: s.zipOutput,
      });
      setS((p) => ({ ...p, status: "success", result: res }));
    } catch (err: any) {
      setS((p) => ({
        ...p,
        status: "error",
        result: typeof err === "string" ? err : JSON.stringify(err),
      }));
    }
  };

  return (
    <div className="dev-bridge">
      <h3>Development CLI Bridge</h3>
      <p style={{ fontSize: ".85rem", color: "#64748b" }}>
        This is a development-only bridge for testing the Tauri command path.
      </p>

      <div className="form-fields">
        <label className="form-label">
          Converter directory
          <input
            type="text"
            value={s.converterDir}
            onChange={(e) => setS((p) => ({ ...p, converterDir: e.target.value }))}
            style={{ width: "100%", padding: ".5rem", marginTop: 4 }}
          />
        </label>

        <label className="form-label">
          Input .xlsx path
          <input
            type="text"
            value={s.inputPath}
            onChange={(e) => setS((p) => ({ ...p, inputPath: e.target.value }))}
            style={{ width: "100%", padding: ".5rem", marginTop: 4 }}
          />
        </label>

        <label className="form-label">
          Output path
          <input
            type="text"
            value={s.outputPath}
            onChange={(e) => setS((p) => ({ ...p, outputPath: e.target.value }))}
            style={{ width: "100%", padding: ".5rem", marginTop: 4 }}
          />
        </label>

        <label className="form-label">
          <input type="checkbox" checked={s.zipOutput} onChange={(e) => setS((p) => ({ ...p, zipOutput: e.target.checked }))} />
          &nbsp; ZIP output
        </label>
      </div>

      <button
        className="btn btn-primary"
        disabled={s.status === "running"}
        onClick={runConversion}
        style={{ marginTop: 8 }}
      >
        {s.status === "running" ? "Running..." : "Run dev conversion"}
      </button>

      {s.result !== null && (
        <pre className="result-output">
          {s.status === "error" ? `\u274C ${s.result}` : `\u2705 ${s.result}`}
        </pre>
      )}
    </div>
  );
}


/* ── Excel Tool Detail Page ── */

function ExcelToolPage({ onBack }: { onBack: () => void }) {
  const [message, setMessage] = useState(false);

  return (
    <div>
      <button
        className="btn btn-outline"
        style={{ marginBottom: 20 }}
        onClick={onBack}
      >
        ← Back to Tools
      </button>

      <div className="page-header">
        <h1>Excel to HTML Converter</h1>
        <p>Convert Excel files into clean HTML output.</p>
      </div>

      {message && (
        <div className="toast">
          Excel converter integration is not implemented yet.
        </div>
      )}

      <div className="card tool-detail-card">
        <div className="tool-section">
          <strong>Status:</strong>
          <br />
          Local converter integration is planned.
        </div>

        <div className="tool-section">
          <strong>Current scope:</strong>
          <ul className="scope-list">
            <li>Tool entry screen</li>
            <li>Hub navigation</li>
            <li>Desktop app shell integration</li>
          </ul>
        </div>

        <div className="tool-section">
          <strong>Not yet implemented:</strong>
          <ul className="scope-list">
            <li>Excel file upload</li>
            <li>Conversion execution</li>
            <li>HTML preview</li>
            <li>Export/download</li>
          </ul>
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button className="btn btn-primary" onClick={() => setMessage(true)}>
            Open Tool
          </button>
        </div>
      </div>

      {/* Phase 4 prototype: file picker + preview */}
      <Phase4Prototype />

      {/* Development CLI Bridge section */}
      <DevCliBridge />
    </div>
  );
}


/* ── Phase4: File picker + HTML preview prototype ── */

type Phase4Status = "idle" | "running" | "success" | "error";

interface Phase4Result {
  ok: boolean;
  mode: string;
  input: string;
  output: string;
  preview_html?: string | null;
  cli_stdout: string;
}

function Phase4Prototype() {
  const [converterDir, setConverterDir] = useState("../excel-html-converter");
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [zipOutput, setZipOutput] = useState(false);
  const [status, setStatus] = useState<Phase4Status>("idle");
  const [result, setResult] = useState<Phase4Result | null>(null);

  const pickFile = async () => {
    try {
      const picked: string | null = await invokeTauri<string | null>("select_excel_file_dev", {});
      setInputPath(picked || null);
      setResult(null);
      setStatus("idle");
    } catch (err: any) {
      const msg = typeof err === "string" ? err : JSON.stringify(err);
      setResult({ ok: false, mode: "", input: "", output: "", cli_stdout: msg });
      setStatus("error");
    }
  };

  const convertAndPreview = async () => {
    if (!inputPath) {
      setStatus("error");
      setResult({ ok: false, mode: "", input: "", output: "", cli_stdout: "Please select a file first." });
      return;
    }
    if (!converterDir) {
      setStatus("error");
      setResult({ ok: false, mode: "", input: "", output: "", cli_stdout: "Converter directory is required." });
      return;
    }
    setStatus("running");
    try {
      const res = await invokeTauri<Phase4Result>("convert_excel_to_html_preview_dev", {
        inputPath,
        converterDir,
        zip: zipOutput,
      });
      setResult(res);
      setStatus(res.ok ? "success" : "error");
    } catch (err: any) {
      const msg = typeof err === "string" ? err : JSON.stringify(err);
      setResult({ ok: false, mode: "", input: "", output: "", cli_stdout: msg });
      setStatus("error");
    }
  };

  return (
    <div className="phase4-prototype">
      <h3>Phase4 Excel Converter Prototype</h3>
      <p style={{ fontSize: ".85rem", color: "#64748b" }}>
        Select an .xlsx file, convert it through the Tauri command bridge, and preview the generated HTML.
      </p>

      <div className="form-fields">
        <label className="form-label">
          Converter directory
          <input
            type="text"
            value={converterDir}
            onChange={(e) => setConverterDir(e.target.value)}
            style={{ width: "100%", padding: ".5rem", marginTop: 4 }}
          />
        </label>

        <button className="btn btn-outline" onClick={pickFile} disabled={status === "running"} style={{ marginTop: 8 }}>
          Select .xlsx file
        </button>

        {inputPath && (
          <div className="path-display">Selected: {inputPath}</div>
        )}

        <label className="form-label" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={zipOutput} onChange={(e) => setZipOutput(e.target.checked)} />
          &nbsp; ZIP output
        </label>

        <button
          className="btn btn-primary"
          disabled={status === "running" || !inputPath}
          onClick={convertAndPreview}
          style={{ marginTop: 8 }}
        >
          {status === "running" ? "Running..." : "Convert and preview"}
        </button>
      </div>

      {result && (
        <div className="phase4-result">
          {status === "error" && <div style={{ color: "#dc2626", marginTop: 12 }}>❌ {result.cli_stdout}</div>}
          {status === "success" && (
            <>
              <div style={{ marginTop: 12, marginBottom: 4 }}>✅ Conversion successful</div>
              <div className="path-display">Output: {result.output}</div>
              <pre className="result-output">{result.cli_stdout}</pre>
              {result.preview_html && (
                <>
                  <div style={{ marginTop: 12, marginBottom: 4 }}>HTML Preview:</div>
                  <iframe
                    title="Excel HTML Preview"
                    srcDoc={result.preview_html}
                    sandbox=""
                    className="html-preview-frame"
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}


/* ── Pending Tool Detail Page ── */

const pendingToolInfo: Record<string, { name: string; desc: string }> = {
  "html-table-editor": {
    name: "HTML Table Editor",
    desc: "Edit and export HTML tables inside the desktop hub.",
  },
  "batch-file-renamer": { name: "Batch File Renamer", desc: "Rename multiple files at once." },
};

function PendingToolPage({ tool, onBack }: { tool: string; onBack: () => void }) {
  const [message, setMessage] = useState(false);
  const info = pendingToolInfo[tool] || { name: tool, desc: "Tool details coming soon." };

  return (
    <div>
      <button className="btn btn-outline" style={{ marginBottom: 20 }} onClick={onBack}>
        ← Back
      </button>

      <div className="page-header">
        <h1>{info.name}</h1>
        <p>{info.desc}</p>
      </div>

      {message && (
        <div className="toast">This tool is not implemented yet.</div>
      )}

      <div className="card tool-detail-card">
        <div className="tool-section">
          <strong>Status:</strong>
          <br />
          This tool is not implemented yet.
        </div>

        <div className="tool-section">
          <strong>Current scope:</strong>
          <ul className="scope-list">
            <li>Tool entry screen</li>
            <li>Hub navigation</li>
            <li>Placeholder detail page</li>
          </ul>
        </div>

        <div className="tool-section">
          <strong>Not yet implemented:</strong>
          <ul className="scope-list">
            {tool === "html-table-editor" ? (
              <>
                <li>Table editing</li>
                <li>HTML import</li>
                <li>Export/download</li>
              </>
            ) : (
              <>
                <li>Batch file selection</li>
                <li>Rename pattern configuration</li>
                <li>Execute rename</li>
              </>
            )}
          </ul>
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button className="btn btn-primary" onClick={() => setMessage(true)}>
            Open Tool
          </button>
        </div>
      </div>
    </div>
  );
}
