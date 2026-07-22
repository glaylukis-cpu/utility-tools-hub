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

type PdfSplitResult = {
  input_path: string;
  output_paths: string[];
  page_count: number;
};

type PdfExtractResult = {
  input_path: string;
  output_path: string;
  selected_pages: number[];
  page_count: number;
};

type PdfRotateResult = {
  input_path: string;
  output_path: string;
  rotated_pages: number[];
  angle_degrees: number;
  page_count: number;
};

type PdfDeleteResult = {
  input_path: string;
  output_path: string;
  deleted_pages: number[];
  original_page_count: number;
  remaining_page_count: number;
};

type PdfReorderResult = {
  input_path: string;
  output_path: string;
  page_order: number[];
  page_count: number;
};

type PdfInspectResult = {
  input_path: string;
  file_name: string;
  file_size_bytes: number;
  pdf_version: string;
  page_count: number;
  is_encrypted: boolean;
  is_protected: boolean;
  title: string | null;
  author: string | null;
  creator: string | null;
  producer: string | null;
};

type OperationInputSummaryState = {
  loading: boolean;
  error: string | null;
  result: PdfInspectResult | null;
};

type MergeInputSummaryState = OperationInputSummaryState & {
  order: number;
  inputPath?: string;
  fileName: string;
};

type PageParseResult =
  | { pages: number[]; error: null }
  | { pages: null; error: string };

type PagePlanParseResult = {
  pages: number[];
  error: string | null;
};

type PageOrderParseResult = {
  pageOrder: number[];
  invalidEntries: boolean;
  duplicatePages: number[];
  outOfRangePages: number[];
  missingPages: number[];
  isValid: boolean;
};

const plannedPageTools = [
  "Drag-and-drop reorder",
  "Real PDF page preview",
  "Page thumbnails",
  "Page numbers",
  "Watermark",
  "Overlay writing",
] as const;

const researchTools = [
  "Safe redaction",
  "OCR-assisted workflow",
  "Direct PDF text editing",
] as const;

const PDF_MERGE_TOOL_ID = "pdf_merge";
const PDF_SPLIT_TOOL_ID = "pdf_split";
const PDF_EXTRACT_TOOL_ID = "pdf_extract";
const PDF_ROTATE_TOOL_ID = "pdf_rotate";
const PDF_DELETE_TOOL_ID = "pdf_delete";
const PDF_REORDER_TOOL_ID = "pdf_reorder";
const PDF_INSPECT_TOOL_ID = "pdf_inspect";
const POLL_INTERVAL_MS = 500;
const MAX_EXPANDED_PAGES = 10_000;
const MAX_VISIBLE_PLAN_PAGES = 18;

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function formatFileSize(sizeInBytes: number): string {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes < 0) return "Unknown";
  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
  if (sizeInBytes < 1024 ** 2) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  if (sizeInBytes < 1024 ** 3) return `${(sizeInBytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(sizeInBytes / 1024 ** 3).toFixed(1)} GB`;
}

function inspectFailureMessage(reason?: string | null): string {
  const knownMessages: Record<string, string> = {
    "every input file must use the .pdf extension": "Select a file with the .pdf extension.",
    "an input PDF file does not exist": "The selected PDF could not be found. Select it again.",
    "an input file is not a supported PDF document":
      "Inspect failed. Confirm the file is a valid PDF and try again.",
  };

  return (
    (reason ? knownMessages[reason.trim()] : undefined) ??
    "Inspect failed. Confirm the file is a valid PDF and try again. Protected or damaged PDFs may not expose all summary information."
  );
}

function OperationInputSummary({
  fileName,
  summary,
  guidance,
}: {
  fileName?: string;
  summary: OperationInputSummaryState;
  guidance: string;
}) {
  if (!fileName && !summary.loading && !summary.error && !summary.result) return null;

  const result = summary.result;
  const isProtected = Boolean(result && (result.is_encrypted || result.is_protected));

  return (
    <div className="pdf-tools-operation-input-summary" aria-label="Input PDF summary">
      <div className="pdf-tools-operation-summary-heading">
        <span>Input summary</span>
        <strong title={result?.file_name ?? fileName}>{result?.file_name ?? fileName}</strong>
      </div>

      {summary.loading && (
        <div className="pdf-tools-operation-summary-message is-loading" role="status">
          Inspecting PDF summary...
        </div>
      )}
      {summary.error && !summary.loading && (
        <div className="pdf-tools-operation-summary-message is-error" role="alert">
          <strong>Summary unavailable.</strong>
          <span>{summary.error}</span>
        </div>
      )}
      {result && !summary.loading && (
        <>
          <dl className="pdf-tools-operation-summary-details">
            <div><dt>Size</dt><dd>{formatFileSize(result.file_size_bytes)}</dd></div>
            <div><dt>Pages</dt><dd>{result.page_count}</dd></div>
            <div><dt>PDF version</dt><dd>{result.pdf_version}</dd></div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`pdf-tools-protection-status ${isProtected ? "is-protected" : "is-normal"}`}>
                  {isProtected ? "Protected" : "Normal"}
                </span>
              </dd>
            </div>
          </dl>
          <p className="pdf-tools-operation-summary-guidance">{guidance}</p>
          {isProtected && (
            <div className="pdf-tools-operation-summary-warning" role="alert">
              <strong>Protected PDF</strong>
              <span>This PDF appears to be encrypted or permission-protected.</span>
              <span>Page operations may reject it. Utility Tools Hub does not decrypt PDFs or bypass permissions.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function emptyOperationInputSummary(): OperationInputSummaryState {
  return { loading: false, error: null, result: null };
}

function mergeFailureMessage(reason?: string | null): string {
  const knownMessages: Record<string, string> = {
    "at least two input PDF files are required": "Merge requires at least two input PDF files.",
    "every input file must use the .pdf extension": "Every input file must use the .pdf extension.",
    "the output file must use the .pdf extension": "The output file must use the .pdf extension.",
    "an input PDF file does not exist": "An input PDF could not be found. Select the input files again.",
    "the output directory does not exist": "The selected output folder no longer exists. Choose the output PDF again.",
    "the output file must differ from every input file": "The output PDF must use a different file from every input PDF.",
    "encrypted or permission-protected PDF files are not supported yet":
      "Encrypted or permission-protected PDFs are not supported yet. Remove password or permission protection, then try again.",
    "an input file is not a supported PDF document": "An input PDF could not be read or uses an unsupported PDF structure.",
    "the output PDF could not be saved": "The output PDF could not be written. Choose a writable location and try again.",
  };

  return (
    (reason ? knownMessages[reason.trim()] : undefined) ??
    "Merge failed. Re-select the input PDFs and choose a writable output location, then try again."
  );
}

function splitFailureMessage(): string {
  return "Split failed. Confirm the input is a valid PDF, the output folder is writable, and the prefix is valid.";
}

function extractFailureMessage(): string {
  return "Extract failed. Check the 1-based page selection, input PDF, and writable output location, then try again.";
}

function rotateFailureMessage(): string {
  return "Rotate failed. Check the 1-based page selection, input PDF, angle, and writable output location.";
}

function deleteFailureMessage(): string {
  return "Delete failed. Check the 1-based page selection, keep at least one page, and choose a writable output location.";
}

function reorderFailureMessage(reason?: string | null): string {
  const knownMessages: Record<string, string> = {
    "every input file must use the .pdf extension": "The input file must use the .pdf extension.",
    "the output file must use the .pdf extension": "The output file must use the .pdf extension.",
    "an input PDF file does not exist": "The selected PDF could not be found. Select it again.",
    "the output directory does not exist": "The selected output folder no longer exists. Choose the output PDF again.",
    "the output file must differ from every input file": "The output PDF must be different from the input PDF.",
    "at least one page must be selected": "Enter the full page order before running Reorder pages.",
    "page numbers must be one or greater": "Page order values must be whole numbers greater than zero.",
    "a selected page is outside the input PDF page range": "The page order contains a page outside the input PDF range.",
    "duplicate page numbers are not supported": "Each page must appear exactly once in the page order.",
    "the page order must include every input PDF page exactly once":
      "The page order must include every input PDF page exactly once.",
    "encrypted or permission-protected PDF files are not supported yet":
      "Protected PDFs may be rejected. Utility Tools Hub does not decrypt PDFs or bypass permissions.",
    "an input file is not a supported PDF document": "The input file is not a supported PDF document.",
    "the output PDF could not be saved": "The output PDF could not be saved. Choose a writable location and try again.",
  };

  return (
    (reason ? knownMessages[reason.trim()] : undefined) ??
    "Reorder failed. Check the full page order, input PDF, and writable output location, then try again."
  );
}

function parsePageSelection(value: string): PageParseResult {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { pages: null, error: "Enter one or more page numbers." };
  }

  const pages: number[] = [];
  const seenPages = new Set<number>();

  const addPage = (page: number): string | null => {
    if (!Number.isSafeInteger(page) || page < 1) {
      return "Page numbers must be one or greater.";
    }
    if (seenPages.has(page)) {
      return `Page ${page} is specified more than once.`;
    }
    if (pages.length >= MAX_EXPANDED_PAGES) {
      return "The page selection is too large.";
    }

    seenPages.add(page);
    pages.push(page);
    return null;
  };

  for (const part of trimmedValue.split(",")) {
    const token = part.trim();
    if (!token) {
      return { pages: null, error: "Use page numbers separated by commas." };
    }

    const rangeMatch = token.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1) {
        return { pages: null, error: "Page numbers must be one or greater." };
      }
      if (end < start) {
        return { pages: null, error: "Page ranges must be written from lower to higher." };
      }
      if (end - start + 1 > MAX_EXPANDED_PAGES) {
        return { pages: null, error: "The page range is too large." };
      }

      for (let page = start; page <= end; page += 1) {
        const error = addPage(page);
        if (error) return { pages: null, error };
      }
      continue;
    }

    if (!/^\d+$/.test(token)) {
      return { pages: null, error: "Use page numbers such as 1,3,5 or 1-3,5." };
    }

    const error = addPage(Number(token));
    if (error) return { pages: null, error };
  }

  return { pages, error: null };
}

function parsePageSelectionForPlan(value: string, pageCount?: number | null): PagePlanParseResult {
  const parsed = parsePageSelection(value);
  if (!parsed.pages) return { pages: [], error: parsed.error };

  const pages = [...new Set(parsed.pages)];
  if (typeof pageCount === "number" && pageCount > 0) {
    const firstOutOfRangePage = pages.find((page) => page > pageCount);
    if (firstOutOfRangePage !== undefined) {
      return {
        pages,
        error: `Page ${firstOutOfRangePage} is outside this ${pageCount}-page PDF.`,
      };
    }
  }

  return { pages, error: null };
}

function parsePageOrder(value: string, pageCount?: number | null): PageOrderParseResult {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return {
      pageOrder: [],
      invalidEntries: false,
      duplicatePages: [],
      outOfRangePages: [],
      missingPages: [],
      isValid: false,
    };
  }

  const pageOrder: number[] = [];
  let invalidEntries = false;

  for (const part of trimmedValue.split(",")) {
    const token = part.trim();
    if (!/^\d+$/.test(token)) {
      invalidEntries = true;
      continue;
    }

    const page = Number(token);
    if (!Number.isSafeInteger(page) || page < 1) {
      invalidEntries = true;
      continue;
    }
    pageOrder.push(page);
  }

  const seenPages = new Set<number>();
  const duplicatePages = [...new Set(pageOrder.filter((page) => {
    if (seenPages.has(page)) return true;
    seenPages.add(page);
    return false;
  }))];
  const hasPageCount = typeof pageCount === "number" && pageCount > 0;
  const outOfRangePages = hasPageCount
    ? [...new Set(pageOrder.filter((page) => page > pageCount))]
    : [];
  const includedPages = new Set(pageOrder);
  const missingPages = hasPageCount
    ? Array.from({ length: pageCount }, (_, index) => index + 1).filter((page) => !includedPages.has(page))
    : [];
  const isValid = Boolean(
    hasPageCount &&
      !invalidEntries &&
      duplicatePages.length === 0 &&
      outOfRangePages.length === 0 &&
      missingPages.length === 0 &&
      pageOrder.length === pageCount,
  );

  return {
    pageOrder,
    invalidEntries,
    duplicatePages,
    outOfRangePages,
    missingPages,
    isValid,
  };
}

function PlanPageChips({
  pages,
  emptyLabel = "Enter pages to preview targets.",
}: {
  pages: number[];
  emptyLabel?: string;
}) {
  if (pages.length === 0) {
    return <span className="pdf-tools-operation-plan-empty">{emptyLabel}</span>;
  }

  const visiblePages = pages.slice(0, MAX_VISIBLE_PLAN_PAGES);
  const hiddenPageCount = pages.length - visiblePages.length;

  return (
    <div className="pdf-tools-operation-plan-chips" aria-label={`${pages.length} selected pages`}>
      {visiblePages.map((page, index) => <span key={`${page}-${index}`}>{page}</span>)}
      {hiddenPageCount > 0 && <span className="is-more">+{hiddenPageCount} more</span>}
    </div>
  );
}

function SplitOperationPlan({
  summary,
  outputPrefix,
}: {
  summary: OperationInputSummaryState;
  outputPrefix: string;
}) {
  const result = summary.result;
  const pageCount = result?.page_count ?? null;
  const isProtected = Boolean(result && (result.is_encrypted || result.is_protected));
  const prefix = outputPrefix.trim();
  const validPrefix = prefix.length > 0 && !/[\\/]/.test(prefix);
  const previewPages = pageCount
    ? Array.from({ length: Math.min(pageCount, MAX_VISIBLE_PLAN_PAGES) }, (_, index) => index + 1)
    : [];
  const finalNumber = pageCount ? String(pageCount).padStart(3, "0") : null;
  const status = isProtected ? "Needs check" : pageCount && validPrefix ? "Ready" : "Needs setup";

  return (
    <div className="pdf-tools-operation-plan" aria-label="Split operation plan preview">
      <div className="pdf-tools-operation-plan-heading">
        <div>
          <span>Lightweight plan</span>
          <strong>Split output</strong>
        </div>
        <span className={`pdf-tools-operation-plan-status ${status === "Ready" ? "is-valid" : "is-check"}`}>
          {status}
        </span>
      </div>
      <p className="pdf-tools-operation-plan-note">Planning aid only — not a PDF preview. PDF pages and thumbnails are not rendered.</p>
      <dl className="pdf-tools-operation-plan-details">
        <div><dt>Source pages</dt><dd>{pageCount ?? "Unknown"}</dd></div>
        <div><dt>Output estimate</dt><dd>{pageCount ? `${pageCount} single-page PDFs` : "Select a valid PDF"}</dd></div>
      </dl>
      <div className="pdf-tools-operation-plan-targets">
        <span>Output page sequence</span>
        <PlanPageChips pages={previewPages} emptyLabel="Select a PDF to map output pages." />
        {pageCount && pageCount > previewPages.length && (
          <small>Showing the first {previewPages.length} of {pageCount} output pages.</small>
        )}
      </div>
      <p className="pdf-tools-operation-plan-output">
        {pageCount && validPrefix && finalNumber
          ? `${prefix}-page-001.pdf … ${prefix}-page-${finalNumber}.pdf`
          : "Select a valid PDF and enter a valid prefix to preview output names."}
      </p>
      {isProtected && (
        <p className="pdf-tools-operation-plan-warning is-protected" role="alert">
          <strong>Protected PDF:</strong> This operation may be rejected. Utility Tools Hub does not decrypt PDFs or bypass permissions.
        </p>
      )}
    </div>
  );
}

function PageOperationPlan({
  operation,
  pagesInput,
  summary,
  angle,
}: {
  operation: "Extract" | "Rotate" | "Delete";
  pagesInput: string;
  summary: OperationInputSummaryState;
  angle?: 90 | 180 | 270;
}) {
  const result = summary.result;
  const pageCount = result?.page_count ?? null;
  const parsed = parsePageSelectionForPlan(pagesInput, pageCount);
  const hasInput = pagesInput.trim().length > 0;
  const isProtected = Boolean(result && (result.is_encrypted || result.is_protected));
  const needsRangeCheck = !hasInput || parsed.error !== null || pageCount === null;
  const remainingPages =
    operation === "Delete" && pageCount !== null && parsed.error === null
      ? pageCount - parsed.pages.length
      : null;
  const deletesAllPages = operation === "Delete" && remainingPages !== null && remainingPages <= 0;
  const status = deletesAllPages ? "Unsafe plan" : needsRangeCheck || isProtected ? "Needs check" : "Valid";
  const issue = hasInput
    ? parsed.error ?? (pageCount === null ? "Select a valid PDF to check page limits." : null)
    : null;

  return (
    <div className="pdf-tools-operation-plan" aria-label={`${operation} operation plan preview`}>
      <div className="pdf-tools-operation-plan-heading">
        <div>
          <span>Lightweight plan</span>
          <strong>{operation} pages</strong>
        </div>
        <span className={`pdf-tools-operation-plan-status ${status === "Valid" ? "is-valid" : deletesAllPages ? "is-danger" : "is-check"}`}>
          {status}
        </span>
      </div>
      <p className="pdf-tools-operation-plan-note">Planning aid only — not a PDF preview. PDF pages and thumbnails are not rendered.</p>
      <dl className="pdf-tools-operation-plan-details">
        <div><dt>Source pages</dt><dd>{pageCount ?? "Unknown"}</dd></div>
        <div>
          <dt>{operation === "Delete" ? "Pages to delete" : "Selected pages"}</dt>
          <dd>{hasInput && parsed.pages.length > 0 ? parsed.pages.length : "Not set"}</dd>
        </div>
        {operation === "Rotate" && <div><dt>Rotate angle</dt><dd>{angle}°</dd></div>}
        {operation === "Delete" && (
          <div><dt>Remaining estimate</dt><dd>{remainingPages !== null && remainingPages >= 0 ? remainingPages : "Needs check"}</dd></div>
        )}
      </dl>
      <div className="pdf-tools-operation-plan-targets">
        <span>{operation === "Delete" ? "Whole pages to remove" : "Selected page targets"}</span>
        <PlanPageChips pages={parsed.pages} />
      </div>
      {issue && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Check page selection:</strong> {issue}</p>}
      {deletesAllPages && (
        <p className="pdf-tools-operation-plan-warning is-danger" role="alert">
          This plan would delete every page. Keep at least one page before running Delete pages.
        </p>
      )}
      {isProtected && (
        <p className="pdf-tools-operation-plan-warning is-protected" role="alert">
          <strong>Protected PDF:</strong> This operation may be rejected. Utility Tools Hub does not decrypt PDFs or bypass permissions.
        </p>
      )}
      {operation === "Delete" && (
        <p className="pdf-tools-operation-plan-safety">
          <strong>Not redaction:</strong> Delete pages removes whole pages only. It does not hide content inside a page.
        </p>
      )}
    </div>
  );
}

function ReorderOperationPlan({
  pageOrderInput,
  summary,
}: {
  pageOrderInput: string;
  summary: OperationInputSummaryState;
}) {
  const result = summary.result;
  const pageCount = result?.page_count ?? null;
  const parsed = parsePageOrder(pageOrderInput, pageCount);
  const hasInput = pageOrderInput.trim().length > 0;
  const isProtected = Boolean(result && (result.is_encrypted || result.is_protected));
  const status = parsed.isValid && !isProtected ? "Valid" : "Needs check";

  return (
    <div className="pdf-tools-operation-plan" aria-label="Reorder operation plan preview">
      <div className="pdf-tools-operation-plan-heading">
        <div>
          <span>Lightweight plan</span>
          <strong>Reorder pages</strong>
        </div>
        <span className={`pdf-tools-operation-plan-status ${status === "Valid" ? "is-valid" : "is-check"}`}>
          {status}
        </span>
      </div>
      <p className="pdf-tools-operation-plan-note">Planning aid only — not a PDF preview. PDF pages and thumbnails are not rendered.</p>
      <dl className="pdf-tools-operation-plan-details">
        <div><dt>Input pages</dt><dd>{pageCount ?? "Unknown"}</dd></div>
        <div><dt>Output</dt><dd>New PDF</dd></div>
      </dl>
      <div className="pdf-tools-operation-plan-targets">
        <span>New page order</span>
        <PlanPageChips pages={parsed.pageOrder} emptyLabel="Enter the full page order." />
        {parsed.pageOrder.length > 0 && (
          <small className="pdf-tools-operation-plan-sequence">
            New order: {parsed.pageOrder.join(" → ")}
          </small>
        )}
      </div>
      {pageCount === null && (
        <p className="pdf-tools-operation-plan-warning" role="alert">
          Select a valid PDF to validate the full page order.
        </p>
      )}
      {pageCount !== null && !hasInput && (
        <p className="pdf-tools-operation-plan-warning" role="alert">
          <strong>Page order required:</strong> Enter every page exactly once.
        </p>
      )}
      {hasInput && parsed.invalidEntries && (
        <p className="pdf-tools-operation-plan-warning" role="alert">Invalid entries found. Use comma-separated whole page numbers only.</p>
      )}
      {parsed.missingPages.length > 0 && (
        <p className="pdf-tools-operation-plan-warning" role="alert">
          <strong>Missing pages:</strong> {parsed.missingPages.join(", ")}
        </p>
      )}
      {parsed.duplicatePages.length > 0 && (
        <p className="pdf-tools-operation-plan-warning" role="alert">
          <strong>Duplicate pages:</strong> {parsed.duplicatePages.join(", ")}
        </p>
      )}
      {parsed.outOfRangePages.length > 0 && (
        <p className="pdf-tools-operation-plan-warning" role="alert">
          <strong>Out-of-range pages:</strong> {parsed.outOfRangePages.join(", ")}
        </p>
      )}
      {isProtected && (
        <p className="pdf-tools-operation-plan-warning is-protected" role="alert">
          <strong>Protected PDF:</strong> This operation may be rejected. Utility Tools Hub does not decrypt PDFs or bypass permissions.
        </p>
      )}
      <p className="pdf-tools-operation-plan-safety">
        Reorder pages changes whole-page order only. It does not edit PDF text or page content.
      </p>
    </div>
  );
}

export default function PdfToolsPanel({ onBack }: PdfToolsPanelProps) {
  const inspectFileInputRef = useRef<HTMLInputElement>(null);
  const mergeFileInputRef = useRef<HTMLInputElement>(null);
  const splitFileInputRef = useRef<HTMLInputElement>(null);
  const extractFileInputRef = useRef<HTMLInputElement>(null);
  const rotateFileInputRef = useRef<HTMLInputElement>(null);
  const deleteFileInputRef = useRef<HTMLInputElement>(null);
  const reorderFileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  const mergeInspectRunIdRef = useRef(0);
  const isRunningRef = useRef(false);

  const [selectedPdfs, setSelectedPdfs] = useState<SelectedPdf[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<PdfMergeResult | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergeInputSummaries, setMergeInputSummaries] = useState<MergeInputSummaryState[]>([]);
  const [mergeInspectLoading, setMergeInspectLoading] = useState(false);

  const [splitInput, setSplitInput] = useState<SelectedPdf | null>(null);
  const [splitOutputDir, setSplitOutputDir] = useState<string | null>(null);
  const [splitOutputPrefix, setSplitOutputPrefix] = useState("split-document");
  const [splitResult, setSplitResult] = useState<PdfSplitResult | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitFeedback, setSplitFeedback] = useState<string | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

  const [extractInput, setExtractInput] = useState<SelectedPdf | null>(null);
  const [extractPagesInput, setExtractPagesInput] = useState("");
  const [extractOutputPath, setExtractOutputPath] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<PdfExtractResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractFeedback, setExtractFeedback] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [rotateInput, setRotateInput] = useState<SelectedPdf | null>(null);
  const [rotatePagesInput, setRotatePagesInput] = useState("");
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [rotateOutputPath, setRotateOutputPath] = useState<string | null>(null);
  const [rotateResult, setRotateResult] = useState<PdfRotateResult | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateFeedback, setRotateFeedback] = useState<string | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const [deleteInput, setDeleteInput] = useState<SelectedPdf | null>(null);
  const [deletePagesInput, setDeletePagesInput] = useState("");
  const [deleteOutputPath, setDeleteOutputPath] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<PdfDeleteResult | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [reorderInput, setReorderInput] = useState<SelectedPdf | null>(null);
  const [reorderPageOrderInput, setReorderPageOrderInput] = useState("");
  const [reorderOutputPath, setReorderOutputPath] = useState<string | null>(null);
  const [reorderResult, setReorderResult] = useState<PdfReorderResult | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderFeedback, setReorderFeedback] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const [inspectInput, setInspectInput] = useState<SelectedPdf | null>(null);
  const [inspectResult, setInspectResult] = useState<PdfInspectResult | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectFeedback, setInspectFeedback] = useState<string | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const [splitInputSummary, setSplitInputSummary] = useState<OperationInputSummaryState>(emptyOperationInputSummary);
  const [extractInputSummary, setExtractInputSummary] = useState<OperationInputSummaryState>(emptyOperationInputSummary);
  const [rotateInputSummary, setRotateInputSummary] = useState<OperationInputSummaryState>(emptyOperationInputSummary);
  const [deleteInputSummary, setDeleteInputSummary] = useState<OperationInputSummaryState>(emptyOperationInputSummary);
  const [reorderInputSummary, setReorderInputSummary] = useState<OperationInputSummaryState>(emptyOperationInputSummary);

  const nativeDialogAvailable = isTauri();
  const parsedExtractPages = parsePageSelection(extractPagesInput);
  const parsedRotatePages = parsePageSelection(rotatePagesInput);
  const parsedDeletePages = parsePageSelection(deletePagesInput);
  const parsedReorderPageOrder = parsePageOrder(
    reorderPageOrderInput,
    reorderInputSummary.result?.page_count ?? null,
  );

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      mergeInspectRunIdRef.current += 1;
      isRunningRef.current = false;
      stopPolling();
    };
  }, []);

  const executeAdditionalPdfTool = async <T,>(
    toolId: string,
    input: Record<string, unknown>,
    setRunning: (running: boolean) => void,
    onSuccess: (result: T) => void,
    onFailure: (reason?: string | null) => void,
  ) => {
    if (isRunningRef.current) return;

    stopPolling();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    isRunningRef.current = true;
    setRunning(true);

    const finishWithError = () => {
      if (runIdRef.current !== runId) return;
      stopPolling();
      isRunningRef.current = false;
      setRunning(false);
      onFailure();
    };

    try {
      const jobId = await invoke<string>("execute_tool", {
        request: {
          tool_id: toolId,
          input,
          options: {},
        },
      });

      if (runIdRef.current !== runId) return;

      const pollJob = async () => {
        if (runIdRef.current !== runId) return;

        try {
          const job = await invoke<ToolJob<T>>("get_job_status", { jobId });
          if (runIdRef.current !== runId) return;

          if (job.status === "queued" || job.status === "running") {
            pollTimerRef.current = setTimeout(() => {
              void pollJob();
            }, POLL_INTERVAL_MS);
            return;
          }

          stopPolling();
          isRunningRef.current = false;
          setRunning(false);

          if (job.status === "succeeded" && job.result) {
            onSuccess(job.result);
            return;
          }

          onFailure(job.error);
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

  const inspectPdf = async (selectedPath: string) => {
    await executeAdditionalPdfTool<PdfInspectResult>(
      PDF_INSPECT_TOOL_ID,
      { input_path: selectedPath },
      setIsInspecting,
      (result) => {
        setInspectResult(result);
        setInspectInput({ name: result.file_name });
        setInspectFeedback("PDF summary is ready.");
        setInspectError(null);
      },
      (reason) => {
        setInspectResult(null);
        setInspectFeedback(null);
        setInspectError(inspectFailureMessage(reason));
      },
    );
  };

  const inspectOperationInput = async (
    selectedPath: string,
    setSummary: (summary: OperationInputSummaryState) => void,
  ) => {
    setSummary({ loading: true, error: null, result: null });
    await executeAdditionalPdfTool<PdfInspectResult>(
      PDF_INSPECT_TOOL_ID,
      { input_path: selectedPath },
      (loading) => setSummary({ loading, error: null, result: null }),
      (result) => setSummary({ loading: false, error: null, result }),
      (reason) =>
        setSummary({ loading: false, error: inspectFailureMessage(reason), result: null }),
    );
  };

  const inspectMergePdf = async (selectedPath: string): Promise<PdfInspectResult> => {
    const jobId = await invoke<string>("execute_tool", {
      request: {
        tool_id: PDF_INSPECT_TOOL_ID,
        input: { input_path: selectedPath },
        options: {},
      },
    });

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const job = await invoke<ToolJob<PdfInspectResult>>("get_job_status", { jobId });

      if (job.status === "queued" || job.status === "running") continue;
      if (job.status === "succeeded" && job.result) return job.result;
      throw new Error(job.error ?? "PDF inspection failed");
    }
  };

  const inspectMergeInputs = async (pdfs: SelectedPdf[]) => {
    const runId = mergeInspectRunIdRef.current + 1;
    mergeInspectRunIdRef.current = runId;
    const initialSummaries = pdfs.map<MergeInputSummaryState>((pdf, index) => ({
      order: index + 1,
      inputPath: pdf.path,
      fileName: pdf.name,
      loading: typeof pdf.path === "string",
      error: pdf.path ? null : "Desktop file path selection is required to inspect this PDF.",
      result: null,
    }));

    setMergeInputSummaries(initialSummaries);
    setMergeInspectLoading(initialSummaries.some((summary) => summary.loading));

    for (const summary of initialSummaries) {
      if (!summary.inputPath) continue;

      try {
        const result = await inspectMergePdf(summary.inputPath);
        if (mergeInspectRunIdRef.current !== runId) return;
        setMergeInputSummaries((current) =>
          current.map((entry) =>
            entry.order === summary.order
              ? { ...entry, fileName: result.file_name, loading: false, error: null, result }
              : entry,
          ),
        );
      } catch (inspectError) {
        if (mergeInspectRunIdRef.current !== runId) return;
        const reason = inspectError instanceof Error ? inspectError.message : null;
        setMergeInputSummaries((current) =>
          current.map((entry) =>
            entry.order === summary.order
              ? { ...entry, loading: false, error: inspectFailureMessage(reason), result: null }
              : entry,
          ),
        );
      }
    }

    if (mergeInspectRunIdRef.current === runId) setMergeInspectLoading(false);
  };

  const selectInspectPdf = async () => {
    if (isRunningRef.current) return;
    setInspectResult(null);
    setInspectFeedback(null);
    setInspectError(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF to inspect",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        if (!selectedPath.toLowerCase().endsWith(".pdf")) {
          setInspectError("Select a file with the .pdf extension.");
          return;
        }

        setInspectInput({ name: fileNameFromPath(selectedPath), path: selectedPath });
        await inspectPdf(selectedPath);
        return;
      } catch {
        setInspectError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    inspectFileInputRef.current?.click();
  };

  const selectBrowserInspectPdf = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setInspectResult(null);
    setInspectFeedback(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setInspectInput(null);
      setInspectError("Select a PDF file.");
      input.value = "";
      return;
    }

    setInspectInput({ name: file.name });
    setInspectError("Desktop file path selection is required to inspect PDFs.");
    input.value = "";
  };

  const selectPdfs = async () => {
    if (isRunningRef.current || mergeInspectLoading) return;
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
        void inspectMergeInputs(pdfs);
        return;
      } catch {
        setError("The native PDF picker is unavailable. Desktop file path selection is required to merge PDFs.");
      }
    }

    mergeFileInputRef.current?.click();
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

    const pdfs = selectedFiles.map((file) => ({ name: file.name }));
    setSelectedPdfs(pdfs);
    void inspectMergeInputs(pdfs);
    setError("Desktop file path selection is required to merge PDFs.");
    input.value = "";
  };

  const clearSelection = () => {
    if (isRunningRef.current || mergeInspectLoading) return;
    mergeInspectRunIdRef.current += 1;
    setSelectedPdfs([]);
    setMergeInputSummaries([]);
    setMergeInspectLoading(false);
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

    const finishWithError = (reason?: string | null) => {
      if (runIdRef.current !== runId) return;
      stopPolling();
      isRunningRef.current = false;
      setIsMerging(false);
      setMergeResult(null);
      setFeedback(null);
      setError(mergeFailureMessage(reason));
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
            setFeedback("Merge completed successfully.");
            setError(null);
            return;
          }

          finishWithError(job.error);
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

  const selectSplitInput = async () => {
    if (isRunningRef.current) return;
    setSplitFeedback(null);
    setSplitError(null);
    setSplitResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF to split",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        setSplitInput({ name: fileNameFromPath(selectedPath), path: selectedPath });
        setSplitFeedback(`Input selected: ${fileNameFromPath(selectedPath)}`);
        await inspectOperationInput(selectedPath, setSplitInputSummary);
        return;
      } catch {
        setSplitError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    splitFileInputRef.current?.click();
  };

  const selectBrowserSplitInput = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setSplitFeedback(null);
    setSplitResult(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setSplitInput(null);
      setSplitInputSummary(emptyOperationInputSummary());
      setSplitError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setSplitInput({ name: file.name });
    setSplitInputSummary({
      loading: false,
      error: "Desktop file path selection is required to inspect this PDF.",
      result: null,
    });
    setSplitError("Desktop file path selection is required to split PDFs.");
    input.value = "";
  };

  const selectSplitOutputDir = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setSplitFeedback(null);
    setSplitError(null);
    setSplitResult(null);

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await open({
        multiple: false,
        directory: true,
        title: "Select split output folder",
      });
      if (typeof selectedPath !== "string") return;
      setSplitOutputDir(selectedPath);
      setSplitFeedback(`Output folder selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setSplitError("The split output folder could not be selected.");
    }
  };

  const splitPdf = async () => {
    if (isRunningRef.current) return;
    const prefix = splitOutputPrefix.trim();
    if (!splitInput?.path || !splitOutputDir || !prefix || /[\\/]/.test(prefix)) {
      setSplitError("Select a desktop PDF, output folder, and valid output prefix first.");
      return;
    }

    setSplitResult(null);
    setSplitFeedback(null);
    setSplitError(null);

    await executeAdditionalPdfTool<PdfSplitResult>(
      PDF_SPLIT_TOOL_ID,
      {
        input_path: splitInput.path,
        output_dir: splitOutputDir,
        output_prefix: prefix,
      },
      setIsSplitting,
      (result) => {
        setSplitResult(result);
        setSplitFeedback("Split completed successfully.");
        setSplitError(null);
      },
      () => {
        setSplitResult(null);
        setSplitFeedback(null);
        setSplitError(splitFailureMessage());
      },
    );
  };

  const selectExtractInput = async () => {
    if (isRunningRef.current) return;
    setExtractFeedback(null);
    setExtractError(null);
    setExtractResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF to extract pages from",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        setExtractInput({ name: fileNameFromPath(selectedPath), path: selectedPath });
        setExtractFeedback(`Input selected: ${fileNameFromPath(selectedPath)}`);
        await inspectOperationInput(selectedPath, setExtractInputSummary);
        return;
      } catch {
        setExtractError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    extractFileInputRef.current?.click();
  };

  const selectBrowserExtractInput = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setExtractFeedback(null);
    setExtractResult(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setExtractInput(null);
      setExtractInputSummary(emptyOperationInputSummary());
      setExtractError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setExtractInput({ name: file.name });
    setExtractInputSummary({
      loading: false,
      error: "Desktop file path selection is required to inspect this PDF.",
      result: null,
    });
    setExtractError("Desktop file path selection is required to extract pages.");
    input.value = "";
  };

  const selectExtractOutputPdf = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setExtractFeedback(null);
    setExtractError(null);
    setExtractResult(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await save({
        defaultPath: "extracted-pages.pdf",
        title: "Select extracted output PDF",
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (!selectedPath) return;
      if (!selectedPath.toLowerCase().endsWith(".pdf")) {
        setExtractError("The output file must use the .pdf extension.");
        return;
      }

      setExtractOutputPath(selectedPath);
      setExtractFeedback(`Output selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setExtractError("The extracted output PDF could not be selected.");
    }
  };

  const extractPdfPages = async () => {
    if (isRunningRef.current) return;
    if (!extractInput?.path || !extractOutputPath || !parsedExtractPages.pages) {
      setExtractError(
        parsedExtractPages.error ?? "Select a desktop PDF, valid pages, and an output PDF first.",
      );
      return;
    }

    setExtractResult(null);
    setExtractFeedback(null);
    setExtractError(null);

    await executeAdditionalPdfTool<PdfExtractResult>(
      PDF_EXTRACT_TOOL_ID,
      {
        input_path: extractInput.path,
        output_path: extractOutputPath,
        pages: parsedExtractPages.pages,
      },
      setIsExtracting,
      (result) => {
        setExtractResult(result);
        setExtractFeedback("Extract completed successfully.");
        setExtractError(null);
      },
      () => {
        setExtractResult(null);
        setExtractFeedback(null);
        setExtractError(extractFailureMessage());
      },
    );
  };

  const selectRotateInput = async () => {
    if (isRunningRef.current) return;
    setRotateFeedback(null);
    setRotateError(null);
    setRotateResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF to rotate pages in",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        setRotateInput({ name: fileNameFromPath(selectedPath), path: selectedPath });
        setRotateFeedback(`Input selected: ${fileNameFromPath(selectedPath)}`);
        await inspectOperationInput(selectedPath, setRotateInputSummary);
        return;
      } catch {
        setRotateError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    rotateFileInputRef.current?.click();
  };

  const selectBrowserRotateInput = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setRotateFeedback(null);
    setRotateResult(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setRotateInput(null);
      setRotateInputSummary(emptyOperationInputSummary());
      setRotateError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setRotateInput({ name: file.name });
    setRotateInputSummary({
      loading: false,
      error: "Desktop file path selection is required to inspect this PDF.",
      result: null,
    });
    setRotateError("Desktop file path selection is required to rotate pages.");
    input.value = "";
  };

  const selectRotateOutputPdf = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setRotateFeedback(null);
    setRotateError(null);
    setRotateResult(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await save({
        defaultPath: "rotated-pages.pdf",
        title: "Select rotated output PDF",
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (!selectedPath) return;
      if (!selectedPath.toLowerCase().endsWith(".pdf")) {
        setRotateError("The output file must use the .pdf extension.");
        return;
      }

      setRotateOutputPath(selectedPath);
      setRotateFeedback(`Output selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setRotateError("The rotated output PDF could not be selected.");
    }
  };

  const rotatePdfPages = async () => {
    if (isRunningRef.current) return;
    if (!rotateInput?.path || !rotateOutputPath || !parsedRotatePages.pages) {
      setRotateError(
        parsedRotatePages.error ?? "Select a desktop PDF, valid pages, angle, and output PDF first.",
      );
      return;
    }

    setRotateResult(null);
    setRotateFeedback(null);
    setRotateError(null);

    await executeAdditionalPdfTool<PdfRotateResult>(
      PDF_ROTATE_TOOL_ID,
      {
        input_path: rotateInput.path,
        output_path: rotateOutputPath,
        pages: parsedRotatePages.pages,
        angle_degrees: rotateAngle,
      },
      setIsRotating,
      (result) => {
        setRotateResult(result);
        setRotateFeedback("Rotate completed successfully.");
        setRotateError(null);
      },
      () => {
        setRotateResult(null);
        setRotateFeedback(null);
        setRotateError(rotateFailureMessage());
      },
    );
  };

  const selectDeleteInput = async () => {
    if (isRunningRef.current) return;
    setDeleteFeedback(null);
    setDeleteError(null);
    setDeleteResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF to delete pages from",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        setDeleteInput({ name: fileNameFromPath(selectedPath), path: selectedPath });
        setDeleteFeedback(`Input selected: ${fileNameFromPath(selectedPath)}`);
        await inspectOperationInput(selectedPath, setDeleteInputSummary);
        return;
      } catch {
        setDeleteError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    deleteFileInputRef.current?.click();
  };

  const selectBrowserDeleteInput = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setDeleteFeedback(null);
    setDeleteResult(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setDeleteInput(null);
      setDeleteInputSummary(emptyOperationInputSummary());
      setDeleteError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setDeleteInput({ name: file.name });
    setDeleteInputSummary({
      loading: false,
      error: "Desktop file path selection is required to inspect this PDF.",
      result: null,
    });
    setDeleteError("Desktop file path selection is required to delete pages.");
    input.value = "";
  };

  const selectDeleteOutputPdf = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setDeleteFeedback(null);
    setDeleteError(null);
    setDeleteResult(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await save({
        defaultPath: "deleted-pages.pdf",
        title: "Select deleted-pages output PDF",
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (!selectedPath) return;
      if (!selectedPath.toLowerCase().endsWith(".pdf")) {
        setDeleteError("The output file must use the .pdf extension.");
        return;
      }

      setDeleteOutputPath(selectedPath);
      setDeleteFeedback(`Output selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setDeleteError("The deleted-pages output PDF could not be selected.");
    }
  };

  const deletePdfPages = async () => {
    if (isRunningRef.current) return;
    if (!deleteInput?.path || !deleteOutputPath || !parsedDeletePages.pages) {
      setDeleteError(
        parsedDeletePages.error ?? "Select a desktop PDF, valid pages, and an output PDF first.",
      );
      return;
    }

    setDeleteResult(null);
    setDeleteFeedback(null);
    setDeleteError(null);

    await executeAdditionalPdfTool<PdfDeleteResult>(
      PDF_DELETE_TOOL_ID,
      {
        input_path: deleteInput.path,
        output_path: deleteOutputPath,
        pages: parsedDeletePages.pages,
      },
      setIsDeleting,
      (result) => {
        setDeleteResult(result);
        setDeleteFeedback("Delete completed successfully.");
        setDeleteError(null);
      },
      () => {
        setDeleteResult(null);
        setDeleteFeedback(null);
        setDeleteError(deleteFailureMessage());
      },
    );
  };

  const selectReorderInput = async () => {
    if (isRunningRef.current) return;
    setReorderFeedback(null);
    setReorderError(null);
    setReorderResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF to reorder pages in",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        if (!selectedPath.toLowerCase().endsWith(".pdf")) {
          setReorderError("Select a file with the .pdf extension.");
          return;
        }
        setReorderInput({ name: fileNameFromPath(selectedPath), path: selectedPath });
        setReorderFeedback(`Input selected: ${fileNameFromPath(selectedPath)}`);
        await inspectOperationInput(selectedPath, setReorderInputSummary);
        return;
      } catch {
        setReorderError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    reorderFileInputRef.current?.click();
  };

  const selectBrowserReorderInput = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setReorderFeedback(null);
    setReorderResult(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setReorderInput(null);
      setReorderInputSummary(emptyOperationInputSummary());
      setReorderError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setReorderInput({ name: file.name });
    setReorderInputSummary({
      loading: false,
      error: "Desktop file path selection is required to inspect this PDF.",
      result: null,
    });
    setReorderError("Desktop file path selection is required to reorder pages.");
    input.value = "";
  };

  const selectReorderOutputPdf = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setReorderFeedback(null);
    setReorderError(null);
    setReorderResult(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await save({
        defaultPath: "reordered-pages.pdf",
        title: "Select reordered output PDF",
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (!selectedPath) return;
      if (!selectedPath.toLowerCase().endsWith(".pdf")) {
        setReorderError("The output file must use the .pdf extension.");
        return;
      }

      setReorderOutputPath(selectedPath);
      setReorderFeedback(`Output selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setReorderError("The reordered output PDF could not be selected.");
    }
  };

  const reorderPdfPages = async () => {
    if (isRunningRef.current) return;
    if (!reorderInput?.path || !reorderOutputPath || !parsedReorderPageOrder.isValid) {
      setReorderError(
        "Select a desktop PDF and output PDF, then enter every input page exactly once.",
      );
      return;
    }

    setReorderResult(null);
    setReorderFeedback(null);
    setReorderError(null);

    await executeAdditionalPdfTool<PdfReorderResult>(
      PDF_REORDER_TOOL_ID,
      {
        input_path: reorderInput.path,
        output_path: reorderOutputPath,
        page_order: parsedReorderPageOrder.pageOrder,
      },
      setIsReordering,
      (result) => {
        setReorderResult(result);
        setReorderFeedback("Reorder completed successfully.");
        setReorderError(null);
      },
      (reason) => {
        setReorderResult(null);
        setReorderFeedback(null);
        setReorderError(reorderFailureMessage(reason));
      },
    );
  };

  const hasDesktopInputPaths =
    selectedPdfs.length > 0 && selectedPdfs.every((pdf) => typeof pdf.path === "string");
  const isAnyOperationRunning =
    isInspecting ||
    mergeInspectLoading ||
    splitInputSummary.loading ||
    extractInputSummary.loading ||
    rotateInputSummary.loading ||
    deleteInputSummary.loading ||
    reorderInputSummary.loading ||
    isMerging ||
    isSplitting ||
    isExtracting ||
    isRotating ||
    isDeleting ||
    isReordering;
  const mergeTotalPages = mergeInputSummaries.reduce(
    (total, summary) => total + (summary.result?.page_count ?? 0),
    0,
  );
  const mergeHasUncountedFiles = mergeInputSummaries.some(
    (summary) => !summary.loading && summary.result === null,
  );
  const mergeHasProtectedPdf = mergeInputSummaries.some(
    (summary) => Boolean(summary.result && (summary.result.is_encrypted || summary.result.is_protected)),
  );
  const hasValidSplitPrefix =
    splitOutputPrefix.trim().length > 0 && !/[\\/]/.test(splitOutputPrefix.trim());
  const canMerge =
    nativeDialogAvailable &&
    selectedPdfs.length >= 2 &&
    hasDesktopInputPaths &&
    outputPath !== null &&
    !isAnyOperationRunning;
  const canSplit =
    nativeDialogAvailable &&
    typeof splitInput?.path === "string" &&
    splitOutputDir !== null &&
    hasValidSplitPrefix &&
    !isAnyOperationRunning;
  const canExtract =
    nativeDialogAvailable &&
    typeof extractInput?.path === "string" &&
    extractOutputPath !== null &&
    parsedExtractPages.pages !== null &&
    !isAnyOperationRunning;
  const canRotate =
    nativeDialogAvailable &&
    typeof rotateInput?.path === "string" &&
    rotateOutputPath !== null &&
    parsedRotatePages.pages !== null &&
    !isAnyOperationRunning;
  const canDelete =
    nativeDialogAvailable &&
    typeof deleteInput?.path === "string" &&
    deleteOutputPath !== null &&
    parsedDeletePages.pages !== null &&
    !isAnyOperationRunning;
  const canReorder =
    nativeDialogAvailable &&
    typeof reorderInput?.path === "string" &&
    reorderOutputPath !== null &&
    parsedReorderPageOrder.isValid &&
    !isAnyOperationRunning;
  const mergeDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : selectedPdfs.length < 2
      ? "Select at least two PDF files."
      : !hasDesktopInputPaths
        ? "Select the input PDFs again with the desktop file picker."
        : mergeInspectLoading
          ? "Wait for the selected PDF summaries to finish."
          : !outputPath
            ? "Select an output PDF."
            : null;
  const splitDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : !splitInput?.path
      ? "Select one input PDF."
      : !splitOutputDir
        ? "Select an output folder."
        : !splitOutputPrefix.trim()
          ? "Enter an output prefix."
          : !hasValidSplitPrefix
            ? "Remove path separators from the output prefix."
            : null;
  const extractDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : !extractInput?.path
      ? "Select one input PDF."
      : !extractPagesInput.trim()
        ? "Enter pages to extract, such as 1,3,5 or 1-3,5."
        : parsedExtractPages.error
          ? parsedExtractPages.error
          : !extractOutputPath
            ? "Select an output PDF."
            : null;
  const rotateDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : !rotateInput?.path
      ? "Select one input PDF."
      : !rotatePagesInput.trim()
        ? "Enter pages to rotate, such as 1,3 or 1-3."
        : parsedRotatePages.error
          ? parsedRotatePages.error
          : !rotateOutputPath
            ? "Select an output PDF."
            : null;
  const deleteDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : !deleteInput?.path
      ? "Select one input PDF."
      : !deletePagesInput.trim()
        ? "Enter pages to delete, such as 2,4 or 2-4."
        : parsedDeletePages.error
          ? parsedDeletePages.error
          : !deleteOutputPath
            ? "Select an output PDF."
            : null;
  const reorderDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : !reorderInput?.path
      ? "Select one input PDF."
      : reorderInputSummary.loading
        ? "Wait for the input PDF summary to finish."
        : !reorderInputSummary.result
          ? "A valid input PDF summary is required."
          : !reorderPageOrderInput.trim()
            ? "Enter the full page order, such as 3,1,2."
            : !parsedReorderPageOrder.isValid
              ? "Include every input page exactly once with comma-separated page numbers."
              : !reorderOutputPath
                ? "Select an output PDF."
                : null;
  const inspectMetadata = inspectResult
    ? [
        { label: "Title", value: inspectResult.title },
        { label: "Author", value: inspectResult.author },
        { label: "Creator", value: inspectResult.creator },
        { label: "Producer", value: inspectResult.producer },
      ].filter(
        (entry): entry is { label: string; value: string } =>
          typeof entry.value === "string" && entry.value.trim().length > 0,
      )
    : [];
  const inspectedPdfIsProtected = Boolean(
    inspectResult && (inspectResult.is_encrypted || inspectResult.is_protected),
  );

  return (
    <div className="pdf-tools-page">
      <button type="button" className="btn btn-outline" onClick={onBack} disabled={isAnyOperationRunning}>
        ← Back to Tools
      </button>

      <div className="page-header pdf-tools-header">
        <div>
          <h1>PDF Workbench</h1>
          <p>Local page operations with clear file, operation, result, and safety areas</p>
        </div>
        <span className="pdf-tools-planned-badge">Inspect · Merge · Split · Extract · Rotate · Delete · Reorder</span>
      </div>

      <div className="pdf-tools-notice" role="note">
        <strong>PDF summary inspection and six local page-operation MVPs are available.</strong>
        <span>Drag-and-drop reorder, real page preview, thumbnails, and overlay writing are planned. OCR, redaction, and direct text editing remain research topics.</span>
      </div>

      <div className="pdf-tools-workbench-grid">
        <aside className="pdf-tools-workbench-files" aria-label="Selected PDF files">
          <section className="pdf-tools-panel pdf-tools-sidebar-card pdf-tools-inspect-card" aria-labelledby="pdf-file-summary-title">
            <div className="pdf-tools-section-heading">
              <span>File summary</span>
              <h2 id="pdf-file-summary-title">Inspect PDF</h2>
              <p>Select one local PDF to inspect its page count, version, and protection status.</p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={selectInspectPdf}
              disabled={isAnyOperationRunning}
            >
              {isInspecting ? "Inspecting..." : "Select PDF to inspect"}
            </button>
            <input
              ref={inspectFileInputRef}
              className="pdf-tools-hidden-input"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => selectBrowserInspectPdf(event.target.files?.[0], event.currentTarget)}
            />

            {isInspecting && (
              <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-inspect-feedback" role="status">
                <strong>Inspecting PDF...</strong>
                <span>Reading safe document summary information locally.</span>
              </div>
            )}
            {inspectError && (
              <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-inspect-feedback" role="alert">
                <strong>Inspect failed.</strong>
                <span>{inspectError}</span>
              </div>
            )}
            {!isInspecting && inspectFeedback && inspectResult && (
              <div className="pdf-tools-feedback pdf-tools-inspect-feedback" role="status">
                <strong>{inspectFeedback}</strong>
              </div>
            )}

            {!inspectResult && !isInspecting && !inspectError && (
              <div className="pdf-tools-inspect-empty">
                <strong>No PDF inspected yet.</strong>
                <span>Select a PDF file to inspect its page count, version, and protection status.</span>
              </div>
            )}

            {inspectResult && (
              <div className="pdf-tools-inspect-result">
                <div className="pdf-tools-inspect-file-name" title={inspectResult.file_name}>
                  <span>File</span>
                  <strong>{inspectResult.file_name}</strong>
                </div>
                <dl className="pdf-tools-inspect-summary">
                  <div><dt>Size</dt><dd>{formatFileSize(inspectResult.file_size_bytes)}</dd></div>
                  <div><dt>Pages</dt><dd>{inspectResult.page_count}</dd></div>
                  <div><dt>PDF version</dt><dd>{inspectResult.pdf_version}</dd></div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span className={`pdf-tools-protection-status ${inspectedPdfIsProtected ? "is-protected" : "is-normal"}`}>
                        {inspectedPdfIsProtected ? "Protected" : "Normal"}
                      </span>
                    </dd>
                  </div>
                </dl>

                <div className="pdf-tools-metadata">
                  <h3>Metadata</h3>
                  {inspectMetadata.length > 0 ? (
                    <dl>
                      {inspectMetadata.map((entry) => (
                        <div key={entry.label}>
                          <dt>{entry.label}</dt>
                          <dd>{entry.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p>No metadata found.</p>
                  )}
                </div>

                {inspectedPdfIsProtected && (
                  <div className="pdf-tools-protected-warning" role="alert">
                    <strong>This PDF appears to be encrypted or permission-protected.</strong>
                    <span>Protected PDFs can be viewed by some apps but may not be supported for merge or editing operations.</span>
                    <span>Utility Tools Hub does not decrypt PDFs or bypass permissions.</span>
                  </div>
                )}
              </div>
            )}

            <p className="pdf-tools-inspect-local-note">PDF files stay on this device. Full local paths are not shown here.</p>
          </section>

          <section className="pdf-tools-panel pdf-tools-sidebar-card">
            <div className="pdf-tools-section-heading">
              <span>Files</span>
              <h2>Selected files</h2>
              <p>Each operation keeps its own file selection in this UI shell.</p>
            </div>
            <dl className="pdf-tools-file-overview">
              <div><dt>Inspect</dt><dd>{inspectInput?.name ?? "No file selected"}</dd></div>
              <div><dt>Merge</dt><dd>{selectedPdfs.length > 0 ? `${selectedPdfs.length} PDFs selected` : "No files selected"}</dd></div>
              <div><dt>Split</dt><dd>{splitInput?.name ?? "No file selected"}</dd></div>
              <div><dt>Extract</dt><dd>{extractInput?.name ?? "No file selected"}</dd></div>
              <div><dt>Rotate</dt><dd>{rotateInput?.name ?? "No file selected"}</dd></div>
              <div><dt>Delete</dt><dd>{deleteInput?.name ?? "No file selected"}</dd></div>
              <div><dt>Reorder</dt><dd>{reorderInput?.name ?? "No file selected"}</dd></div>
            </dl>
            <div className="pdf-tools-local-notes">
              <p>PDF files stay on this device.</p>
              <p>Original files are not overwritten by default.</p>
              <p>Encrypted or permission-protected PDFs are not supported.</p>
            </div>
          </section>

          <section className="pdf-tools-panel pdf-tools-future-workspace" aria-labelledby="future-page-area-title">
            <div className="pdf-tools-section-heading">
              <span>Lightweight workspace</span>
              <h2 id="future-page-area-title">Operation plan</h2>
              <p>Review page counts, order, and selected targets before running an operation. This is not a rendered PDF preview.</p>
            </div>
            <div className="pdf-tools-preview-placeholder" aria-label="Lightweight operation plan preview explanation">
              <span>Plan preview · No rendering</span>
              <small>Uses PDF summary data and page-number input only.</small>
              <div className="pdf-tools-operation-plan-legend" aria-label="Operation plan information">
                <span>Page counts</span>
                <span>Merge order</span>
                <span>Selected targets</span>
                <span>Protected status</span>
              </div>
              <strong>PDF pages and thumbnails are not rendered.</strong>
            </div>
          </section>
        </aside>

        <main className="pdf-tools-workbench-main" aria-label="PDF page operations">
          <div className="pdf-tools-workbench-heading">
            <span>Operations</span>
            <h2>Page operations</h2>
            <p>Select inputs and outputs inside each operation card.</p>
          </div>

          <div className="pdf-tools-workflow-grid">
        <section className="pdf-tools-panel" aria-labelledby="pdf-input-title">
          <div className="pdf-tools-section-heading">
            <span>Merge · Step 1</span>
            <h2 id="pdf-input-title">Input PDFs</h2>
            <p>Select two or more local PDFs to combine into one PDF.</p>
          </div>
          <p className="pdf-tools-helper">Page order follows the numbered file order shown below.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-primary" onClick={selectPdfs} disabled={isAnyOperationRunning}>
              Select PDFs
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={clearSelection}
              disabled={selectedPdfs.length === 0 || isAnyOperationRunning}
            >
              Clear selection
            </button>
          </div>
          <input
            ref={mergeFileInputRef}
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

          {mergeInputSummaries.length > 0 ? (
            <div className="pdf-tools-merge-summary" aria-label="Merge operation plan preview">
              <div className="pdf-tools-operation-plan-heading">
                <div>
                  <span>Lightweight plan</span>
                  <strong>Merge order</strong>
                </div>
                <span className={`pdf-tools-operation-plan-status ${mergeInspectLoading || mergeHasProtectedPdf || mergeHasUncountedFiles ? "is-check" : "is-valid"}`}>
                  {mergeInspectLoading ? "Inspecting" : mergeHasProtectedPdf || mergeHasUncountedFiles ? "Needs check" : "Ready"}
                </span>
              </div>
              <p className="pdf-tools-operation-plan-note">Planning aid only — not a PDF preview. PDF pages and thumbnails are not rendered.</p>
              <ol className="pdf-tools-merge-summary-list">
                {mergeInputSummaries.map((summary) => {
                  const result = summary.result;
                  const isProtected = Boolean(result && (result.is_encrypted || result.is_protected));

                  return (
                    <li
                      key={`${summary.order}-${summary.fileName}`}
                      className={summary.error ? "has-error" : isProtected ? "is-protected" : undefined}
                    >
                      <div className="pdf-tools-merge-summary-file">
                        <span aria-label={`Merge order ${summary.order}`}>{summary.order}</span>
                        <strong title={summary.fileName}>{summary.fileName}</strong>
                      </div>
                      {summary.loading && (
                        <p className="pdf-tools-merge-summary-message is-loading" role="status">
                          Inspecting PDF summary...
                        </p>
                      )}
                      {summary.error && !summary.loading && (
                        <p className="pdf-tools-merge-summary-message is-error" role="alert">
                          Summary unavailable. {summary.error}
                        </p>
                      )}
                      {result && !summary.loading && (
                        <dl className="pdf-tools-merge-summary-details">
                          <div><dt>Size</dt><dd>{formatFileSize(result.file_size_bytes)}</dd></div>
                          <div><dt>Pages</dt><dd>{result.page_count}</dd></div>
                          <div><dt>PDF version</dt><dd>{result.pdf_version}</dd></div>
                          <div>
                            <dt>Status</dt>
                            <dd>
                              <span className={`pdf-tools-protection-status ${isProtected ? "is-protected" : "is-normal"}`}>
                                {isProtected ? "Protected" : "Normal"}
                              </span>
                            </dd>
                          </div>
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ol>

              <dl className="pdf-tools-merge-totals">
                <div><dt>Files</dt><dd>{mergeInputSummaries.length}</dd></div>
                <div><dt>Total pages</dt><dd>{mergeInspectLoading ? "Calculating..." : mergeTotalPages}</dd></div>
              </dl>
              {mergeHasUncountedFiles && !mergeInspectLoading && (
                <p className="pdf-tools-merge-count-note">Some files could not be counted.</p>
              )}
              {mergeHasProtectedPdf && (
                <div className="pdf-tools-merge-protected-warning" role="alert">
                  <strong>One or more selected PDFs appear to be encrypted or permission-protected.</strong>
                  <span>Protected PDFs can be viewed by some apps, but Merge PDFs does not decrypt PDFs or bypass permissions.</span>
                  <span>Remove password or permission protection, then try again.</span>
                </div>
              )}
            </div>
          ) : (
            <p className="pdf-tools-empty-selection">No PDFs selected.</p>
          )}

          {!hasDesktopInputPaths && selectedPdfs.length > 0 && (
            <p className="pdf-tools-desktop-note">Desktop file path selection is required to merge PDFs.</p>
          )}
        </section>

        <section className="pdf-tools-panel" aria-labelledby="pdf-output-title">
          <div className="pdf-tools-section-heading">
            <span>Merge · Step 2</span>
            <h2 id="pdf-output-title">Output PDF</h2>
            <p>Choose a new output PDF before starting the merge.</p>
          </div>

          <button
            type="button"
            className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
            onClick={selectOutputPdf}
            disabled={!nativeDialogAvailable || isAnyOperationRunning}
          >
            {nativeDialogAvailable ? "Select output PDF" : "Select output PDF (Desktop only)"}
          </button>

          <dl className="pdf-tools-selection-details">
            <div>
              <dt>Output file</dt>
              <dd className="pdf-tools-path">
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
          <span>Merge · Step 3</span>
          <h2 id="pdf-merge-title">Merge PDFs</h2>
          <p>Combines the selected PDFs in their displayed order and writes one new PDF.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={mergePdfs} disabled={!canMerge}>
          {isMerging ? "Merging..." : "Merge PDFs"}
        </button>
        <p className="pdf-tools-merge-guidance">
          Merge order follows the selected file order. Protected PDFs may be rejected.
        </p>
        {!canMerge && !isMerging && (
          <p className="pdf-tools-operation-requirements">To enable Merge: {mergeDisabledReason}</p>
        )}
          </section>

          {isMerging && (
        <div className="pdf-tools-feedback pdf-tools-feedback-loading" role="status" aria-live="polite">
          Merging the selected PDFs in order...
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

          <div className="pdf-tools-operation-grid">
        <section className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-split-title">
          <div className="pdf-tools-section-heading">
            <span>One PDF · All pages</span>
            <h2 id="pdf-split-title">Split PDF</h2>
            <p>Split one PDF into a separate PDF file for each page.</p>
          </div>
          <p className="pdf-tools-helper">Select an output folder and prefix. For prefix “document”, output starts with document-page-001.pdf.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-outline" onClick={selectSplitInput} disabled={isAnyOperationRunning}>
              Select input PDF
            </button>
            <button
              type="button"
              className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
              onClick={selectSplitOutputDir}
              disabled={!nativeDialogAvailable || isAnyOperationRunning}
            >
              {nativeDialogAvailable ? "Select output folder" : "Output folder (Desktop only)"}
            </button>
          </div>
          <input
            ref={splitFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              selectBrowserSplitInput(event.currentTarget.files?.[0], event.currentTarget)
            }
          />

          <dl className="pdf-tools-selection-details">
            <div><dt>Input PDF</dt><dd>{splitInput?.name ?? "Not selected"}</dd></div>
            <div>
              <dt>Output folder</dt>
              <dd className="pdf-tools-path">
                {splitOutputDir ? fileNameFromPath(splitOutputDir) : "Not selected"}
              </dd>
            </div>
          </dl>

          <OperationInputSummary
            fileName={splitInput?.name}
            summary={splitInputSummary}
            guidance="Page count can help estimate the number of output files."
          />

          <label className="pdf-tools-field">
            <span>Output prefix</span>
            <input
              type="text"
              value={splitOutputPrefix}
              onChange={(event) => {
                setSplitOutputPrefix(event.currentTarget.value);
                setSplitResult(null);
                setSplitFeedback(null);
                setSplitError(null);
              }}
              disabled={isAnyOperationRunning}
              placeholder="split-document"
            />
          </label>
          {!hasValidSplitPrefix && splitOutputPrefix.length > 0 && (
            <p className="pdf-tools-field-error">Output prefix cannot contain path separators.</p>
          )}

          <SplitOperationPlan summary={splitInputSummary} outputPrefix={splitOutputPrefix} />

          <button type="button" className="btn btn-primary" onClick={splitPdf} disabled={!canSplit}>
            {isSplitting ? "Splitting..." : "Split PDF"}
          </button>
          {!canSplit && !isSplitting && (
            <p className="pdf-tools-operation-requirements">To enable Split: {splitDisabledReason}</p>
          )}

          {isSplitting && <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">Splitting the PDF into single-page files...</div>}
          {splitError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{splitError}</div>}
          {!splitError && !isSplitting && splitFeedback && (
            <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status">
              <strong>{splitFeedback}</strong>
              {splitResult && (
                <span>{splitResult.page_count} pages · {splitResult.output_paths.length} files · Folder: {splitOutputDir ? fileNameFromPath(splitOutputDir) : "Selected folder"}</span>
              )}
            </div>
          )}
        </section>

        <section className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-extract-title">
          <div className="pdf-tools-section-heading">
            <span>One PDF · Selected pages</span>
            <h2 id="pdf-extract-title">Extract pages</h2>
            <p>Copy only the selected pages into one new PDF.</p>
          </div>
          <p className="pdf-tools-helper">Page numbers start at 1. Examples: 1,3,5 or 1-3,5.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-outline" onClick={selectExtractInput} disabled={isAnyOperationRunning}>
              Select input PDF
            </button>
            <button
              type="button"
              className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
              onClick={selectExtractOutputPdf}
              disabled={!nativeDialogAvailable || isAnyOperationRunning}
            >
              {nativeDialogAvailable ? "Select output PDF" : "Output PDF (Desktop only)"}
            </button>
          </div>
          <input
            ref={extractFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              selectBrowserExtractInput(event.currentTarget.files?.[0], event.currentTarget)
            }
          />

          <dl className="pdf-tools-selection-details">
            <div><dt>Input PDF</dt><dd>{extractInput?.name ?? "Not selected"}</dd></div>
            <div>
              <dt>Output PDF</dt>
              <dd className="pdf-tools-path">
                {extractOutputPath ? fileNameFromPath(extractOutputPath) : "Not selected"}
              </dd>
            </div>
          </dl>

          <OperationInputSummary
            fileName={extractInput?.name}
            summary={extractInputSummary}
            guidance="Page count helps confirm valid page ranges."
          />

          <label className="pdf-tools-field">
            <span>Pages</span>
            <input
              type="text"
              inputMode="numeric"
              value={extractPagesInput}
              onChange={(event) => {
                setExtractPagesInput(event.currentTarget.value);
                setExtractResult(null);
                setExtractFeedback(null);
                setExtractError(null);
              }}
              disabled={isAnyOperationRunning}
              placeholder="1,3,5 or 1-3,5"
            />
          </label>
          {extractPagesInput.trim() && parsedExtractPages.error && (
            <p className="pdf-tools-field-error">{parsedExtractPages.error}</p>
          )}

          <PageOperationPlan
            operation="Extract"
            pagesInput={extractPagesInput}
            summary={extractInputSummary}
          />

          <button type="button" className="btn btn-primary" onClick={extractPdfPages} disabled={!canExtract}>
            {isExtracting ? "Extracting..." : "Extract pages"}
          </button>
          {!canExtract && !isExtracting && (
            <p className="pdf-tools-operation-requirements">To enable Extract: {extractDisabledReason}</p>
          )}

          {isExtracting && <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">Extracting the selected pages into a new PDF...</div>}
          {extractError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{extractError}</div>}
          {!extractError && !isExtracting && extractFeedback && (
            <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status">
              <strong>{extractFeedback}</strong>
              {extractResult && (
                <span>Pages {extractResult.selected_pages.join(", ")} · {extractResult.page_count} pages · Output: {fileNameFromPath(extractResult.output_path)}</span>
              )}
            </div>
          )}
        </section>

        <section className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-rotate-title">
          <div className="pdf-tools-section-heading">
            <span>One PDF · Selected pages</span>
            <h2 id="pdf-rotate-title">Rotate pages</h2>
            <p>Rotate selected pages by 90°, 180°, or 270° and save a new PDF.</p>
          </div>
          <p className="pdf-tools-helper">Page numbers start at 1. Examples: 1,3 or 1-3. The source PDF is not overwritten.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-outline" onClick={selectRotateInput} disabled={isAnyOperationRunning}>
              Select input PDF
            </button>
            <button
              type="button"
              className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
              onClick={selectRotateOutputPdf}
              disabled={!nativeDialogAvailable || isAnyOperationRunning}
            >
              {nativeDialogAvailable ? "Select output PDF" : "Output PDF (Desktop only)"}
            </button>
          </div>
          <input
            ref={rotateFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              selectBrowserRotateInput(event.currentTarget.files?.[0], event.currentTarget)
            }
          />

          <dl className="pdf-tools-selection-details">
            <div><dt>Input PDF</dt><dd>{rotateInput?.name ?? "Not selected"}</dd></div>
            <div>
              <dt>Output PDF</dt>
              <dd className="pdf-tools-path">
                {rotateOutputPath ? fileNameFromPath(rotateOutputPath) : "Not selected"}
              </dd>
            </div>
          </dl>

          <OperationInputSummary
            fileName={rotateInput?.name}
            summary={rotateInputSummary}
            guidance="Page count helps confirm which pages to rotate."
          />

          <label className="pdf-tools-field">
            <span>Pages</span>
            <input
              type="text"
              inputMode="numeric"
              value={rotatePagesInput}
              onChange={(event) => {
                setRotatePagesInput(event.currentTarget.value);
                setRotateResult(null);
                setRotateFeedback(null);
                setRotateError(null);
              }}
              disabled={isAnyOperationRunning}
              placeholder="1,3 or 1-3"
            />
          </label>
          {rotatePagesInput.trim() && parsedRotatePages.error && (
            <p className="pdf-tools-field-error">{parsedRotatePages.error}</p>
          )}

          <label className="pdf-tools-field">
            <span>Angle</span>
            <select
              value={rotateAngle}
              onChange={(event) => setRotateAngle(Number(event.currentTarget.value) as 90 | 180 | 270)}
              disabled={isAnyOperationRunning}
            >
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </label>

          <PageOperationPlan
            operation="Rotate"
            pagesInput={rotatePagesInput}
            summary={rotateInputSummary}
            angle={rotateAngle}
          />

          <button type="button" className="btn btn-primary" onClick={rotatePdfPages} disabled={!canRotate}>
            {isRotating ? "Rotating..." : "Rotate pages"}
          </button>
          {!canRotate && !isRotating && (
            <p className="pdf-tools-operation-requirements">To enable Rotate: {rotateDisabledReason}</p>
          )}

          {isRotating && <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">Rotating the selected pages into a new PDF...</div>}
          {rotateError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{rotateError}</div>}
          {!rotateError && !isRotating && rotateFeedback && (
            <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status">
              <strong>{rotateFeedback}</strong>
              {rotateResult && (
                <span>Pages {rotateResult.rotated_pages.join(", ")} · {rotateResult.angle_degrees}° · {rotateResult.page_count} total pages · Output: {fileNameFromPath(rotateResult.output_path)}</span>
              )}
            </div>
          )}
        </section>

        <section className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-delete-title">
          <div className="pdf-tools-section-heading">
            <span>Whole-page removal</span>
            <h2 id="pdf-delete-title">Delete pages</h2>
            <p>Remove selected whole pages and save the remaining pages as a new PDF.</p>
          </div>
          <p className="pdf-tools-helper">Page numbers start at 1. Examples: 2,4 or 2-4. The source PDF is not overwritten.</p>
          <p className="pdf-tools-warning"><strong>Not redaction:</strong> Delete pages removes whole pages only. It cannot safely hide selected text or personal information inside a page.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-outline" onClick={selectDeleteInput} disabled={isAnyOperationRunning}>
              Select input PDF
            </button>
            <button
              type="button"
              className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
              onClick={selectDeleteOutputPdf}
              disabled={!nativeDialogAvailable || isAnyOperationRunning}
            >
              {nativeDialogAvailable ? "Select output PDF" : "Output PDF (Desktop only)"}
            </button>
          </div>
          <input
            ref={deleteFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              selectBrowserDeleteInput(event.currentTarget.files?.[0], event.currentTarget)
            }
          />

          <dl className="pdf-tools-selection-details">
            <div><dt>Input PDF</dt><dd>{deleteInput?.name ?? "Not selected"}</dd></div>
            <div>
              <dt>Output PDF</dt>
              <dd className="pdf-tools-path">
                {deleteOutputPath ? fileNameFromPath(deleteOutputPath) : "Not selected"}
              </dd>
            </div>
          </dl>

          <OperationInputSummary
            fileName={deleteInput?.name}
            summary={deleteInputSummary}
            guidance="Page count helps avoid deleting all pages. Delete pages is not redaction."
          />

          <label className="pdf-tools-field">
            <span>Pages</span>
            <input
              type="text"
              inputMode="numeric"
              value={deletePagesInput}
              onChange={(event) => {
                setDeletePagesInput(event.currentTarget.value);
                setDeleteResult(null);
                setDeleteFeedback(null);
                setDeleteError(null);
              }}
              disabled={isAnyOperationRunning}
              placeholder="2,4 or 2-4"
            />
          </label>
          {deletePagesInput.trim() && parsedDeletePages.error && (
            <p className="pdf-tools-field-error">{parsedDeletePages.error}</p>
          )}

          <PageOperationPlan
            operation="Delete"
            pagesInput={deletePagesInput}
            summary={deleteInputSummary}
          />

          <button type="button" className="btn btn-primary" onClick={deletePdfPages} disabled={!canDelete}>
            {isDeleting ? "Deleting..." : "Delete pages"}
          </button>
          {!canDelete && !isDeleting && (
            <p className="pdf-tools-operation-requirements">To enable Delete: {deleteDisabledReason}</p>
          )}

          {isDeleting && <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">Removing the selected whole pages into a new PDF...</div>}
          {deleteError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{deleteError}</div>}
          {!deleteError && !isDeleting && deleteFeedback && (
            <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status">
              <strong>{deleteFeedback}</strong>
              {deleteResult && (
                <span>Pages {deleteResult.deleted_pages.join(", ")} deleted · {deleteResult.original_page_count} original pages · {deleteResult.remaining_page_count} remaining · Output: {fileNameFromPath(deleteResult.output_path)}</span>
              )}
            </div>
          )}
        </section>

        <section className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-reorder-title">
          <div className="pdf-tools-section-heading">
            <span>One PDF · Full page order</span>
            <h2 id="pdf-reorder-title">Reorder pages</h2>
            <p>Choose a PDF, enter the full page order, and save a new PDF.</p>
          </div>
          <p className="pdf-tools-helper">Page order example: 3,1,2. Reorder requires every page exactly once.</p>
          <p className="pdf-tools-warning"><strong>Whole pages only:</strong> Reorder changes page sequence. It does not edit PDF text or page content.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-outline" onClick={selectReorderInput} disabled={isAnyOperationRunning}>
              Select input PDF
            </button>
            <button
              type="button"
              className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
              onClick={selectReorderOutputPdf}
              disabled={!nativeDialogAvailable || isAnyOperationRunning}
            >
              {nativeDialogAvailable ? "Select output PDF" : "Output PDF (Desktop only)"}
            </button>
          </div>
          <input
            ref={reorderFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              selectBrowserReorderInput(event.currentTarget.files?.[0], event.currentTarget)
            }
          />

          <dl className="pdf-tools-selection-details">
            <div><dt>Input PDF</dt><dd>{reorderInput?.name ?? "Not selected"}</dd></div>
            <div>
              <dt>Output PDF</dt>
              <dd className="pdf-tools-path">
                {reorderOutputPath ? fileNameFromPath(reorderOutputPath) : "Not selected"}
              </dd>
            </div>
          </dl>

          <OperationInputSummary
            fileName={reorderInput?.name}
            summary={reorderInputSummary}
            guidance="Page count is required to validate that every page appears exactly once."
          />

          <label className="pdf-tools-field">
            <span>Page order</span>
            <input
              type="text"
              inputMode="numeric"
              value={reorderPageOrderInput}
              onChange={(event) => {
                setReorderPageOrderInput(event.currentTarget.value);
                setReorderResult(null);
                setReorderFeedback(null);
                setReorderError(null);
              }}
              disabled={isAnyOperationRunning}
              placeholder="3,1,2"
            />
          </label>
          {reorderPageOrderInput.trim() && reorderInputSummary.result && !parsedReorderPageOrder.isValid && (
            <p className="pdf-tools-field-error">Check the page-order warnings in the operation plan below.</p>
          )}

          <ReorderOperationPlan
            pageOrderInput={reorderPageOrderInput}
            summary={reorderInputSummary}
          />

          <button type="button" className="btn btn-primary" onClick={reorderPdfPages} disabled={!canReorder}>
            {isReordering ? "Reordering..." : "Reorder pages"}
          </button>
          {!canReorder && !isReordering && (
            <p className="pdf-tools-operation-requirements">To enable Reorder: {reorderDisabledReason}</p>
          )}

          {isReordering && <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">Writing the reordered pages to a new PDF...</div>}
          {reorderError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{reorderError}</div>}
          {!reorderError && !isReordering && reorderFeedback && (
            <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status">
              <strong>{reorderFeedback}</strong>
              {reorderResult && (
                <span>Order {reorderResult.page_order.join(" → ")} · {reorderResult.page_count} pages · Output: {fileNameFromPath(reorderResult.output_path)}</span>
              )}
            </div>
          )}
        </section>
          </div>
        </main>

        <aside className="pdf-tools-workbench-sidebar" aria-label="Results and safety">
          <section className="pdf-tools-panel pdf-tools-sidebar-card" aria-labelledby="pdf-operation-status-title">
            <div className="pdf-tools-section-heading">
              <span>Results</span>
              <h2 id="pdf-operation-status-title">Operation status</h2>
              <p>Current status is shown without exposing full local paths.</p>
            </div>
            <ul className="pdf-tools-status-list">
              <li><span>Inspect</span><strong className={isInspecting ? "is-running" : inspectError ? "is-error" : inspectResult ? "is-success" : ""}>{isInspecting ? "Running" : inspectError ? "Needs attention" : inspectResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Merge</span><strong className={isMerging ? "is-running" : error ? "is-error" : mergeResult ? "is-success" : ""}>{isMerging ? "Running" : error ? "Needs attention" : mergeResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Split</span><strong className={isSplitting ? "is-running" : splitError ? "is-error" : splitResult ? "is-success" : ""}>{isSplitting ? "Running" : splitError ? "Needs attention" : splitResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Extract</span><strong className={isExtracting ? "is-running" : extractError ? "is-error" : extractResult ? "is-success" : ""}>{isExtracting ? "Running" : extractError ? "Needs attention" : extractResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Rotate</span><strong className={isRotating ? "is-running" : rotateError ? "is-error" : rotateResult ? "is-success" : ""}>{isRotating ? "Running" : rotateError ? "Needs attention" : rotateResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Delete</span><strong className={isDeleting ? "is-running" : deleteError ? "is-error" : deleteResult ? "is-success" : ""}>{isDeleting ? "Running" : deleteError ? "Needs attention" : deleteResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Reorder</span><strong className={isReordering ? "is-running" : reorderError ? "is-error" : reorderResult ? "is-success" : ""}>{isReordering ? "Running" : reorderError ? "Needs attention" : reorderResult ? "Completed" : "Ready"}</strong></li>
            </ul>
            <p className="pdf-tools-status-help">Detailed success and error messages remain inside each operation card.</p>
          </section>

          <section className="pdf-tools-panel pdf-tools-sidebar-card" aria-labelledby="available-pdf-tools-title">
            <div className="pdf-tools-section-heading">
              <span>Available</span>
              <h2 id="available-pdf-tools-title">Local PDF operations</h2>
            </div>
            <div className="pdf-tools-capability-list pdf-tools-capability-available">
              {['Inspect PDF summary', 'Merge PDFs', 'Split PDF', 'Extract pages', 'Rotate pages', 'Delete pages', 'Reorder pages'].map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </section>

          <section className="pdf-tools-panel pdf-tools-sidebar-card" aria-labelledby="planned-pdf-tools-title">
            <div className="pdf-tools-section-heading">
              <span>Planned</span>
              <h2 id="planned-pdf-tools-title">Future workspace tools</h2>
              <p>Planning only. Not available in this release.</p>
            </div>
            <div className="pdf-tools-capability-list pdf-tools-capability-planned">
              {plannedPageTools.map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </section>

          <section className="pdf-tools-panel pdf-tools-sidebar-card pdf-tools-research" aria-labelledby="advanced-pdf-tools-title">
            <div className="pdf-tools-section-heading">
              <span>Research · Safety critical</span>
              <h2 id="advanced-pdf-tools-title">Not implemented</h2>
            </div>
            <div className="pdf-tools-capability-list pdf-tools-capability-research">
              {researchTools.map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </section>

          <section className="pdf-tools-panel pdf-tools-sidebar-card pdf-tools-safety" aria-labelledby="pdf-safety-title">
            <div className="pdf-tools-section-heading">
              <span>Important</span>
              <h2 id="pdf-safety-title">Safety notes</h2>
            </div>
            <ul>
              <li>PDF files stay on this device. Full local paths are not shown.</li>
              <li>Original files are not overwritten by default.</li>
              <li>Protected PDFs are rejected. Utility Tools Hub does not decrypt PDFs or bypass permissions.</li>
              <li>Delete pages removes whole pages only; it is not redaction. Visual masks do not remove underlying content.</li>
              <li>OCR and direct text editing are not implemented.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
