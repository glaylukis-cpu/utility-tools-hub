import { useState, useEffect, useRef } from "react";
import "./App.css";
import HtmlEditorPage from "./HtmlEditor";

// Tauri v2 runtime invoke (only available inside the Tauri app)
declare const __TAURI__:
  | { core: { invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> } }
  | undefined;

function invokeTauri<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (__TAURI__?.core) return __TAURI__.core.invoke(cmd, args);
  throw new Error("Tauri runtime not available");
}

type Page = "dashboard" | "tools" | "account" | "billing" | "settings";

/* ── Plan Status ── */

type PlanStatus = "free" | "paid" | "offline_grace";
const currentPlan: PlanStatus = "free";

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
        {selectedTool === "text-case-converter" && <TextCaseToolPage onBack={() => setSelectedTool(null)} />}
        {selectedTool === "html-table-editor" && <HtmlEditorPage onBack={() => setSelectedTool(null)} />}
        {selectedTool == "batch-file-renamer" && (
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
          name="HTML Editor"
          desc="ブロックを組み合わせてHTMLを作成・プレビュー"
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
    id: "excel-html-converter",
    name: "Excel → HTML Converter",
    desc: "Excel ファイルをHTMLテーブルに変換",
    badge: "Free",
    status: "Available",
    locked: false,
  },
  {
    id: "text-case-converter",
    name: "Text Case Converter",
    desc: "テキストを大文字・小文字・各種ケースへ変換",
    badge: "Free",
    status: "Available",
    locked: false,
  },
  {
    id: "html-table-editor",
    name: "HTML Editor",
    desc: "ブロックを組み合わせてHTMLを作成・プレビュー",
    badge: "Pro",
    status: "Available",
    locked: false,
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
  tool: { id, name, desc, badge, status, locked },
  onOpenTool,
}: {
  tool: {
    id?: string;
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
          <button className="btn btn-primary" onClick={() => id && onOpenTool?.(id)}>
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


/* ── Text Case Tool Detail Page ── */

function TextCaseToolPage({ onBack }: { onBack: () => void }) {
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
        <h1>Text Case Converter</h1>
        <p>Convert text to uppercase, lowercase, title case, snake case, or kebab case.</p>
      </div>

      <TextCaseConverter />
    </div>
  );
}


/* ── Excel Tool Detail Page ── */

function ExcelToolPage({ onBack }: { onBack: () => void }) {
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

      {/* Excel converter: file picker + preview */}
      <ExcelConverter />
    </div>
  );
}


/* ── Excel Converter: file picker + HTML preview ── */

const CONVERTER_DIR_KEY = "excel-converter-directory";

function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function loadSavedConverterDir(): string | null {
  try {
    return localStorage.getItem(CONVERTER_DIR_KEY) ?? null;
  } catch {
    return null;
  }
}

function saveConverterDir(path: string) {
  try {
    localStorage.setItem(CONVERTER_DIR_KEY, path);
  } catch { /* ignore */ }
}

type ExcelConverterStatus = "idle" | "running" | "success" | "error";

interface ExcelConversionResult {
  ok: boolean;
  mode: string;
  input: string;
  output: string;
  preview_html?: string | null;
  cli_stdout: string;
}

type ToolJobStatus = "queued" | "running" | "succeeded" | "failed";

interface ToolJob<T> {
  job_id: string;
  tool_id: string;
  status: ToolJobStatus;
  created_at: number;
  result?: T | null;
  error?: string | null;
}

type TextCaseMode = "uppercase" | "lowercase" | "title_case" | "snake_case" | "kebab_case";
type TextCaseConverterStatus = "idle" | "running" | "success" | "error";

interface TextCaseConversionResult {
  ok: boolean;
  mode: TextCaseMode;
  input_text: string;
  output_text: string;
}

function TextCaseConverter() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<TextCaseMode>("uppercase");
  const [status, setStatus] = useState<TextCaseConverterStatus>("idle");
  const [result, setResult] = useState<TextCaseConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  const isRunningRef = useRef(false);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      isRunningRef.current = false;
      stopPolling();
    };
  }, []);

  const convertText = async () => {
    if (isRunningRef.current) return;
    if (!text.trim()) {
      isRunningRef.current = false;
      setResult(null);
      setError("Please enter text first.");
      setStatus("error");
      return;
    }

    stopPolling();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    isRunningRef.current = true;
    setResult(null);
    setError(null);
    setStatus("running");

    const finishWithError = (message: string) => {
      if (runIdRef.current !== runId) return;
      stopPolling();
      isRunningRef.current = false;
      setResult(null);
      setError(message);
      setStatus("error");
    };

    try {
      const jobId = await invokeTauri<string>("execute_tool", {
        request: {
          tool_id: "text_case_converter",
          input: { text },
          options: { mode },
        },
      });

      if (runIdRef.current !== runId) return;

      const pollJob = async () => {
        if (runIdRef.current !== runId) return;

        try {
          const job = await invokeTauri<ToolJob<TextCaseConversionResult>>(
            "get_job_status",
            { jobId },
          );
          if (runIdRef.current !== runId) return;

          if (job.status === "queued" || job.status === "running") {
            pollTimerRef.current = setTimeout(() => { void pollJob(); }, 500);
            return;
          }

          stopPolling();
          isRunningRef.current = false;

          if (job.status === "succeeded" && job.result) {
            setResult(job.result);
            setError(null);
            setStatus(job.result.ok ? "success" : "error");
            return;
          }

          finishWithError(job.error ?? "Tool execution failed without an error message.");
        } catch (err: any) {
          const message = typeof err === "string" ? err : JSON.stringify(err);
          finishWithError(message);
        }
      };

      pollTimerRef.current = setTimeout(() => { void pollJob(); }, 500);
    } catch (err: any) {
      const message = typeof err === "string" ? err : JSON.stringify(err);
      finishWithError(message);
    }
  };

  return (
    <div className="phase4-prototype">
      <h3>Text Case Converter</h3>
      <p style={{ fontSize: ".85rem", color: "#64748b" }}>
        Enter text, choose an output mode, and convert it locally.
      </p>

      <div className="engine-status" style={{ marginBottom: 8 }}>
        <span className="engine-ready">Built-in text converter ready</span>
      </div>

      <div className="form-fields">
        <label className="form-label" htmlFor="text-case-input">Input text</label>
        <textarea
          id="text-case-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={status === "running"}
          rows={8}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 12,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            resize: "vertical",
            font: "inherit",
          }}
        />

        <label className="form-label" htmlFor="text-case-mode">Mode</label>
        <select
          id="text-case-mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as TextCaseMode)}
          disabled={status === "running"}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 10,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#fff",
          }}
        >
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="title_case">Title Case</option>
          <option value="snake_case">snake_case</option>
          <option value="kebab_case">kebab-case</option>
        </select>

        <button
          className="btn btn-primary"
          disabled={status === "running" || !text.trim()}
          onClick={convertText}
          style={{ marginTop: 12 }}
        >
          {status === "running" ? "Running..." : "Convert"}
        </button>
      </div>

      {status === "error" && error && (
        <div style={{ color: "#dc2626", marginTop: 12 }}>❌ {error}</div>
      )}

      {status === "success" && result && (
        <div className="phase4-result">
          <div className="success-summary" style={{ marginTop: 12, marginBottom: 4 }}>
            ✅ Conversion successful.
          </div>
          <div style={{ fontSize: ".8rem", color: "#64748b" }}>Mode: {result.mode}</div>
          <pre className="result-output">{result.output_text}</pre>
        </div>
      )}
    </div>
  );
}

function ExcelConverter() {
  const [converterDir, setConverterDir] = useState<string | null>(null);
  const [_detecting, setDetecting] = useState(true); // kept for dev fallback diagnostics
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [zipOutput, setZipOutput] = useState(false);
  const [status, setStatus] = useState<ExcelConverterStatus>("idle");
  const [result, setResult] = useState<ExcelConversionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  const isRunningRef = useRef(false);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      isRunningRef.current = false;
      stopPolling();
    };
  }, []);

  // On mount: load saved directory or auto-detect
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = loadSavedConverterDir();
      if (saved) {
        if (!cancelled) setConverterDir(saved);
        return;
      }
      try {
        const found: string | null = await invokeTauri<string | null>(
          "detect_converter_directory_dev", {}
        );
        if (!cancelled && found) {
          setConverterDir(found);
          saveConverterDir(found);
        }
      } catch {
        // detection failed in non-tauri env → keep null
      } finally {
        if (!cancelled) setDetecting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    if (isRunningRef.current) return;
    if (!inputPath) {
      setStatus("error");
      setResult({ ok: false, mode: "", input: "", output: "", cli_stdout: "Please select a file first." });
      return;
    }

    stopPolling();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    isRunningRef.current = true;
    setStatus("running");
    setResult(null);

    const finishWithError = (message: string) => {
      if (runIdRef.current !== runId) return;
      stopPolling();
      isRunningRef.current = false;
      setResult({ ok: false, mode: "", input: "", output: "", cli_stdout: message });
      setStatus("error");
    };

    try {
      const jobId = await invokeTauri<string>("execute_tool", {
        request: {
          tool_id: "excel_html_converter",
          input: { input_path: inputPath },
          options: {
            zip: zipOutput,
            converter_dir: converterDir ?? "",
          },
        },
      });

      if (runIdRef.current !== runId) return;

      const pollJob = async () => {
        if (runIdRef.current !== runId) return;

        try {
          const job = await invokeTauri<ToolJob<ExcelConversionResult>>("get_job_status", { jobId });
          if (runIdRef.current !== runId) return;

          if (job.status === "queued" || job.status === "running") {
            pollTimerRef.current = setTimeout(() => { void pollJob(); }, 500);
            return;
          }

          stopPolling();
          isRunningRef.current = false;

          if (job.status === "succeeded" && job.result) {
            setResult(job.result);
            setStatus(job.result.ok ? "success" : "error");
            return;
          }

          finishWithError(job.error ?? "Tool execution failed without an error message.");
        } catch (err: any) {
          const message = typeof err === "string" ? err : JSON.stringify(err);
          finishWithError(message);
        }
      };

      pollTimerRef.current = setTimeout(() => { void pollJob(); }, 500);
    } catch (err: any) {
      const msg = typeof err === "string" ? err : JSON.stringify(err);
      finishWithError(msg);
    }
  };

  // Tauri webview file drop (works where React HTML5 D&D fails)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const tauriApi = (await import("@tauri-apps/api/webview")).getCurrentWebview;
        unlisten = await tauriApi().onDragDropEvent((event: any) => {
          const payload = event.payload;

          if (payload.type === "over") {
            setIsDragging(true);
          } else if (payload.type === "drop") {
            setIsDragging(false);
            const paths = payload.paths ?? [];
            if (paths.length === 0) return;
            const droppedPath = paths[0];
            const nameLower = droppedPath.toLowerCase();
            if (!nameLower.endsWith(".xlsx")) {
              setStatus("error");
              setResult({ ok: false, mode: "", input: "", output: "", cli_stdout: "Only .xlsx files are accepted." });
              return;
            }
            setInputPath(droppedPath);
            setResult(null);
            setStatus("idle");
          } else {
            setIsDragging(false);
          }
        });
      } catch {
        // non-Tauri environment — skip
      }
    })();
    return () => { unlisten?.(); };
  }, []);

  return (
    <div className="phase4-prototype">
      <h3>Excel Converter</h3>
      <p style={{ fontSize: ".85rem", color: "#64748b" }}>
        Pick an Excel file, convert it, and preview the generated HTML.
      </p>

      <div className="engine-status" style={{ marginBottom: 8 }}>
        <span className="engine-ready">Built-in converter ready</span>
      </div>

      <div className="form-fields">
        <div className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`}>
          <div className="drop-zone-text">Drag and drop an Excel file here</div>
          <div className="drop-zone-subtext">or use Select Excel file button below</div>
        </div>

        <button
          className="btn btn-outline file-select-button"
          onClick={pickFile}
          disabled={status === "running"}
          style={{ marginTop: 8 }}
        >
          Select Excel file
        </button>

        {inputPath && (
          <div className="path-display">Selected file: {getFileName(inputPath)}</div>
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
          {status === "error" && (
            <div style={{ color: "#dc2626", marginTop: 12 }}>❌ {result.cli_stdout}</div>
          )}
          {status === "success" && (
            <>
              <div className="success-summary" style={{ marginTop: 12, marginBottom: 4 }}>
                ✅ Conversion successful. Preview is ready below.
              </div>

              <details className="debug-details">
                <summary>Debug details</summary>
                <div className="debug-row">
                  <span className="debug-label">Input</span>
                  <div className="debug-value">{result.input}</div>
                </div>
                <div className="debug-row">
                  <span className="debug-label">Output</span>
                  <div className="debug-value">{result.output}</div>
                </div>
                <div className="debug-row">
                  <span className="debug-label">Mode</span>
                  <div className="debug-value">{result.mode}</div>
                </div>
                {result.cli_stdout && (
                  <div className="debug-row">
                    <span className="debug-label">CLI output</span>
                    <pre className="result-output">{result.cli_stdout}</pre>
                  </div>
                )}
              </details>

              {result.preview_html && (
                <>
                  <div style={{ marginTop: 12, marginBottom: 4 }}>HTML Preview:</div>
                  <iframe
                    title="Excel HTML Preview"
                    srcDoc={result.preview_html}
                    sandbox="allow-scripts"
                    className="html-preview-frame"
                  />
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Plan Status Indicator ── */}
      <div className="plan-status-indicator">
        <span className={`plan-label plan-label-${currentPlan}`}>Current plan: {currentPlan}</span>
        {currentPlan === "free" && (
          <span className="plan-sublabel">Upgrade available</span>
        )}
      </div>

      {/* ── Pro Features ── */}
      <div className="pro-features-section">
        <div className="pro-features-title">Pro features</div>
        <p className="pro-features-desc">
          These features will be available with a Pro plan. Sign-in and payment are not implemented yet.
        </p>

        <div className="pro-feature-grid">
          <div className="pro-feature-card" onClick={() => setShowUpgradeMessage(true)}>
            <div className="pro-feature-icon">📦</div>
            <div className="pro-feature-name">Export HTML</div>
            <div className="pro-feature-desc">Download the full converted HTML file</div>
            <span className="pro-badge">Pro</span>
          </div>

          <div className="pro-feature-card" onClick={() => setShowUpgradeMessage(true)}>
            <div className="pro-feature-icon">📁</div>
            <div className="pro-feature-name">Advanced ZIP export</div>
            <div className="pro-feature-desc">Package multiple files with advanced ZIP options</div>
            <span className="pro-badge">Pro</span>
          </div>

          <div className="pro-feature-card" onClick={() => setShowUpgradeMessage(true)}>
            <div className="pro-feature-icon">🔁</div>
            <div className="pro-feature-name">Batch conversion</div>
            <div className="pro-feature-desc">Convert multiple files at once</div>
            <span className="pro-badge">Pro</span>
          </div>

          <div className="pro-feature-card" onClick={() => setShowUpgradeMessage(true)}>
            <div className="pro-feature-icon">📄</div>
            <div className="pro-feature-name">Larger file support</div>
            <div className="pro-feature-desc">Remove file size limits for big workbooks</div>
            <span className="pro-badge">Pro</span>
          </div>
        </div>

        {showUpgradeMessage && (
          <div className="upgrade-message">
            <p>This feature will be available in Pro.<br />Sign-in and payment are not implemented yet.</p>
            <div className="upgrade-buttons">
              <button
                className="btn btn-primary"
                onClick={() => setShowUpgradeMessage(false)}
              >
                Upgrade to Pro (coming soon)
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowUpgradeMessage(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
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
