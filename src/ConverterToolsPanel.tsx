import { useState } from "react";
import "./ConverterToolsPanel.css";
import {
  csvToJson,
  decodeBase64,
  decodeUrl,
  encodeBase64,
  encodeUrl,
  formatJson,
  jsonToCsv,
  markdownToHtml,
  minifyJson,
} from "./converterUtils";

type ConverterCategory = "json" | "csv-json" | "markdown" | "base64" | "url";

type ConverterAction = {
  label: string;
  transform: (input: string) => string;
};

const categories: readonly {
  id: ConverterCategory;
  label: string;
  title: string;
  description: string;
  placeholder: string;
  actions: readonly ConverterAction[];
}[] = [
  {
    id: "json",
    label: "JSON",
    title: "JSON Formatter / Minifier",
    description: "Format readable JSON or remove unnecessary whitespace.",
    placeholder: '{\n  "name": "Utility Tools Hub"\n}',
    actions: [
      { label: "Format JSON", transform: formatJson },
      { label: "Minify JSON", transform: minifyJson },
    ],
  },
  {
    id: "csv-json",
    label: "CSV / JSON",
    title: "CSV / JSON Converter",
    description: "Convert a header-based CSV document to JSON, or an object array to CSV.",
    placeholder: 'name,description\nUtility Tools Hub,"Local, lightweight tools"',
    actions: [
      { label: "CSV to JSON", transform: csvToJson },
      { label: "JSON to CSV", transform: jsonToCsv },
    ],
  },
  {
    id: "markdown",
    label: "Markdown",
    title: "Markdown to HTML",
    description: "Convert simple headings, paragraphs, lists, emphasis, and inline code to HTML source.",
    placeholder: "# Heading\n\nA **bold** paragraph.\n\n- First item\n- Second item",
    actions: [{ label: "Convert to HTML", transform: markdownToHtml }],
  },
  {
    id: "base64",
    label: "Base64",
    title: "Base64 Encode / Decode",
    description: "Encode or decode UTF-8 text, including Japanese characters.",
    placeholder: "Enter text or Base64 data",
    actions: [
      { label: "Encode Base64", transform: encodeBase64 },
      { label: "Decode Base64", transform: decodeBase64 },
    ],
  },
  {
    id: "url",
    label: "URL",
    title: "URL Encode / Decode",
    description: "Encode or decode text with URL component rules.",
    placeholder: "https://example.com/search?q=local tools",
    actions: [
      { label: "Encode URL", transform: encodeUrl },
      { label: "Decode URL", transform: decodeUrl },
    ],
  },
];

const categoryGroups: readonly {
  title: string;
  description: string;
  categoryIds: readonly ConverterCategory[];
}[] = [
  {
    title: "Data converters",
    description: "Format JSON and convert between CSV and JSON.",
    categoryIds: ["json", "csv-json"],
  },
  {
    title: "Text converters",
    description: "Open the dedicated Text Case tool or convert Markdown, Base64, and URL-encoded text.",
    categoryIds: ["markdown", "base64", "url"],
  },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Conversion failed. Check the input and try again.";
}

export default function ConverterToolsPanel({
  onBack,
  onOpenExcelConverter,
  onOpenTextCaseConverter,
}: {
  onBack: () => void;
  onOpenExcelConverter: () => void;
  onOpenTextCaseConverter: () => void;
}) {
  const [categoryId, setCategoryId] = useState<ConverterCategory>("json");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const category = categories.find((item) => item.id === categoryId) ?? categories[0];

  const resetFeedback = () => {
    setError("");
    setMessage("");
  };

  const selectCategory = (nextCategory: ConverterCategory) => {
    setCategoryId(nextCategory);
    setInput("");
    setOutput("");
    resetFeedback();
  };

  const convert = (action: ConverterAction) => {
    resetFeedback();
    if (input.trim() === "") {
      setOutput("");
      setMessage("Enter input to start converting.");
      return;
    }

    try {
      setOutput(action.transform(input));
      setMessage(`${action.label} completed locally.`);
    } catch (conversionError) {
      setOutput("");
      setError(errorMessage(conversionError));
    }
  };

  const clear = () => {
    setInput("");
    setOutput("");
    resetFeedback();
  };

  const copyOutput = async () => {
    resetFeedback();
    if (output === "") {
      setMessage("There is no output to copy yet.");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setError("Clipboard access is not available in this environment.");
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
      setMessage("Output copied to the clipboard.");
    } catch {
      setError("Output could not be copied. Check clipboard permissions and try again.");
    }
  };

  return (
    <div className="converter-tools-page">
      <button type="button" className="btn btn-outline" onClick={onBack}>
        ← Back to Tools
      </button>

      <div className="page-header converter-tools-heading">
        <div>
          <h1>Converter Tools</h1>
          <p>Lightweight local converters</p>
        </div>
        <span className="converter-tools-plan">Free Preview · Available</span>
      </div>

      <div className="converter-tools-local-note" role="note">
        No upload, no network, no external service. Input stays in this screen and is not saved.
      </div>

      <section className="converter-tools-file-section" aria-labelledby="file-converters-title">
        <div className="converter-tools-section-heading">
          <div>
            <h2 id="file-converters-title">File converters</h2>
            <p>Open an existing tool for file-based conversion.</p>
          </div>
        </div>

        <article className="converter-tools-file-card">
          <div>
            <span className="converter-tools-card-eyebrow">Available · Free Preview</span>
            <h3>Excel → HTML Converter</h3>
            <p>Convert Excel workbooks into HTML previews.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={onOpenExcelConverter}>
            Open Excel Converter
          </button>
        </article>
      </section>

      <section className="converter-tools-shell" aria-labelledby="converter-title">
        <div className="converter-tools-tab-groups">
          {categoryGroups.map((group) => (
            <div className="converter-tools-tab-group" key={group.title}>
              <div className="converter-tools-tab-group-heading">
                <h2>{group.title}</h2>
                <p>{group.description}</p>
              </div>
              {group.title === "Text converters" && (
                <article className="converter-tools-text-case-card">
                  <div>
                    <span className="converter-tools-card-eyebrow">Dedicated text tool</span>
                    <h3>Text Case Converter</h3>
                    <p>Convert text to uppercase, lowercase, title case, snake_case, and kebab-case.</p>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={onOpenTextCaseConverter}>
                    Open Text Case Converter
                  </button>
                </article>
              )}
              <div className="converter-tools-tabs" role="tablist" aria-label={group.title}>
                {categories
                  .filter((item) => group.categoryIds.includes(item.id))
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={categoryId === item.id}
                      className={categoryId === item.id ? "active" : ""}
                      onClick={() => selectCategory(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="converter-tools-card" role="tabpanel">
          <div className="converter-tools-card-heading">
            <div>
              <h2 id="converter-title">{category.title}</h2>
              <p>{category.description}</p>
            </div>
            <button type="button" className="converter-clear-button" onClick={clear}>
              Clear
            </button>
          </div>

          <div className="converter-editor-grid">
            <label className="converter-field">
              <span>Input</span>
              <textarea
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  resetFeedback();
                }}
                placeholder={category.placeholder}
                spellCheck={false}
              />
            </label>

            <label className="converter-field">
              <span>Output</span>
              <textarea value={output} readOnly placeholder="Converted output appears here" spellCheck={false} />
            </label>
          </div>

          <div className="converter-tools-actions">
            <div className="converter-primary-actions">
              {category.actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="converter-action-button"
                  onClick={() => convert(action)}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <button type="button" className="converter-copy-button" onClick={copyOutput}>
              Copy output
            </button>
          </div>

          {error && (
            <div className="converter-feedback converter-feedback-error" role="alert">
              {error}
            </div>
          )}
          {!error && message && (
            <div className="converter-feedback" role="status">
              {message}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
