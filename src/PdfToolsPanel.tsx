import { useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import "./PdfToolsPanel.css";

type PdfToolsPanelProps = {
  onBack: () => void;
};

type SelectedPdf = {
  name: string;
  path?: string;
};

const plannedPageTools = [
  "Merge PDFs",
  "Split PDF",
  "Extract pages",
  "Delete pages",
  "Rotate pages",
  "Reorder pages",
] as const;

const futureAdvancedTools = [
  "Add page numbers",
  "Add watermark",
  "Add text stamp",
  "Add image stamp",
  "PDF to images",
  "Images to PDF",
  "Safe redaction",
  "OCR-assisted workflow",
] as const;

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export default function PdfToolsPanel({ onBack }: PdfToolsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPdf, setSelectedPdf] = useState<SelectedPdf | null>(null);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nativeDialogAvailable = isTauri();

  const selectPdf = async () => {
    setFeedback(null);
    setError(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        setSelectedPdf({ name: fileNameFromPath(selectedPath), path: selectedPath });
        setFeedback("PDF selected. No file content was read or processed.");
        return;
      } catch {
        setError("The native PDF picker is unavailable. Use the browser file picker instead.");
      }
    }

    fileInputRef.current?.click();
  };

  const selectBrowserPdf = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setFeedback(null);
    setError(null);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setSelectedPdf({ name: file.name });
    setFeedback("PDF selected. No file content was read or processed.");
    input.value = "";
  };

  const selectOutputFolder = async () => {
    if (!nativeDialogAvailable) return;
    setFeedback(null);
    setError(null);

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await open({
        multiple: false,
        directory: true,
        title: "Select output folder",
      });
      if (typeof selectedPath !== "string") return;
      setOutputFolder(selectedPath);
      setFeedback("Output folder selected. No file will be written in this foundation release.");
    } catch {
      setError("The output folder could not be selected.");
    }
  };

  return (
    <div className="pdf-tools-page">
      <button type="button" className="btn btn-outline" onClick={onBack}>
        ← Back to Tools
      </button>

      <div className="page-header pdf-tools-header">
        <div>
          <h1>PDF Tools</h1>
          <p>PDF workflow foundation</p>
        </div>
        <span className="pdf-tools-planned-badge">Planned · Not implemented yet</span>
      </div>

      <div className="pdf-tools-notice" role="note">
        <strong>PDF processing is planned and not available yet.</strong>
        <span>No upload, no network, no external service. Selected files stay on this device and are not processed yet.</span>
      </div>

      <div className="pdf-tools-workflow-grid">
        <section className="pdf-tools-panel" aria-labelledby="pdf-input-title">
          <div className="pdf-tools-section-heading">
            <span>Step 1</span>
            <h2 id="pdf-input-title">Input PDF</h2>
            <p>Select one local PDF. Only its file name and optional local path are displayed.</p>
          </div>

          <button type="button" className="btn btn-primary" onClick={selectPdf}>
            Select PDF
          </button>
          <input
            ref={fileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => selectBrowserPdf(event.currentTarget.files?.[0], event.currentTarget)}
          />

          <dl className="pdf-tools-selection-details">
            <div>
              <dt>Selected file</dt>
              <dd>{selectedPdf?.name ?? "Not selected"}</dd>
            </div>
            <div>
              <dt>Local path</dt>
              <dd className="pdf-tools-path" title={selectedPdf?.path}>
                {selectedPdf?.path ?? "Not available in browser fallback"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="pdf-tools-panel" aria-labelledby="pdf-output-title">
          <div className="pdf-tools-section-heading">
            <span>Step 2</span>
            <h2 id="pdf-output-title">Output destination</h2>
            <p>This preview does not create or write an output file.</p>
          </div>

          <button
            type="button"
            className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
            onClick={selectOutputFolder}
            disabled={!nativeDialogAvailable}
          >
            {nativeDialogAvailable ? "Select output folder" : "Select output folder (Desktop only)"}
          </button>

          <dl className="pdf-tools-selection-details">
            <div>
              <dt>Output folder</dt>
              <dd className="pdf-tools-path" title={outputFolder ?? undefined}>
                {outputFolder ?? "Not selected"}
              </dd>
            </div>
            <div>
              <dt>Output file name preview</dt>
              <dd>edited-document.pdf</dd>
            </div>
          </dl>
        </section>
      </div>

      {error && (
        <div className="pdf-tools-feedback pdf-tools-feedback-error" role="alert">
          {error}
        </div>
      )}
      {!error && feedback && (
        <div className="pdf-tools-feedback" role="status">
          {feedback}
        </div>
      )}

      <section className="pdf-tools-section" aria-labelledby="planned-pdf-tools-title">
        <div className="pdf-tools-section-heading">
          <span>Planned foundation</span>
          <h2 id="planned-pdf-tools-title">Planned PDF page tools</h2>
          <p>Page-level operations will be considered before direct PDF text editing.</p>
        </div>
        <div className="pdf-tools-feature-grid">
          {plannedPageTools.map((tool) => (
            <article className="pdf-tools-feature-card" key={tool}>
              <h3>{tool}</h3>
              <p>Not implemented yet</p>
              <button type="button" className="btn btn-disabled" disabled>
                Planned
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="pdf-tools-section" aria-labelledby="advanced-pdf-tools-title">
        <div className="pdf-tools-section-heading">
          <span>Later research</span>
          <h2 id="advanced-pdf-tools-title">Future advanced PDF tools</h2>
          <p>These are longer-term candidates and are not commitments for the next release.</p>
        </div>
        <div className="pdf-tools-future-list">
          {futureAdvancedTools.map((tool) => (
            <span key={tool}>{tool}</span>
          ))}
        </div>
      </section>

      <section className="pdf-tools-section pdf-tools-safety" aria-labelledby="pdf-safety-title">
        <div className="pdf-tools-section-heading">
          <span>Important</span>
          <h2 id="pdf-safety-title">Safety notes</h2>
        </div>
        <ul>
          <li>PDF page operations will be implemented before direct text editing.</li>
          <li>Direct text replacement in existing PDFs is complex and planned for later research.</li>
          <li>Redaction must remove underlying content, not only cover it visually.</li>
          <li>No PDF content is modified in this foundation release.</li>
        </ul>
      </section>
    </div>
  );
}
