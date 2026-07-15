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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Conversion failed. Check the input and try again.";
}

export default function ConverterToolsPanel({ onBack }: { onBack: () => void }) {
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

      <section className="converter-tools-shell" aria-labelledby="converter-title">
        <div className="converter-tools-tabs" role="tablist" aria-label="Converter categories">
          {categories.map((item) => (
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
