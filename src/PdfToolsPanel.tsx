import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import "./PdfToolsPanel.css";

type PdfToolsPanelProps = {
  onBack: () => void;
};

type SelectedPdf = {
  name: string;
  path?: string;
};

type ToolJobStatus = "queued" | "running" | "succeeded" | "failed";

type ToolJob<T> = {
  job_id: string;
  tool_id: string;
  status: ToolJobStatus;
  created_at: number;
  result?: T | null;
  error?: string | null;
};

type PdfMergeResult = {
  output_path: string;
  input_count: number;
  page_count: number;
};

const plannedPageTools = [
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

const PDF_MERGE_TOOL_ID = "pdf_merge";
const POLL_INTERVAL_MS = 500;

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function mergeFailureMessage(): string {
  return "Merge failed. Check that the selected files are valid PDFs and the output location is writable.";
}

export default function PdfToolsPanel({ onBack }: PdfToolsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  const isRunningRef = useRef(false);
  const [selectedPdfs, setSelectedPdfs] = useState<SelectedPdf[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<PdfMergeResult | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nativeDialogAvailable = isTauri();

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

  const selectPdfs = async () => {
    if (isRunningRef.current) return;
    setFeedback(null);
    setError(null);
    setMergeResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPaths = await open({
          multiple: true,
          directory: false,
          title: "Select PDF documents",
          filters: [{ name: "PDF documents", extensions: ["pdf"] }],
        });
        if (!Array.isArray(selectedPaths)) return;

        const pdfs = selectedPaths
          .filter((path): path is string => typeof path === "string" && path.toLowerCase().endsWith(".pdf"))
          .map((path) => ({ name: fileNameFromPath(path), path }));

        if (pdfs.length === 0) {
          setError("Please select one or more PDF files.");
          return;
        }

        setSelectedPdfs(pdfs);
        setFeedback(`${pdfs.length} PDF file${pdfs.length === 1 ? "" : "s"} selected.`);
        return;
      } catch {
        setError("The native PDF picker is unavailable. Desktop file path selection is required to merge PDFs.");
      }
    }

    fileInputRef.current?.click();
  };

  const selectBrowserPdfs = (files: FileList | null, input: HTMLInputElement) => {
    if (!files?.length) return;
    setFeedback(null);
    setError(null);
    setMergeResult(null);

    const selectedFiles = Array.from(files);
    const invalidFile = selectedFiles.some(
      (file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"),
    );

    if (invalidFile) {
      setError("Please select PDF files only.");
      input.value = "";
      return;
    }

    setSelectedPdfs(selectedFiles.map((file) => ({ name: file.name })));
    setError("Desktop file path selection is required to merge PDFs.");
    input.value = "";
  };

  const clearSelection = () => {
    if (isRunningRef.current) return;
    setSelectedPdfs([]);
    setMergeResult(null);
    setFeedback("PDF selection cleared.");
    setError(null);
  };

  const selectOutputPdf = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setFeedback(null);
    setError(null);
    setMergeResult(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await save({
        defaultPath: "merged-document.pdf",
        title: "Select output PDF",
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (!selectedPath) return;

      if (!selectedPath.toLowerCase().endsWith(".pdf")) {
        setError("The output file must use the .pdf extension.");
        return;
      }

      setOutputPath(selectedPath);
      setFeedback(`Output selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setError("The output PDF could not be selected.");
    }
  };

  const mergePdfs = async () => {
    if (isRunningRef.current) return;

    const inputPaths = selectedPdfs.flatMap((pdf) => (pdf.path ? [pdf.path] : []));
    if (selectedPdfs.length < 2 || inputPaths.length !== selectedPdfs.length || !outputPath) {
      setError("Select at least two PDFs and an output PDF in the desktop app first.");
      return;
    }

    stopPolling();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    isRunningRef.current = true;
    setIsMerging(true);
    setMergeResult(null);
    setFeedback(null);
    setError(null);

    const finishWithError = () => {
      if (runIdRef.current !== runId) return;
      stopPolling();
      isRunningRef.current = false;
      setIsMerging(false);
      setMergeResult(null);
      setFeedback(null);
      setError(mergeFailureMessage());
    };

    try {
      const jobId = await invoke<string>("execute_tool", {
        request: {
          tool_id: PDF_MERGE_TOOL_ID,
          input: {
            input_paths: inputPaths,
            output_path: outputPath,
          },
          options: {},
        },
      });

      if (runIdRef.current !== runId) return;

      const pollJob = async () => {
        if (runIdRef.current !== runId) return;

        try {
          const job = await invoke<ToolJob<PdfMergeResult>>("get_job_status", { jobId });
          if (runIdRef.current !== runId) return;

          if (job.status === "queued" || job.status === "running") {
            pollTimerRef.current = setTimeout(() => {
              void pollJob();
            }, POLL_INTERVAL_MS);
            return;
          }

          stopPolling();
          isRunningRef.current = false;
          setIsMerging(false);

          if (job.status === "succeeded" && job.result) {
            setMergeResult(job.result);
            setFeedback("Merge completed");
            setError(null);
            return;
          }

          finishWithError();
        } catch {
          finishWithError();
        }
      };

      pollTimerRef.current = setTimeout(() => {
        void pollJob();
      }, POLL_INTERVAL_MS);
    } catch {
      finishWithError();
    }
  };

  const hasDesktopInputPaths =
    selectedPdfs.length > 0 && selectedPdfs.every((pdf) => typeof pdf.path === "string");
  const canMerge =
    nativeDialogAvailable &&
    selectedPdfs.length >= 2 &&
    hasDesktopInputPaths &&
    outputPath !== null &&
    !isMerging;

  return (
    <div className="pdf-tools-page">
      <button type="button" className="btn btn-outline" onClick={onBack} disabled={isMerging}>
        ← Back to Tools
      </button>

      <div className="page-header pdf-tools-header">
        <div>
          <h1>PDF Tools</h1>
          <p>Local PDF workflow foundation</p>
        </div>
        <span className="pdf-tools-planned-badge">Merge MVP · Other tools planned</span>
      </div>

      <div className="pdf-tools-notice" role="note">
        <strong>Merge PDFs is available as a local MVP.</strong>
        <span>Other PDF page tools are planned. Selected files stay on this device.</span>
      </div>

      <div className="pdf-tools-workflow-grid">
        <section className="pdf-tools-panel" aria-labelledby="pdf-input-title">
          <div className="pdf-tools-section-heading">
            <span>Step 1</span>
            <h2 id="pdf-input-title">Input PDFs</h2>
            <p>Select two or more local PDFs. Files are merged in the order shown below.</p>
          </div>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-primary" onClick={selectPdfs} disabled={isMerging}>
              Select PDFs
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={clearSelection}
              disabled={selectedPdfs.length === 0 || isMerging}
            >
              Clear selection
            </button>
          </div>
          <input
            ref={fileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={(event) => selectBrowserPdfs(event.currentTarget.files, event.currentTarget)}
          />

          <div className="pdf-tools-selection-summary">
            <span>Input count</span>
            <strong>{selectedPdfs.length}</strong>
          </div>

          {selectedPdfs.length > 0 ? (
            <ol className="pdf-tools-file-list">
              {selectedPdfs.map((pdf, index) => (
                <li key={`${pdf.name}-${index}`}>
                  <span>{index + 1}</span>
                  <strong title={pdf.name}>{pdf.name}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pdf-tools-empty-selection">No PDFs selected.</p>
          )}

          {!hasDesktopInputPaths && selectedPdfs.length > 0 && (
            <p className="pdf-tools-desktop-note">Desktop file path selection is required to merge PDFs.</p>
          )}
        </section>

        <section className="pdf-tools-panel" aria-labelledby="pdf-output-title">
          <div className="pdf-tools-section-heading">
            <span>Step 2</span>
            <h2 id="pdf-output-title">Output PDF</h2>
            <p>Choose where the Rust PDF merge bridge should write the merged document.</p>
          </div>

          <button
            type="button"
            className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
            onClick={selectOutputPdf}
            disabled={!nativeDialogAvailable || isMerging}
          >
            {nativeDialogAvailable ? "Select output PDF" : "Select output PDF (Desktop only)"}
          </button>

          <dl className="pdf-tools-selection-details">
            <div>
              <dt>Output file</dt>
              <dd className="pdf-tools-path" title={outputPath ?? undefined}>
                {outputPath ? fileNameFromPath(outputPath) : "Not selected"}
              </dd>
            </div>
            <div>
              <dt>Default name</dt>
              <dd>merged-document.pdf</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="pdf-tools-section pdf-tools-merge" aria-labelledby="pdf-merge-title">
        <div className="pdf-tools-section-heading">
          <span>Step 3</span>
          <h2 id="pdf-merge-title">Merge PDFs</h2>
          <p>Uses the existing local Rust merge core through the shared tool execution queue.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={mergePdfs} disabled={!canMerge}>
          {isMerging ? "Merging..." : "Merge PDFs"}
        </button>
        {!canMerge && !isMerging && (
          <p className="pdf-tools-merge-requirements">
            Select at least two desktop PDF paths and one output PDF to enable merge.
          </p>
        )}
      </section>

      {isMerging && (
        <div className="pdf-tools-feedback pdf-tools-feedback-loading" role="status" aria-live="polite">
          Merging...
        </div>
      )}
      {error && (
        <div className="pdf-tools-feedback pdf-tools-feedback-error" role="alert">
          {error}
        </div>
      )}
      {!error && !isMerging && feedback && (
        <div className="pdf-tools-feedback" role="status" aria-live="polite">
          <strong>{feedback}</strong>
          {mergeResult && (
            <span>
              {mergeResult.input_count} PDFs · {mergeResult.page_count} pages · Output: {fileNameFromPath(mergeResult.output_path)}
            </span>
          )}
        </div>
      )}

      <section className="pdf-tools-section" aria-labelledby="planned-pdf-tools-title">
        <div className="pdf-tools-section-heading">
          <span>Planned foundation</span>
          <h2 id="planned-pdf-tools-title">Planned PDF page tools</h2>
          <p>These operations remain disabled and are not part of the merge MVP.</p>
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
          <li>Merge PDFs is available as an MVP; other PDF page tools are planned.</li>
          <li>Direct text editing, OCR, and redaction are not implemented.</li>
          <li>Redaction must remove underlying content, not only cover it visually.</li>
          <li>PDF files stay on this device and are processed locally.</li>
        </ul>
      </section>
    </div>
  );
}
