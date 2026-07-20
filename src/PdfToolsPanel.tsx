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

type PageParseResult =
  | { pages: number[]; error: null }
  | { pages: null; error: string };

const plannedPageTools = [
  "Page preview",
  "Reorder pages",
  "Add page numbers",
  "Add watermark",
  "Add text stamp",
  "Add image stamp",
  "PDF to images",
  "Images to PDF",
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
const POLL_INTERVAL_MS = 500;
const MAX_EXPANDED_PAGES = 10_000;

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
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

export default function PdfToolsPanel({ onBack }: PdfToolsPanelProps) {
  const mergeFileInputRef = useRef<HTMLInputElement>(null);
  const splitFileInputRef = useRef<HTMLInputElement>(null);
  const extractFileInputRef = useRef<HTMLInputElement>(null);
  const rotateFileInputRef = useRef<HTMLInputElement>(null);
  const deleteFileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  const isRunningRef = useRef(false);

  const [selectedPdfs, setSelectedPdfs] = useState<SelectedPdf[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<PdfMergeResult | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const nativeDialogAvailable = isTauri();
  const parsedExtractPages = parsePageSelection(extractPagesInput);
  const parsedRotatePages = parsePageSelection(rotatePagesInput);
  const parsedDeletePages = parsePageSelection(deletePagesInput);

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

  const executeAdditionalPdfTool = async <T,>(
    toolId: string,
    input: Record<string, unknown>,
    setRunning: (running: boolean) => void,
    onSuccess: (result: T) => void,
    onFailure: () => void,
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

          onFailure();
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
      setSplitError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setSplitInput({ name: file.name });
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
      setExtractError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setExtractInput({ name: file.name });
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
      setRotateError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setRotateInput({ name: file.name });
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
      setDeleteError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setDeleteInput({ name: file.name });
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

  const hasDesktopInputPaths =
    selectedPdfs.length > 0 && selectedPdfs.every((pdf) => typeof pdf.path === "string");
  const isAnyOperationRunning =
    isMerging || isSplitting || isExtracting || isRotating || isDeleting;
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
  const mergeDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : selectedPdfs.length < 2
      ? "Select at least two PDF files."
      : !hasDesktopInputPaths
        ? "Select the input PDFs again with the desktop file picker."
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
        <span className="pdf-tools-planned-badge">Merge · Split · Extract · Rotate · Delete MVP</span>
      </div>

      <div className="pdf-tools-notice" role="note">
        <strong>Merge, Split, Extract, Rotate, and Delete are available as local page-operation MVPs.</strong>
        <span>Preview, reorder, and overlay writing are planned. OCR, redaction, and direct text editing remain research topics.</span>
      </div>

      <div className="pdf-tools-workbench-grid">
        <aside className="pdf-tools-workbench-files" aria-label="Selected PDF files">
          <section className="pdf-tools-panel pdf-tools-sidebar-card">
            <div className="pdf-tools-section-heading">
              <span>Files</span>
              <h2>Selected files</h2>
              <p>Each operation keeps its own file selection in this UI shell.</p>
            </div>
            <dl className="pdf-tools-file-overview">
              <div><dt>Merge</dt><dd>{selectedPdfs.length > 0 ? `${selectedPdfs.length} PDFs selected` : "No files selected"}</dd></div>
              <div><dt>Split</dt><dd>{splitInput?.name ?? "No file selected"}</dd></div>
              <div><dt>Extract</dt><dd>{extractInput?.name ?? "No file selected"}</dd></div>
              <div><dt>Rotate</dt><dd>{rotateInput?.name ?? "No file selected"}</dd></div>
              <div><dt>Delete</dt><dd>{deleteInput?.name ?? "No file selected"}</dd></div>
            </dl>
            <div className="pdf-tools-local-notes">
              <p>PDF files stay on this device.</p>
              <p>Original files are not overwritten by default.</p>
              <p>Encrypted or permission-protected PDFs are not supported.</p>
            </div>
          </section>

          <section className="pdf-tools-panel pdf-tools-future-workspace" aria-labelledby="future-page-area-title">
            <div className="pdf-tools-section-heading">
              <span>Future workspace</span>
              <h2 id="future-page-area-title">Page list and preview</h2>
              <p>This reserved area is not interactive in the current release.</p>
            </div>
            <div className="pdf-tools-preview-placeholder" aria-label="Page preview planned">
              <span>Preview planned</span>
              <small>Page thumbnails and reorder are not implemented.</small>
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
            <span>Available MVP</span>
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
            <span>Available MVP</span>
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
            <span>Available MVP</span>
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
            <span>Available MVP</span>
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
              <li><span>Merge</span><strong className={isMerging ? "is-running" : error ? "is-error" : mergeResult ? "is-success" : ""}>{isMerging ? "Running" : error ? "Needs attention" : mergeResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Split</span><strong className={isSplitting ? "is-running" : splitError ? "is-error" : splitResult ? "is-success" : ""}>{isSplitting ? "Running" : splitError ? "Needs attention" : splitResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Extract</span><strong className={isExtracting ? "is-running" : extractError ? "is-error" : extractResult ? "is-success" : ""}>{isExtracting ? "Running" : extractError ? "Needs attention" : extractResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Rotate</span><strong className={isRotating ? "is-running" : rotateError ? "is-error" : rotateResult ? "is-success" : ""}>{isRotating ? "Running" : rotateError ? "Needs attention" : rotateResult ? "Completed" : "Ready"}</strong></li>
              <li><span>Delete</span><strong className={isDeleting ? "is-running" : deleteError ? "is-error" : deleteResult ? "is-success" : ""}>{isDeleting ? "Running" : deleteError ? "Needs attention" : deleteResult ? "Completed" : "Ready"}</strong></li>
            </ul>
            <p className="pdf-tools-status-help">Detailed success and error messages remain inside each operation card.</p>
          </section>

          <section className="pdf-tools-panel pdf-tools-sidebar-card" aria-labelledby="available-pdf-tools-title">
            <div className="pdf-tools-section-heading">
              <span>Available</span>
              <h2 id="available-pdf-tools-title">Page-operation MVPs</h2>
            </div>
            <div className="pdf-tools-capability-list pdf-tools-capability-available">
              {['Merge PDFs', 'Split PDF', 'Extract pages', 'Rotate pages', 'Delete pages'].map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </section>

          <section className="pdf-tools-panel pdf-tools-sidebar-card" aria-labelledby="planned-pdf-tools-title">
            <div className="pdf-tools-section-heading">
              <span>Planned</span>
              <h2 id="planned-pdf-tools-title">Future workspace tools</h2>
              <p>Visible for planning only. These controls are not available.</p>
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
              <li>PDF files stay on this device.</li>
              <li>Original files are not overwritten by default.</li>
              <li>Protected PDFs are rejected unless explicitly supported in the future.</li>
              <li>Delete pages removes whole pages only. It is not redaction.</li>
              <li>Visual masks are not safe redaction.</li>
              <li>Redaction must remove underlying content.</li>
              <li>OCR and direct text editing are not implemented.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
