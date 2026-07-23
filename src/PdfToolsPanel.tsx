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

type SelectedImage = {
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

type PdfTextWatermarkResult = {
  input_path: string;
  output_path: string;
  text: string;
  pages: number[];
  page_count: number;
};

type PdfImageWatermarkResult = {
  input_path: string;
  output_path: string;
  image_path: string;
  pages: number[];
  page_count: number;
  position: string;
  width: number;
  height: number;
  opacity: number;
  rotation_degrees: number;
};

type PdfPageNumbersResult = {
  input_path: string;
  output_path: string;
  pages: number[];
  page_count: number;
  start_number: number;
  format: PageNumberFormat;
  position: PageNumberPosition;
};

type PdfTextStampResult = {
  input_path: string;
  output_path: string;
  text: string;
  pages: number[];
  page_count: number;
  position: TextStampPosition;
  font_size: number;
  opacity: number;
  rotation_degrees: number;
  color: TextStampColor;
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

type PdfWorkbenchOperation =
  | "inspect"
  | "merge"
  | "split"
  | "extract"
  | "rotate"
  | "delete"
  | "reorder"
  | "textWatermark"
  | "pageNumbers"
  | "imageWatermark"
  | "textStamp";

type PageNumberFormat =
  | "number"
  | "page-number"
  | "page-number-of-total"
  | "number-slash-total"
  | "dash-number";

type PageNumberPosition =
  | "bottom-center"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "top-right"
  | "top-left";

type TextStampPosition =
  | "center"
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type TextStampColor = "black" | "red" | "gray";

const pdfWorkbenchOperations: ReadonlyArray<{
  id: PdfWorkbenchOperation;
  label: string;
}> = [
  { id: "inspect", label: "Inspect" },
  { id: "merge", label: "Merge" },
  { id: "split", label: "Split" },
  { id: "extract", label: "Extract" },
  { id: "rotate", label: "Rotate" },
  { id: "delete", label: "Delete" },
  { id: "reorder", label: "Reorder" },
  { id: "textWatermark", label: "Text watermark" },
  { id: "pageNumbers", label: "Page numbers" },
  { id: "imageWatermark", label: "Image watermark" },
  { id: "textStamp", label: "Text stamp" },
];

const plannedPageTools = [
  "PNG alpha image watermark",
  "Image stamp",
  "Text stamp border / background",
  "Text stamp color presets polish",
  "Drag-and-drop reorder",
  "Real PDF page preview",
  "Page thumbnails",
  "Overlay writing",
] as const;

const researchTools = [
  "Safe redaction",
  "OCR-assisted workflow",
  "Direct PDF text editing",
  "Existing image / page-number / watermark removal research",
] as const;

const PDF_MERGE_TOOL_ID = "pdf_merge";
const PDF_SPLIT_TOOL_ID = "pdf_split";
const PDF_EXTRACT_TOOL_ID = "pdf_extract";
const PDF_ROTATE_TOOL_ID = "pdf_rotate";
const PDF_DELETE_TOOL_ID = "pdf_delete";
const PDF_REORDER_TOOL_ID = "pdf_reorder";
const PDF_TEXT_WATERMARK_TOOL_ID = "pdf_text_watermark";
const PDF_PAGE_NUMBERS_TOOL_ID = "pdf_page_numbers";
const PDF_IMAGE_WATERMARK_TOOL_ID = "pdf_image_watermark";
const PDF_TEXT_STAMP_TOOL_ID = "pdf_text_stamp";
const PDF_INSPECT_TOOL_ID = "pdf_inspect";
const POLL_INTERVAL_MS = 500;
const MAX_EXPANDED_PAGES = 10_000;
const MAX_VISIBLE_PLAN_PAGES = 18;

const pageNumberFormatOptions: ReadonlyArray<{ value: PageNumberFormat; label: string }> = [
  { value: "number", label: "Number only: 1" },
  { value: "page-number", label: "Page number: Page 1" },
  { value: "page-number-of-total", label: "Page number of total: Page 1 of 10" },
  { value: "number-slash-total", label: "Number / total: 1 / 10" },
  { value: "dash-number", label: "Dash number: - 1 -" },
];

const pageNumberPositionOptions: ReadonlyArray<{ value: PageNumberPosition; label: string }> = [
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

const textStampPositionOptions: ReadonlyArray<{ value: TextStampPosition; label: string }> = [
  { value: "center", label: "Center" },
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
];

const textStampColorOptions: ReadonlyArray<{ value: TextStampColor; label: string }> = [
  { value: "black", label: "Black" },
  { value: "red", label: "Red" },
  { value: "gray", label: "Gray" },
];

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

function watermarkFailureMessage(reason?: string | null): string {
  const knownMessages: Record<string, string> = {
    "every input file must use the .pdf extension": "The input file must use the .pdf extension.",
    "the output file must use the .pdf extension": "The output file must use the .pdf extension.",
    "an input PDF file does not exist": "The selected PDF could not be found. Select it again.",
    "the output directory does not exist": "The selected output folder no longer exists. Choose the output PDF again.",
    "the output file must differ from every input file": "The output PDF must be different from the input PDF.",
    "watermark text must not be empty": "Enter watermark text such as DRAFT or CONFIDENTIAL.",
    "watermark text currently supports printable ASCII characters only":
      "Text watermark currently supports printable ASCII / Latin text only. Japanese text requires future font embedding support.",
    "watermark opacity must be greater than 0 and no greater than 1": "Opacity must be greater than 0 and no greater than 1.",
    "watermark rotation must be a finite value from -360 to 360 degrees": "Rotation must be between -360 and 360 degrees.",
    "watermark font size must be a finite value from 8 to 200 points": "Font size must be between 8 and 200 points.",
    "page numbers must be one or greater": "Page numbers must be whole numbers greater than zero.",
    "a selected page is outside the input PDF page range": "The page selection contains a page outside the input PDF range.",
    "duplicate page numbers are not supported": "Enter each target page only once.",
    "encrypted or permission-protected PDF files are not supported yet":
      "Protected PDFs are not supported. Utility Tools Hub does not decrypt PDFs or bypass permissions.",
    "an input file is not a supported PDF document": "The input file is not a supported PDF document.",
    "the output PDF could not be saved": "The output PDF could not be saved. Choose a writable location and try again.",
  };

  return (
    (reason ? knownMessages[reason.trim()] : undefined) ??
    "Text watermark failed. Check the input PDF, watermark settings, and writable output location, then try again."
  );
}

function imageWatermarkFailureMessage(reason?: string | null): string {
  const knownMessages: Record<string, string> = {
    "every input file must use the .pdf extension": "The input file must use the .pdf extension.",
    "the output file must use the .pdf extension": "The output file must use the .pdf extension.",
    "an input PDF file does not exist": "The selected PDF could not be found. Select it again.",
    "the output directory does not exist": "The selected output folder no longer exists. Choose the output PDF again.",
    "the output file must differ from every input file": "The output PDF must be different from the input PDF.",
    "the watermark image must use the .jpg or .jpeg extension": "Select a JPEG image with the .jpg or .jpeg extension. PNG, WebP, and SVG are not supported.",
    "the watermark image file does not exist": "The selected JPEG image could not be found. Select it again.",
    "the watermark JPEG file is too large": "The JPEG image exceeds the supported file-size limit.",
    "the watermark image is not a valid baseline JPEG file": "The image is not a valid supported baseline JPEG.",
    "the watermark JPEG must use 8-bit baseline sequential encoding": "Progressive or non-baseline JPEG encoding is not supported.",
    "the watermark JPEG must use grayscale or three-component color": "Only grayscale or RGB JPEG images are supported. CMYK/YCCK JPEG is not supported.",
    "the watermark JPEG dimensions are zero or exceed the supported limit": "The JPEG dimensions are zero or exceed the supported limit.",
    "image watermark width must be a finite value from 8 to 1440 points": "Width must be between 8 and 1440 points.",
    "image watermark opacity must be greater than 0 and no greater than 1": "Opacity must be greater than 0 and no greater than 1.",
    "image watermark rotation must be a finite value from -360 to 360 degrees": "Rotation must be between -360 and 360 degrees.",
    "the image watermark does not fit inside a selected PDF page": "The rotated image does not fit inside one or more selected PDF pages. Reduce its width or rotation.",
    "page numbers must be one or greater": "Page numbers must be whole numbers greater than zero.",
    "a selected page is outside the input PDF page range": "The page selection contains a page outside the input PDF range.",
    "duplicate page numbers are not supported": "Enter each target page only once.",
    "encrypted or permission-protected PDF files are not supported yet":
      "Protected PDFs are not supported. Utility Tools Hub does not decrypt PDFs or bypass permissions.",
    "an input file is not a supported PDF document": "The input file is not a supported PDF document.",
    "the output PDF could not be saved": "The output PDF could not be saved. Choose a writable location and try again.",
  };

  return (
    (reason ? knownMessages[reason.trim()] : undefined) ??
    "Image watermark failed. Check the input PDF, baseline JPEG image, settings, and writable output location, then try again."
  );
}

function imageWatermarkImageValidationMessage(image: SelectedImage | null): string | null {
  if (!image) return "Select a JPEG image.";
  if (!/\.(jpe?g)$/i.test(image.name)) {
    return "JPEG/JPG only. PNG, WebP, and SVG are not supported.";
  }
  if (!image.path) return "Select the JPEG again with the desktop file picker.";
  return null;
}

function pageNumbersFailureMessage(reason?: string | null): string {
  const knownMessages: Record<string, string> = {
    "every input file must use the .pdf extension": "The input file must use the .pdf extension.",
    "the output file must use the .pdf extension": "The output file must use the .pdf extension.",
    "an input PDF file does not exist": "The selected PDF could not be found. Select it again.",
    "the output directory does not exist": "The selected output folder no longer exists. Choose the output PDF again.",
    "the output file must differ from every input file": "The output PDF must be different from the input PDF.",
    "page numbers must be one or greater": "Page numbers must be whole numbers greater than zero.",
    "a selected page is outside the input PDF page range": "The page selection contains a page outside the input PDF range.",
    "duplicate page numbers are not supported": "Enter each target page only once.",
    "page number start must be one or greater": "Start number must be a whole number greater than zero.",
    "the page number format is not supported": "Select one of the supported page-number formats.",
    "the page number position is not supported": "Select one of the supported page-number positions.",
    "page number margins must be finite values from 0 to 144 points and fit the page":
      "Margins must be between 0 and 144 points and fit the selected PDF pages.",
    "page number font size must be a finite value from 6 to 72 points": "Font size must be between 6 and 72 points.",
    "encrypted or permission-protected PDF files are not supported yet":
      "Protected PDFs are not supported. Utility Tools Hub does not decrypt PDFs or bypass permissions.",
    "an input file is not a supported PDF document": "The input file is not a supported PDF document.",
    "the output PDF could not be saved": "The output PDF could not be saved. Choose a writable location and try again.",
  };

  return (
    (reason ? knownMessages[reason.trim()] : undefined) ??
    "Page numbers failed. Check the input PDF, page-number settings, and writable output location, then try again."
  );
}

function textStampFailureMessage(reason?: string | null): string {
  const knownMessages: Record<string, string> = {
    "every input file must use the .pdf extension": "The input file must use the .pdf extension.",
    "the output file must use the .pdf extension": "The output file must use the .pdf extension.",
    "an input PDF file does not exist": "The selected PDF could not be found. Select it again.",
    "the output directory does not exist": "The selected output folder no longer exists. Choose the output PDF again.",
    "the output file must differ from every input file": "The output PDF must be different from the input PDF.",
    "text stamp text must not be empty": "Enter short stamp text such as APPROVED.",
    "text stamp text must be a single line of at most 64 printable ASCII or Latin-1 characters":
      "Use one line of at most 64 printable ASCII or Latin-1 characters. Japanese text is not supported yet.",
    "the text stamp position is not supported": "Select one of the supported stamp positions.",
    "text stamp margins must be finite values from 0 to 144 points and fit the page":
      "Margins must be between 0 and 144 points and fit the selected PDF pages.",
    "text stamp font size must be a finite value from 8 to 144 points": "Font size must be between 8 and 144 points.",
    "text stamp opacity must be greater than 0 and no greater than 1": "Opacity must be greater than 0 and no greater than 1.",
    "text stamp rotation must be a finite value from -360 to 360 degrees": "Rotation must be between -360 and 360 degrees.",
    "the text stamp color is not supported": "Select black, red, or gray.",
    "page numbers must be one or greater": "Page numbers must be whole numbers greater than zero.",
    "a selected page is outside the input PDF page range": "The page selection contains a page outside the input PDF range.",
    "duplicate page numbers are not supported": "Enter each target page only once.",
    "encrypted or permission-protected PDF files are not supported yet":
      "Protected PDFs are not supported. Utility Tools Hub does not decrypt PDFs or bypass permissions.",
    "an input file is not a supported PDF document": "The input file is not a supported PDF document.",
    "the output PDF could not be saved": "The output PDF could not be saved. Choose a writable location and try again.",
  };

  return (
    (reason ? knownMessages[reason.trim()] : undefined) ??
    "Text stamp failed. Check the input PDF, stamp settings, and writable output location, then try again."
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

function parseOptionalPageSelection(value: string, pageCount?: number | null): PagePlanParseResult {
  if (!value.trim()) return { pages: [], error: null };
  return parsePageSelectionForPlan(value, pageCount);
}

function watermarkTextValidationMessage(value: string): string | null {
  if (!value.trim()) return "Text is required.";
  if (value.length > 128) return "Watermark text must be 128 characters or fewer.";
  if (!/^[\x20-\x7e]+$/.test(value)) {
    return "Non-ASCII text is not supported yet. Japanese text requires future font embedding support.";
  }
  return null;
}

function textStampTextValidationMessage(value: string): string | null {
  if (!value.trim()) return "Text is required.";
  if (/\r|\n/.test(value)) return "Stamp text must use a single line.";
  if (value.length > 64) return "Stamp text must be 64 characters or fewer.";
  if (!/^[\x20-\x7e\u00a0-\u00ff]+$/.test(value)) {
    return "Use printable ASCII or Latin-1 characters only. Japanese text is not supported yet.";
  }
  return null;
}

function outputPdfValidationMessage(path: string | null): string | null {
  if (!path) return "Select an output PDF.";
  if (!/\.pdf$/i.test(path)) return "The output file must use the .pdf extension.";
  return null;
}

function parseFiniteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveIntegerValidationMessage(value: string, label: string): string | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) return `${label} must be a number.`;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return `${label} must be a whole number greater than zero.`;
  }
  return null;
}

function boundedNumberValidationMessage(
  value: string,
  label: string,
  minimum: number,
  maximum: number,
): string | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) return `${label} must be a number.`;
  if (parsed < minimum || parsed > maximum) {
    return `${label} must be between ${minimum} and ${maximum}.`;
  }
  return null;
}

function pageNumberMarginValidationMessage(value: string, label: string): string | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) return `${label} must be a number.`;
  if (parsed <= 0 || parsed > 144) {
    return `${label} must be greater than 0 and no greater than 144.`;
  }
  return null;
}

function pageNumberExample(format: PageNumberFormat, number: number, total: number | null): string {
  const safeTotal = total ?? "total";
  switch (format) {
    case "page-number":
      return `Page ${number}`;
    case "page-number-of-total":
      return `Page ${number} of ${safeTotal}`;
    case "number-slash-total":
      return `${number} / ${safeTotal}`;
    case "dash-number":
      return `- ${number} -`;
    default:
      return String(number);
  }
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

function TextWatermarkOperationPlan({
  summary,
  text,
  pagesInput,
  opacityInput,
  rotationInput,
  fontSizeInput,
  outputPath,
}: {
  summary: OperationInputSummaryState;
  text: string;
  pagesInput: string;
  opacityInput: string;
  rotationInput: string;
  fontSizeInput: string;
  outputPath: string | null;
}) {
  const result = summary.result;
  const pageCount = result?.page_count ?? null;
  const parsedPages = parseOptionalPageSelection(pagesInput, pageCount);
  const textError = watermarkTextValidationMessage(text);
  const opacity = parseFiniteNumber(opacityInput);
  const rotation = parseFiniteNumber(rotationInput);
  const fontSize = parseFiniteNumber(fontSizeInput);
  const opacityError = opacity === null || opacity <= 0 || opacity > 1
    ? "Opacity must be greater than 0 and no greater than 1."
    : null;
  const rotationError = rotation === null || rotation < -360 || rotation > 360
    ? "Rotation must be between -360 and 360 degrees."
    : null;
  const fontSizeError = fontSize === null || fontSize < 8 || fontSize > 200
    ? "Font size must be between 8 and 200 points."
    : null;
  const isProtected = Boolean(result && (result.is_encrypted || result.is_protected));
  const isValid = Boolean(
    result &&
      outputPath &&
      !textError &&
      !parsedPages.error &&
      !opacityError &&
      !rotationError &&
      !fontSizeError &&
      !isProtected,
  );

  return (
    <div className="pdf-tools-operation-plan" aria-label="Text watermark operation plan preview">
      <div className="pdf-tools-operation-plan-heading">
        <div>
          <span>Lightweight plan</span>
          <strong>Text watermark</strong>
        </div>
        <span className={`pdf-tools-operation-plan-status ${isValid ? "is-valid" : "is-check"}`}>
          {isValid ? "Valid" : "Needs check"}
        </span>
      </div>
      <p className="pdf-tools-operation-plan-note">Planning aid only — not a real PDF preview. PDF pages, watermark placement, and thumbnails are not rendered.</p>
      <dl className="pdf-tools-operation-plan-details">
        <div><dt>Input pages</dt><dd>{pageCount ?? "Unknown"}</dd></div>
        <div><dt>Target pages</dt><dd>{pagesInput.trim() || "All pages"}</dd></div>
        <div><dt>Watermark text</dt><dd>{text.trim() || "Not set"}</dd></div>
        <div><dt>Opacity</dt><dd>{opacity ?? "Invalid"}</dd></div>
        <div><dt>Rotation</dt><dd>{rotation !== null ? `${rotation}°` : "Invalid"}</dd></div>
        <div><dt>Font size</dt><dd>{fontSize !== null ? `${fontSize} pt` : "Invalid"}</dd></div>
        <div><dt>Output</dt><dd>{outputPath ? `New PDF · ${fileNameFromPath(outputPath)}` : "New PDF not selected"}</dd></div>
      </dl>
      <div className="pdf-tools-operation-plan-targets">
        <span>Selected page targets</span>
        {pagesInput.trim() ? (
          <PlanPageChips pages={parsedPages.pages} />
        ) : (
          <span className="pdf-tools-operation-plan-empty">All pages will receive the watermark.</span>
        )}
      </div>
      {textError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Check text:</strong> {textError}</p>}
      {parsedPages.error && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Check page selection:</strong> {parsedPages.error}</p>}
      {opacityError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid opacity:</strong> {opacityError}</p>}
      {rotationError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid rotation:</strong> {rotationError}</p>}
      {fontSizeError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid font size:</strong> {fontSizeError}</p>}
      {isProtected && (
        <p className="pdf-tools-operation-plan-warning is-protected" role="alert">
          <strong>Protected PDF:</strong> This operation may be rejected. Utility Tools Hub does not decrypt PDFs or bypass permissions.
        </p>
      )}
      <p className="pdf-tools-operation-plan-safety">
        <strong>Additive only · Not redaction:</strong> Text watermark adds a new content layer. It does not edit or replace existing PDF text and cannot safely hide content.
      </p>
    </div>
  );
}

function ImageWatermarkOperationPlan({
  summary,
  image,
  pagesInput,
  widthInput,
  opacityInput,
  rotationInput,
  outputPath,
}: {
  summary: OperationInputSummaryState;
  image: SelectedImage | null;
  pagesInput: string;
  widthInput: string;
  opacityInput: string;
  rotationInput: string;
  outputPath: string | null;
}) {
  const result = summary.result;
  const pageCount = result?.page_count ?? null;
  const parsedPages = parseOptionalPageSelection(pagesInput, pageCount);
  const imageError = imageWatermarkImageValidationMessage(image);
  const width = parseFiniteNumber(widthInput);
  const opacity = parseFiniteNumber(opacityInput);
  const rotation = parseFiniteNumber(rotationInput);
  const widthError = boundedNumberValidationMessage(widthInput, "Width", 8, 1440);
  const opacityError = opacity === null || opacity <= 0 || opacity > 1
    ? "Opacity must be greater than 0 and no greater than 1."
    : null;
  const rotationError = rotation === null || rotation < -360 || rotation > 360
    ? "Rotation must be between -360 and 360 degrees."
    : null;
  const isProtected = Boolean(result && (result.is_encrypted || result.is_protected));
  const isValid = Boolean(
    result &&
      image &&
      outputPath &&
      !imageError &&
      !parsedPages.error &&
      !widthError &&
      !opacityError &&
      !rotationError &&
      !isProtected,
  );

  return (
    <div className="pdf-tools-operation-plan" aria-label="Image watermark operation plan preview">
      <div className="pdf-tools-operation-plan-heading">
        <div>
          <span>Lightweight plan</span>
          <strong>JPEG image watermark</strong>
        </div>
        <span className={`pdf-tools-operation-plan-status ${isValid ? "is-valid" : "is-check"}`}>
          {isValid ? "Valid" : "Needs check"}
        </span>
      </div>
      <p className="pdf-tools-operation-plan-note">Planning aid only — not a real PDF or image preview. Placement and thumbnails are not rendered.</p>
      <dl className="pdf-tools-operation-plan-details">
        <div><dt>Input PDF</dt><dd>{result?.file_name ?? "Not selected"}</dd></div>
        <div><dt>Image file</dt><dd>{image?.name ?? "Not selected"}</dd></div>
        <div><dt>Target pages</dt><dd>{pagesInput.trim() || "All pages"}</dd></div>
        <div><dt>Position</dt><dd>Center · fixed</dd></div>
        <div><dt>Width</dt><dd>{widthError || width === null ? "Invalid" : `${width} pt`}</dd></div>
        <div><dt>Opacity</dt><dd>{opacityError || opacity === null ? "Invalid" : opacity}</dd></div>
        <div><dt>Rotation</dt><dd>{rotationError || rotation === null ? "Invalid" : `${rotation}°`}</dd></div>
        <div><dt>Format</dt><dd>Baseline grayscale/RGB JPEG only</dd></div>
        <div><dt>Output PDF</dt><dd>{outputPath ? `New PDF · ${fileNameFromPath(outputPath)}` : "Not selected"}</dd></div>
      </dl>
      <div className="pdf-tools-operation-plan-targets">
        <span>Selected page targets</span>
        {parsedPages.error ? (
          <span className="pdf-tools-operation-plan-empty">Review the page selection warning below.</span>
        ) : pagesInput.trim() ? (
          <PlanPageChips pages={parsedPages.pages} />
        ) : (
          <span className="pdf-tools-operation-plan-empty">All pages will receive the additive image watermark.</span>
        )}
      </div>
      {imageError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Check image:</strong> {imageError}</p>}
      {parsedPages.error && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Check page selection:</strong> {parsedPages.error}</p>}
      {widthError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid width:</strong> {widthError}</p>}
      {opacityError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid opacity:</strong> {opacityError}</p>}
      {rotationError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid rotation:</strong> {rotationError}</p>}
      {!outputPath && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Output required:</strong> Select a new output PDF.</p>}
      {isProtected && (
        <p className="pdf-tools-operation-plan-warning is-protected" role="alert">
          <strong>Protected PDF:</strong> Image watermark is unavailable. Utility Tools Hub does not decrypt PDFs or bypass permissions.
        </p>
      )}
      <p className="pdf-tools-operation-plan-safety">
        <strong>Additive only · Not redaction · Not PDF text editing:</strong> This adds a JPEG image layer to a new PDF. It does not remove existing images, text, or page numbers.
      </p>
    </div>
  );
}

function PageNumbersOperationPlan({
  summary,
  pagesInput,
  startNumberInput,
  format,
  position,
  marginXInput,
  marginYInput,
  fontSizeInput,
  outputPath,
}: {
  summary: OperationInputSummaryState;
  pagesInput: string;
  startNumberInput: string;
  format: PageNumberFormat;
  position: PageNumberPosition;
  marginXInput: string;
  marginYInput: string;
  fontSizeInput: string;
  outputPath: string | null;
}) {
  const result = summary.result;
  const pageCount = result?.page_count ?? null;
  const parsedPages = parseOptionalPageSelection(pagesInput, pageCount);
  const startNumber = parseFiniteNumber(startNumberInput);
  const marginX = parseFiniteNumber(marginXInput);
  const marginY = parseFiniteNumber(marginYInput);
  const fontSize = parseFiniteNumber(fontSizeInput);
  const startNumberError = positiveIntegerValidationMessage(startNumberInput, "Start number");
  const marginXError = pageNumberMarginValidationMessage(marginXInput, "Margin X");
  const marginYError = pageNumberMarginValidationMessage(marginYInput, "Margin Y");
  const fontSizeError = boundedNumberValidationMessage(fontSizeInput, "Font size", 6, 72);
  const isProtected = Boolean(result && (result.is_encrypted || result.is_protected));
  const isValid = Boolean(
    result &&
      outputPath &&
      !parsedPages.error &&
      !startNumberError &&
      !marginXError &&
      !marginYError &&
      !fontSizeError &&
      !isProtected,
  );
  const formatLabel = pageNumberFormatOptions.find((option) => option.value === format)?.label ?? format;
  const positionLabel = pageNumberPositionOptions.find((option) => option.value === position)?.label ?? position;
  const example = startNumberError || startNumber === null
    ? "Invalid start number"
    : pageNumberExample(format, startNumber, pageCount);
  const targetPagesLabel = parsedPages.error
    ? "Invalid selection"
    : pagesInput.trim()
      ? `${parsedPages.pages.length} selected`
      : "All pages";
  const marginLabel = marginXError || marginYError || marginX === null || marginY === null
    ? "Invalid"
    : `${marginX} / ${marginY} pt`;
  const fontSizeLabel = fontSizeError || fontSize === null ? "Invalid" : `${fontSize} pt`;

  return (
    <div className="pdf-tools-operation-plan" aria-label="Page numbers operation plan preview">
      <div className="pdf-tools-operation-plan-heading">
        <div>
          <span>Lightweight plan</span>
          <strong>Page numbers</strong>
        </div>
        <span className={`pdf-tools-operation-plan-status ${isValid ? "is-valid" : "is-check"}`}>
          {isValid ? "Valid" : "Needs check"}
        </span>
      </div>
      <p className="pdf-tools-operation-plan-note">Planning aid only — not a real PDF preview. PDF pages, number placement, and thumbnails are not rendered.</p>
      <dl className="pdf-tools-operation-plan-details">
        <div><dt>Input pages</dt><dd>{pageCount ?? "Unknown"}</dd></div>
        <div><dt>Target pages</dt><dd>{targetPagesLabel}</dd></div>
        <div><dt>Start number</dt><dd>{startNumberError || startNumber === null ? "Invalid" : startNumber}</dd></div>
        <div><dt>Format</dt><dd>{formatLabel}</dd></div>
        <div><dt>Example output</dt><dd>{example}</dd></div>
        <div><dt>Position</dt><dd>{positionLabel}</dd></div>
        <div><dt>Margin X / Y</dt><dd>{marginLabel}</dd></div>
        <div><dt>Font size</dt><dd>{fontSizeLabel}</dd></div>
        <div><dt>Output</dt><dd>{outputPath ? `New PDF · ${fileNameFromPath(outputPath)}` : "New PDF not selected"}</dd></div>
      </dl>
      <div className="pdf-tools-operation-plan-targets">
        <span>Selected page targets</span>
        {parsedPages.error ? (
          <span className="pdf-tools-operation-plan-empty">Review the page selection warning below.</span>
        ) : pagesInput.trim() ? (
          <PlanPageChips pages={parsedPages.pages} />
        ) : (
          <span className="pdf-tools-operation-plan-empty">All pages will receive additive page numbers.</span>
        )}
      </div>
      {parsedPages.error && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid page range:</strong> {parsedPages.error}</p>}
      {startNumberError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid start number:</strong> {startNumberError}</p>}
      {marginXError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid margin:</strong> {marginXError}</p>}
      {marginYError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid margin:</strong> {marginYError}</p>}
      {fontSizeError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid font size:</strong> {fontSizeError}</p>}
      {isProtected && (
        <p className="pdf-tools-operation-plan-warning is-protected" role="alert">
          <strong>Protected PDF:</strong> Protected PDFs may be rejected. Utility Tools Hub does not decrypt PDFs or bypass permissions.
        </p>
      )}
      <p className="pdf-tools-operation-plan-safety">
        <strong>Additive only · Not redaction:</strong> The Page numbers operation adds new text to a new PDF. It does not edit existing PDF text, remove existing page numbers, or hide content.
      </p>
    </div>
  );
}

function TextStampOperationPlan({
  summary,
  text,
  pagesInput,
  position,
  marginXInput,
  marginYInput,
  fontSizeInput,
  opacityInput,
  rotationInput,
  color,
  outputPath,
}: {
  summary: OperationInputSummaryState;
  text: string;
  pagesInput: string;
  position: TextStampPosition;
  marginXInput: string;
  marginYInput: string;
  fontSizeInput: string;
  opacityInput: string;
  rotationInput: string;
  color: TextStampColor;
  outputPath: string | null;
}) {
  const result = summary.result;
  const pageCount = result?.page_count ?? null;
  const parsedPages = parseOptionalPageSelection(pagesInput, pageCount);
  const textError = textStampTextValidationMessage(text);
  const marginX = parseFiniteNumber(marginXInput);
  const marginY = parseFiniteNumber(marginYInput);
  const fontSize = parseFiniteNumber(fontSizeInput);
  const opacity = parseFiniteNumber(opacityInput);
  const rotation = parseFiniteNumber(rotationInput);
  const marginXError = boundedNumberValidationMessage(marginXInput, "Margin X", 0, 144);
  const marginYError = boundedNumberValidationMessage(marginYInput, "Margin Y", 0, 144);
  const fontSizeError = boundedNumberValidationMessage(fontSizeInput, "Font size", 8, 144);
  const opacityError = opacity === null || opacity <= 0 || opacity > 1
    ? "Opacity must be greater than 0 and no greater than 1."
    : null;
  const rotationError = rotation === null || rotation < -360 || rotation > 360
    ? "Rotation must be between -360 and 360 degrees."
    : null;
  const outputError = outputPdfValidationMessage(outputPath);
  const isProtected = Boolean(result && (result.is_encrypted || result.is_protected));
  const isValid = Boolean(
    result &&
      !textError &&
      !parsedPages.error &&
      !marginXError &&
      !marginYError &&
      !fontSizeError &&
      !opacityError &&
      !rotationError &&
      !outputError &&
      !isProtected,
  );
  const positionLabel = textStampPositionOptions.find((option) => option.value === position)?.label ?? position;
  const colorLabel = textStampColorOptions.find((option) => option.value === color)?.label ?? color;

  return (
    <div className="pdf-tools-operation-plan" aria-label="Text stamp operation plan preview">
      <div className="pdf-tools-operation-plan-heading">
        <div>
          <span>Lightweight plan</span>
          <strong>Text stamp</strong>
        </div>
        <span className={`pdf-tools-operation-plan-status ${isValid ? "is-valid" : "is-check"}`}>
          {isValid ? "Valid" : "Needs check"}
        </span>
      </div>
      <p className="pdf-tools-operation-plan-note">Planning aid only — not a real PDF preview. Stamp placement and page thumbnails are not rendered.</p>
      <dl className="pdf-tools-operation-plan-details">
        <div><dt>Input PDF</dt><dd>{result?.file_name ?? "Not selected"}</dd></div>
        <div><dt>Stamp text</dt><dd>{text.trim() || "Not set"}</dd></div>
        <div><dt>Target pages</dt><dd>{pagesInput.trim() || "All pages"}</dd></div>
        <div><dt>Position</dt><dd>{positionLabel}</dd></div>
        <div><dt>Margin X / Y</dt><dd>{marginXError || marginYError || marginX === null || marginY === null ? "Invalid" : `${marginX} / ${marginY} pt`}</dd></div>
        <div><dt>Font size</dt><dd>{fontSizeError || fontSize === null ? "Invalid" : `${fontSize} pt`}</dd></div>
        <div><dt>Opacity</dt><dd>{opacityError || opacity === null ? "Invalid" : opacity}</dd></div>
        <div><dt>Rotation</dt><dd>{rotationError || rotation === null ? "Invalid" : `${rotation}°`}</dd></div>
        <div><dt>Color</dt><dd>{colorLabel}</dd></div>
        <div><dt>Output PDF</dt><dd>{outputPath ? `New PDF · ${fileNameFromPath(outputPath)}` : "Not selected"}</dd></div>
      </dl>
      <div className="pdf-tools-operation-plan-targets">
        <span>Selected page targets</span>
        {parsedPages.error ? (
          <span className="pdf-tools-operation-plan-empty">Review the page selection warning below.</span>
        ) : pagesInput.trim() ? (
          <PlanPageChips pages={parsedPages.pages} />
        ) : (
          <span className="pdf-tools-operation-plan-empty">All pages will receive the additive text stamp.</span>
        )}
      </div>
      {textError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Check text:</strong> {textError}</p>}
      {parsedPages.error && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Check page selection:</strong> {parsedPages.error}</p>}
      {marginXError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid margin:</strong> {marginXError}</p>}
      {marginYError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid margin:</strong> {marginYError}</p>}
      {fontSizeError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid font size:</strong> {fontSizeError}</p>}
      {opacityError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid opacity:</strong> {opacityError}</p>}
      {rotationError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Invalid rotation:</strong> {rotationError}</p>}
      {outputError && <p className="pdf-tools-operation-plan-warning" role="alert"><strong>Output required:</strong> {outputError}</p>}
      {isProtected && (
        <p className="pdf-tools-operation-plan-warning is-protected" role="alert">
          <strong>Protected PDF:</strong> Text stamp is unavailable. Utility Tools Hub does not decrypt PDFs or bypass permissions.
        </p>
      )}
      <p className="pdf-tools-operation-plan-safety">
        <strong>Additive only · Not redaction · Not PDF text editing:</strong> This adds a short status label to a new PDF without removing existing text, images, page numbers, or watermarks. It is not a digital signature, identity verification, or an audit trail. Border/background styling and real preview/thumbnails are not included.
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
  const watermarkFileInputRef = useRef<HTMLInputElement>(null);
  const pageNumbersFileInputRef = useRef<HTMLInputElement>(null);
  const imageWatermarkPdfFileInputRef = useRef<HTMLInputElement>(null);
  const imageWatermarkImageFileInputRef = useRef<HTMLInputElement>(null);
  const textStampFileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  const mergeInspectRunIdRef = useRef(0);
  const isRunningRef = useRef(false);

  const [selectedOperation, setSelectedOperation] = useState<PdfWorkbenchOperation>("inspect");

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

  const [watermarkInput, setWatermarkInput] = useState<SelectedPdf | null>(null);
  const [watermarkText, setWatermarkText] = useState("DRAFT");
  const [watermarkPagesInput, setWatermarkPagesInput] = useState("");
  const [watermarkOpacityInput, setWatermarkOpacityInput] = useState("0.18");
  const [watermarkRotationInput, setWatermarkRotationInput] = useState("-35");
  const [watermarkFontSizeInput, setWatermarkFontSizeInput] = useState("48");
  const [watermarkOutputPath, setWatermarkOutputPath] = useState<string | null>(null);
  const [watermarkResult, setWatermarkResult] = useState<PdfTextWatermarkResult | null>(null);
  const [isWatermarking, setIsWatermarking] = useState(false);
  const [watermarkFeedback, setWatermarkFeedback] = useState<string | null>(null);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);

  const [pageNumbersInput, setPageNumbersInput] = useState<SelectedPdf | null>(null);
  const [pageNumbersPagesInput, setPageNumbersPagesInput] = useState("");
  const [pageNumbersStartInput, setPageNumbersStartInput] = useState("1");
  const [pageNumbersFormat, setPageNumbersFormat] = useState<PageNumberFormat>("number");
  const [pageNumbersPosition, setPageNumbersPosition] = useState<PageNumberPosition>("bottom-center");
  const [pageNumbersMarginXInput, setPageNumbersMarginXInput] = useState("36");
  const [pageNumbersMarginYInput, setPageNumbersMarginYInput] = useState("24");
  const [pageNumbersFontSizeInput, setPageNumbersFontSizeInput] = useState("12");
  const [pageNumbersOutputPath, setPageNumbersOutputPath] = useState<string | null>(null);
  const [pageNumbersResult, setPageNumbersResult] = useState<PdfPageNumbersResult | null>(null);
  const [isAddingPageNumbers, setIsAddingPageNumbers] = useState(false);
  const [pageNumbersFeedback, setPageNumbersFeedback] = useState<string | null>(null);
  const [pageNumbersError, setPageNumbersError] = useState<string | null>(null);

  const [imageWatermarkInput, setImageWatermarkInput] = useState<SelectedPdf | null>(null);
  const [imageWatermarkImage, setImageWatermarkImage] = useState<SelectedImage | null>(null);
  const [imageWatermarkPagesInput, setImageWatermarkPagesInput] = useState("");
  const [imageWatermarkWidthInput, setImageWatermarkWidthInput] = useState("180");
  const [imageWatermarkOpacityInput, setImageWatermarkOpacityInput] = useState("0.25");
  const [imageWatermarkRotationInput, setImageWatermarkRotationInput] = useState("0");
  const [imageWatermarkOutputPath, setImageWatermarkOutputPath] = useState<string | null>(null);
  const [imageWatermarkResult, setImageWatermarkResult] = useState<PdfImageWatermarkResult | null>(null);
  const [isAddingImageWatermark, setIsAddingImageWatermark] = useState(false);
  const [imageWatermarkFeedback, setImageWatermarkFeedback] = useState<string | null>(null);
  const [imageWatermarkError, setImageWatermarkError] = useState<string | null>(null);

  const [textStampInput, setTextStampInput] = useState<SelectedPdf | null>(null);
  const [textStampText, setTextStampText] = useState("APPROVED");
  const [textStampPagesInput, setTextStampPagesInput] = useState("");
  const [textStampPosition, setTextStampPosition] = useState<TextStampPosition>("top-right");
  const [textStampMarginXInput, setTextStampMarginXInput] = useState("36");
  const [textStampMarginYInput, setTextStampMarginYInput] = useState("36");
  const [textStampFontSizeInput, setTextStampFontSizeInput] = useState("24");
  const [textStampOpacityInput, setTextStampOpacityInput] = useState("0.85");
  const [textStampRotationInput, setTextStampRotationInput] = useState("0");
  const [textStampColor, setTextStampColor] = useState<TextStampColor>("red");
  const [textStampOutputPath, setTextStampOutputPath] = useState<string | null>(null);
  const [textStampResult, setTextStampResult] = useState<PdfTextStampResult | null>(null);
  const [isAddingTextStamp, setIsAddingTextStamp] = useState(false);
  const [textStampFeedback, setTextStampFeedback] = useState<string | null>(null);
  const [textStampError, setTextStampError] = useState<string | null>(null);

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
  const [watermarkInputSummary, setWatermarkInputSummary] = useState<OperationInputSummaryState>(emptyOperationInputSummary);
  const [pageNumbersInputSummary, setPageNumbersInputSummary] = useState<OperationInputSummaryState>(emptyOperationInputSummary);
  const [imageWatermarkInputSummary, setImageWatermarkInputSummary] = useState<OperationInputSummaryState>(emptyOperationInputSummary);
  const [textStampInputSummary, setTextStampInputSummary] = useState<OperationInputSummaryState>(emptyOperationInputSummary);

  const nativeDialogAvailable = isTauri();
  const parsedExtractPages = parsePageSelection(extractPagesInput);
  const parsedRotatePages = parsePageSelection(rotatePagesInput);
  const parsedDeletePages = parsePageSelection(deletePagesInput);
  const parsedReorderPageOrder = parsePageOrder(
    reorderPageOrderInput,
    reorderInputSummary.result?.page_count ?? null,
  );
  const parsedWatermarkPages = parseOptionalPageSelection(
    watermarkPagesInput,
    watermarkInputSummary.result?.page_count ?? null,
  );
  const watermarkTextError = watermarkTextValidationMessage(watermarkText);
  const watermarkOpacity = parseFiniteNumber(watermarkOpacityInput);
  const watermarkRotation = parseFiniteNumber(watermarkRotationInput);
  const watermarkFontSize = parseFiniteNumber(watermarkFontSizeInput);
  const watermarkOpacityError = watermarkOpacity === null || watermarkOpacity <= 0 || watermarkOpacity > 1
    ? "Opacity must be greater than 0 and no greater than 1."
    : null;
  const watermarkRotationError = watermarkRotation === null || watermarkRotation < -360 || watermarkRotation > 360
    ? "Rotation must be between -360 and 360 degrees."
    : null;
  const watermarkFontSizeError = watermarkFontSize === null || watermarkFontSize < 8 || watermarkFontSize > 200
    ? "Font size must be between 8 and 200 points."
    : null;
  const parsedPageNumbersPages = parseOptionalPageSelection(
    pageNumbersPagesInput,
    pageNumbersInputSummary.result?.page_count ?? null,
  );
  const pageNumbersStartNumber = parseFiniteNumber(pageNumbersStartInput);
  const pageNumbersMarginX = parseFiniteNumber(pageNumbersMarginXInput);
  const pageNumbersMarginY = parseFiniteNumber(pageNumbersMarginYInput);
  const pageNumbersFontSize = parseFiniteNumber(pageNumbersFontSizeInput);
  const pageNumbersStartError = positiveIntegerValidationMessage(pageNumbersStartInput, "Start number");
  const pageNumbersMarginXError = pageNumberMarginValidationMessage(pageNumbersMarginXInput, "Margin X");
  const pageNumbersMarginYError = pageNumberMarginValidationMessage(pageNumbersMarginYInput, "Margin Y");
  const pageNumbersFontSizeError = boundedNumberValidationMessage(pageNumbersFontSizeInput, "Font size", 6, 72);
  const parsedImageWatermarkPages = parseOptionalPageSelection(
    imageWatermarkPagesInput,
    imageWatermarkInputSummary.result?.page_count ?? null,
  );
  const imageWatermarkImageError = imageWatermarkImageValidationMessage(imageWatermarkImage);
  const imageWatermarkWidth = parseFiniteNumber(imageWatermarkWidthInput);
  const imageWatermarkOpacity = parseFiniteNumber(imageWatermarkOpacityInput);
  const imageWatermarkRotation = parseFiniteNumber(imageWatermarkRotationInput);
  const imageWatermarkWidthError = boundedNumberValidationMessage(
    imageWatermarkWidthInput,
    "Width",
    8,
    1440,
  );
  const imageWatermarkOpacityError =
    imageWatermarkOpacity === null || imageWatermarkOpacity <= 0 || imageWatermarkOpacity > 1
      ? "Opacity must be greater than 0 and no greater than 1."
      : null;
  const imageWatermarkRotationError =
    imageWatermarkRotation === null || imageWatermarkRotation < -360 || imageWatermarkRotation > 360
      ? "Rotation must be between -360 and 360 degrees."
      : null;
  const imageWatermarkInputIsProtected = Boolean(
    imageWatermarkInputSummary.result &&
      (imageWatermarkInputSummary.result.is_encrypted || imageWatermarkInputSummary.result.is_protected),
  );
  const parsedTextStampPages = parseOptionalPageSelection(
    textStampPagesInput,
    textStampInputSummary.result?.page_count ?? null,
  );
  const textStampTextError = textStampTextValidationMessage(textStampText);
  const textStampMarginX = parseFiniteNumber(textStampMarginXInput);
  const textStampMarginY = parseFiniteNumber(textStampMarginYInput);
  const textStampFontSize = parseFiniteNumber(textStampFontSizeInput);
  const textStampOpacity = parseFiniteNumber(textStampOpacityInput);
  const textStampRotation = parseFiniteNumber(textStampRotationInput);
  const textStampMarginXError = boundedNumberValidationMessage(textStampMarginXInput, "Margin X", 0, 144);
  const textStampMarginYError = boundedNumberValidationMessage(textStampMarginYInput, "Margin Y", 0, 144);
  const textStampFontSizeError = boundedNumberValidationMessage(textStampFontSizeInput, "Font size", 8, 144);
  const textStampOpacityError =
    textStampOpacity === null || textStampOpacity <= 0 || textStampOpacity > 1
      ? "Opacity must be greater than 0 and no greater than 1."
      : null;
  const textStampRotationError =
    textStampRotation === null || textStampRotation < -360 || textStampRotation > 360
      ? "Rotation must be between -360 and 360 degrees."
      : null;
  const textStampOutputError = outputPdfValidationMessage(textStampOutputPath);
  const textStampInputIsProtected = Boolean(
    textStampInputSummary.result &&
      (textStampInputSummary.result.is_encrypted || textStampInputSummary.result.is_protected),
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

  const selectWatermarkInput = async () => {
    if (isRunningRef.current) return;
    setWatermarkFeedback(null);
    setWatermarkError(null);
    setWatermarkResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF for text watermark",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        if (!selectedPath.toLowerCase().endsWith(".pdf")) {
          setWatermarkError("Select a file with the .pdf extension.");
          return;
        }

        setWatermarkInput({ name: fileNameFromPath(selectedPath), path: selectedPath });
        setWatermarkFeedback(`Input selected: ${fileNameFromPath(selectedPath)}`);
        await inspectOperationInput(selectedPath, setWatermarkInputSummary);
        return;
      } catch {
        setWatermarkError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    watermarkFileInputRef.current?.click();
  };

  const selectBrowserWatermarkInput = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setWatermarkFeedback(null);
    setWatermarkResult(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setWatermarkInput(null);
      setWatermarkInputSummary(emptyOperationInputSummary());
      setWatermarkError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setWatermarkInput({ name: file.name });
    setWatermarkInputSummary({
      loading: false,
      error: "Desktop file path selection is required to inspect this PDF.",
      result: null,
    });
    setWatermarkError("Desktop file path selection is required to add a text watermark.");
    input.value = "";
  };

  const selectWatermarkOutputPdf = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setWatermarkFeedback(null);
    setWatermarkError(null);
    setWatermarkResult(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await save({
        defaultPath: "watermarked-document.pdf",
        title: "Select text-watermark output PDF",
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (!selectedPath) return;
      if (!selectedPath.toLowerCase().endsWith(".pdf")) {
        setWatermarkError("The output file must use the .pdf extension.");
        return;
      }

      setWatermarkOutputPath(selectedPath);
      setWatermarkFeedback(`Output selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setWatermarkError("The text-watermark output PDF could not be selected.");
    }
  };

  const addTextWatermark = async () => {
    if (isRunningRef.current) return;
    if (
      !watermarkInput?.path ||
      !watermarkInputSummary.result ||
      !watermarkOutputPath ||
      watermarkTextError ||
      parsedWatermarkPages.error ||
      watermarkOpacityError ||
      watermarkRotationError ||
      watermarkFontSizeError ||
      watermarkOpacity === null ||
      watermarkRotation === null ||
      watermarkFontSize === null
    ) {
      setWatermarkError(
        watermarkTextError ??
          parsedWatermarkPages.error ??
          watermarkOpacityError ??
          watermarkRotationError ??
          watermarkFontSizeError ??
          "Select a desktop PDF and output PDF, then review the watermark plan.",
      );
      return;
    }

    setWatermarkResult(null);
    setWatermarkFeedback(null);
    setWatermarkError(null);

    await executeAdditionalPdfTool<PdfTextWatermarkResult>(
      PDF_TEXT_WATERMARK_TOOL_ID,
      {
        input_path: watermarkInput.path,
        output_path: watermarkOutputPath,
        text: watermarkText.trim(),
        pages: parsedWatermarkPages.pages,
        opacity: watermarkOpacity,
        rotation_degrees: watermarkRotation,
        font_size: watermarkFontSize,
      },
      setIsWatermarking,
      (result) => {
        setWatermarkResult(result);
        setWatermarkFeedback("Text watermark completed successfully.");
        setWatermarkError(null);
      },
      (reason) => {
        setWatermarkResult(null);
        setWatermarkFeedback(null);
        setWatermarkError(watermarkFailureMessage(reason));
      },
    );
  };

  const selectPageNumbersInput = async () => {
    if (isRunningRef.current) return;
    setPageNumbersFeedback(null);
    setPageNumbersError(null);
    setPageNumbersResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF for page numbers",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        if (!selectedPath.toLowerCase().endsWith(".pdf")) {
          setPageNumbersError("Select a file with the .pdf extension.");
          return;
        }

        const fileName = fileNameFromPath(selectedPath);
        setPageNumbersInput({ name: fileName, path: selectedPath });
        setPageNumbersFeedback(`Input selected: ${fileName}`);
        await inspectOperationInput(selectedPath, setPageNumbersInputSummary);
        return;
      } catch {
        setPageNumbersError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    pageNumbersFileInputRef.current?.click();
  };

  const selectBrowserPageNumbersInput = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setPageNumbersFeedback(null);
    setPageNumbersResult(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setPageNumbersInput(null);
      setPageNumbersInputSummary(emptyOperationInputSummary());
      setPageNumbersError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setPageNumbersInput({ name: file.name });
    setPageNumbersInputSummary({
      loading: false,
      error: "Desktop file path selection is required to inspect this PDF.",
      result: null,
    });
    setPageNumbersError("Desktop file path selection is required to add page numbers.");
    input.value = "";
  };

  const selectPageNumbersOutputPdf = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setPageNumbersFeedback(null);
    setPageNumbersError(null);
    setPageNumbersResult(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await save({
        defaultPath: "numbered-document.pdf",
        title: "Select page-numbers output PDF",
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (!selectedPath) return;
      if (!selectedPath.toLowerCase().endsWith(".pdf")) {
        setPageNumbersError("The output file must use the .pdf extension.");
        return;
      }

      setPageNumbersOutputPath(selectedPath);
      setPageNumbersFeedback(`Output selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setPageNumbersError("The page-numbers output PDF could not be selected.");
    }
  };

  const addPageNumbers = async () => {
    if (isRunningRef.current) return;
    if (
      !pageNumbersInput?.path ||
      !pageNumbersInputSummary.result ||
      !pageNumbersOutputPath ||
      parsedPageNumbersPages.error ||
      pageNumbersStartError ||
      pageNumbersMarginXError ||
      pageNumbersMarginYError ||
      pageNumbersFontSizeError ||
      pageNumbersStartNumber === null ||
      pageNumbersMarginX === null ||
      pageNumbersMarginY === null ||
      pageNumbersFontSize === null
    ) {
      setPageNumbersError(
        parsedPageNumbersPages.error ??
          pageNumbersStartError ??
          pageNumbersMarginXError ??
          pageNumbersMarginYError ??
          pageNumbersFontSizeError ??
          "Select a desktop PDF and output PDF, then review the page-number plan.",
      );
      return;
    }

    setPageNumbersResult(null);
    setPageNumbersFeedback(null);
    setPageNumbersError(null);

    await executeAdditionalPdfTool<PdfPageNumbersResult>(
      PDF_PAGE_NUMBERS_TOOL_ID,
      {
        input_path: pageNumbersInput.path,
        output_path: pageNumbersOutputPath,
        pages: parsedPageNumbersPages.pages,
        start_number: pageNumbersStartNumber,
        format: pageNumbersFormat,
        position: pageNumbersPosition,
        margin_x: pageNumbersMarginX,
        margin_y: pageNumbersMarginY,
        font_size: pageNumbersFontSize,
      },
      setIsAddingPageNumbers,
      (result) => {
        setPageNumbersResult(result);
        setPageNumbersFeedback("Page numbers completed successfully.");
        setPageNumbersError(null);
      },
      (reason) => {
        setPageNumbersResult(null);
        setPageNumbersFeedback(null);
        setPageNumbersError(pageNumbersFailureMessage(reason));
      },
    );
  };

  const selectImageWatermarkInput = async () => {
    if (isRunningRef.current) return;
    setImageWatermarkFeedback(null);
    setImageWatermarkError(null);
    setImageWatermarkResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF for image watermark",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        if (!selectedPath.toLowerCase().endsWith(".pdf")) {
          setImageWatermarkError("Select a file with the .pdf extension.");
          return;
        }

        const fileName = fileNameFromPath(selectedPath);
        setImageWatermarkInput({ name: fileName, path: selectedPath });
        setImageWatermarkFeedback(`Input selected: ${fileName}`);
        await inspectOperationInput(selectedPath, setImageWatermarkInputSummary);
        return;
      } catch {
        setImageWatermarkError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    imageWatermarkPdfFileInputRef.current?.click();
  };

  const selectBrowserImageWatermarkInput = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setImageWatermarkFeedback(null);
    setImageWatermarkResult(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setImageWatermarkInput(null);
      setImageWatermarkInputSummary(emptyOperationInputSummary());
      setImageWatermarkError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setImageWatermarkInput({ name: file.name });
    setImageWatermarkInputSummary({
      loading: false,
      error: "Desktop file path selection is required to inspect this PDF.",
      result: null,
    });
    setImageWatermarkError("Desktop file path selection is required to add an image watermark.");
    input.value = "";
  };

  const selectImageWatermarkJpeg = async () => {
    if (isRunningRef.current) return;
    setImageWatermarkFeedback(null);
    setImageWatermarkError(null);
    setImageWatermarkResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select JPEG image watermark",
          filters: [{ name: "JPEG image", extensions: ["jpg", "jpeg"] }],
        });
        if (typeof selectedPath !== "string") return;
        const fileName = fileNameFromPath(selectedPath);
        if (!/\.(jpe?g)$/i.test(fileName)) {
          setImageWatermarkImage(null);
          setImageWatermarkError("JPEG/JPG only. PNG, WebP, and SVG are not supported.");
          return;
        }

        setImageWatermarkImage({ name: fileName, path: selectedPath });
        setImageWatermarkFeedback(`JPEG selected: ${fileName}`);
        return;
      } catch {
        setImageWatermarkError("The native JPEG picker is unavailable. Desktop file path selection is required.");
      }
    }

    imageWatermarkImageFileInputRef.current?.click();
  };

  const selectBrowserImageWatermarkJpeg = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setImageWatermarkFeedback(null);
    setImageWatermarkResult(null);

    if (!/\.(jpe?g)$/i.test(file.name)) {
      setImageWatermarkImage(null);
      setImageWatermarkError("JPEG/JPG only. PNG, WebP, and SVG are not supported.");
      input.value = "";
      return;
    }

    setImageWatermarkImage({ name: file.name });
    setImageWatermarkError("Select the JPEG again with the desktop file picker to run Image watermark.");
    input.value = "";
  };

  const selectImageWatermarkOutputPdf = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setImageWatermarkFeedback(null);
    setImageWatermarkError(null);
    setImageWatermarkResult(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await save({
        defaultPath: "image-watermarked-document.pdf",
        title: "Select image-watermark output PDF",
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (!selectedPath) return;
      if (!selectedPath.toLowerCase().endsWith(".pdf")) {
        setImageWatermarkError("The output file must use the .pdf extension.");
        return;
      }

      setImageWatermarkOutputPath(selectedPath);
      setImageWatermarkFeedback(`Output selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setImageWatermarkError("The image-watermark output PDF could not be selected.");
    }
  };

  const addImageWatermark = async () => {
    if (isRunningRef.current) return;
    if (
      !imageWatermarkInput?.path ||
      !imageWatermarkInputSummary.result ||
      !imageWatermarkImage?.path ||
      !imageWatermarkOutputPath ||
      imageWatermarkImageError ||
      parsedImageWatermarkPages.error ||
      imageWatermarkWidthError ||
      imageWatermarkOpacityError ||
      imageWatermarkRotationError ||
      imageWatermarkInputIsProtected ||
      imageWatermarkWidth === null ||
      imageWatermarkOpacity === null ||
      imageWatermarkRotation === null
    ) {
      setImageWatermarkError(
        imageWatermarkImageError ??
          parsedImageWatermarkPages.error ??
          imageWatermarkWidthError ??
          imageWatermarkOpacityError ??
          imageWatermarkRotationError ??
          (imageWatermarkInputIsProtected
            ? "Protected PDFs are not supported. Utility Tools Hub does not decrypt PDFs or bypass permissions."
            : null) ??
          "Select a desktop PDF, baseline JPEG image, and output PDF, then review the operation plan.",
      );
      return;
    }

    setImageWatermarkResult(null);
    setImageWatermarkFeedback(null);
    setImageWatermarkError(null);

    await executeAdditionalPdfTool<PdfImageWatermarkResult>(
      PDF_IMAGE_WATERMARK_TOOL_ID,
      {
        input_path: imageWatermarkInput.path,
        output_path: imageWatermarkOutputPath,
        image_path: imageWatermarkImage.path,
        pages: parsedImageWatermarkPages.pages,
        width: imageWatermarkWidth,
        opacity: imageWatermarkOpacity,
        rotation_degrees: imageWatermarkRotation,
      },
      setIsAddingImageWatermark,
      (result) => {
        setImageWatermarkResult(result);
        setImageWatermarkFeedback("Image watermark completed successfully.");
        setImageWatermarkError(null);
      },
      (reason) => {
        setImageWatermarkResult(null);
        setImageWatermarkFeedback(null);
        setImageWatermarkError(imageWatermarkFailureMessage(reason));
      },
    );
  };

  const selectTextStampInput = async () => {
    if (isRunningRef.current) return;
    setTextStampFeedback(null);
    setTextStampError(null);
    setTextStampResult(null);

    if (nativeDialogAvailable) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await open({
          multiple: false,
          directory: false,
          title: "Select PDF for text stamp",
          filters: [{ name: "PDF document", extensions: ["pdf"] }],
        });
        if (typeof selectedPath !== "string") return;
        if (!selectedPath.toLowerCase().endsWith(".pdf")) {
          setTextStampError("Select a file with the .pdf extension.");
          return;
        }

        const fileName = fileNameFromPath(selectedPath);
        setTextStampInput({ name: fileName, path: selectedPath });
        setTextStampFeedback(`Input selected: ${fileName}`);
        await inspectOperationInput(selectedPath, setTextStampInputSummary);
        return;
      } catch {
        setTextStampError("The native PDF picker is unavailable. Desktop file path selection is required.");
      }
    }

    textStampFileInputRef.current?.click();
  };

  const selectBrowserTextStampInput = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setTextStampFeedback(null);
    setTextStampResult(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setTextStampInput(null);
      setTextStampInputSummary(emptyOperationInputSummary());
      setTextStampError("Please select a PDF file.");
      input.value = "";
      return;
    }

    setTextStampInput({ name: file.name });
    setTextStampInputSummary({
      loading: false,
      error: "Desktop file path selection is required to inspect this PDF.",
      result: null,
    });
    setTextStampError("Desktop file path selection is required to add a text stamp.");
    input.value = "";
  };

  const selectTextStampOutputPdf = async () => {
    if (!nativeDialogAvailable || isRunningRef.current) return;
    setTextStampFeedback(null);
    setTextStampError(null);
    setTextStampResult(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await save({
        defaultPath: "text-stamped-document.pdf",
        title: "Select text-stamp output PDF",
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (!selectedPath) return;
      if (!selectedPath.toLowerCase().endsWith(".pdf")) {
        setTextStampError("The output file must use the .pdf extension.");
        return;
      }

      setTextStampOutputPath(selectedPath);
      setTextStampFeedback(`Output selected: ${fileNameFromPath(selectedPath)}`);
    } catch {
      setTextStampError("The text-stamp output PDF could not be selected.");
    }
  };

  const addTextStamp = async () => {
    if (isRunningRef.current) return;
    if (
      !textStampInput?.path ||
      !textStampInputSummary.result ||
      textStampTextError ||
      parsedTextStampPages.error ||
      textStampMarginXError ||
      textStampMarginYError ||
      textStampFontSizeError ||
      textStampOpacityError ||
      textStampRotationError ||
      textStampOutputError ||
      textStampInputIsProtected ||
      textStampMarginX === null ||
      textStampMarginY === null ||
      textStampFontSize === null ||
      textStampOpacity === null ||
      textStampRotation === null ||
      !textStampOutputPath
    ) {
      setTextStampError(
        textStampTextError ??
          parsedTextStampPages.error ??
          textStampMarginXError ??
          textStampMarginYError ??
          textStampFontSizeError ??
          textStampOpacityError ??
          textStampRotationError ??
          textStampOutputError ??
          (textStampInputIsProtected
            ? "Protected PDFs are not supported. Utility Tools Hub does not decrypt PDFs or bypass permissions."
            : null) ??
          "Select a desktop PDF and output PDF, then review the text-stamp plan.",
      );
      return;
    }

    setTextStampResult(null);
    setTextStampFeedback(null);
    setTextStampError(null);

    await executeAdditionalPdfTool<PdfTextStampResult>(
      PDF_TEXT_STAMP_TOOL_ID,
      {
        input_path: textStampInput.path,
        output_path: textStampOutputPath,
        text: textStampText,
        pages: parsedTextStampPages.pages,
        position: textStampPosition,
        margin_x: textStampMarginX,
        margin_y: textStampMarginY,
        font_size: textStampFontSize,
        opacity: textStampOpacity,
        rotation_degrees: textStampRotation,
        color: textStampColor,
      },
      setIsAddingTextStamp,
      (result) => {
        setTextStampResult(result);
        setTextStampFeedback("Text stamp completed successfully.");
        setTextStampError(null);
      },
      (reason) => {
        setTextStampResult(null);
        setTextStampFeedback(null);
        setTextStampError(textStampFailureMessage(reason));
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
    watermarkInputSummary.loading ||
    pageNumbersInputSummary.loading ||
    imageWatermarkInputSummary.loading ||
    textStampInputSummary.loading ||
    isMerging ||
    isSplitting ||
    isExtracting ||
    isRotating ||
    isDeleting ||
    isReordering ||
    isWatermarking ||
    isAddingPageNumbers ||
    isAddingImageWatermark ||
    isAddingTextStamp;
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
  const canWatermark =
    nativeDialogAvailable &&
    typeof watermarkInput?.path === "string" &&
    watermarkInputSummary.result !== null &&
    watermarkOutputPath !== null &&
    watermarkTextError === null &&
    parsedWatermarkPages.error === null &&
    watermarkOpacityError === null &&
    watermarkRotationError === null &&
    watermarkFontSizeError === null &&
    !isAnyOperationRunning;
  const canAddPageNumbers =
    nativeDialogAvailable &&
    typeof pageNumbersInput?.path === "string" &&
    pageNumbersInputSummary.result !== null &&
    pageNumbersOutputPath !== null &&
    parsedPageNumbersPages.error === null &&
    pageNumbersStartError === null &&
    pageNumbersMarginXError === null &&
    pageNumbersMarginYError === null &&
    pageNumbersFontSizeError === null &&
    !isAnyOperationRunning;
  const canAddImageWatermark =
    nativeDialogAvailable &&
    typeof imageWatermarkInput?.path === "string" &&
    imageWatermarkInputSummary.result !== null &&
    typeof imageWatermarkImage?.path === "string" &&
    imageWatermarkOutputPath !== null &&
    imageWatermarkImageError === null &&
    parsedImageWatermarkPages.error === null &&
    imageWatermarkWidthError === null &&
    imageWatermarkOpacityError === null &&
    imageWatermarkRotationError === null &&
    !imageWatermarkInputIsProtected &&
    !isAnyOperationRunning;
  const canAddTextStamp =
    nativeDialogAvailable &&
    typeof textStampInput?.path === "string" &&
    textStampInputSummary.result !== null &&
    textStampTextError === null &&
    parsedTextStampPages.error === null &&
    textStampMarginXError === null &&
    textStampMarginYError === null &&
    textStampFontSizeError === null &&
    textStampOpacityError === null &&
    textStampRotationError === null &&
    textStampOutputError === null &&
    !textStampInputIsProtected &&
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
  const watermarkDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : !watermarkInput?.path
      ? "Select one input PDF."
      : watermarkInputSummary.loading
        ? "Wait for the input PDF summary to finish."
        : !watermarkInputSummary.result
          ? "A valid input PDF summary is required."
          : watermarkTextError
            ? watermarkTextError
            : parsedWatermarkPages.error
              ? parsedWatermarkPages.error
              : watermarkOpacityError
                ? watermarkOpacityError
                : watermarkRotationError
                  ? watermarkRotationError
                  : watermarkFontSizeError
                    ? watermarkFontSizeError
                    : !watermarkOutputPath
                      ? "Select an output PDF."
                      : null;
  const pageNumbersDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : !pageNumbersInput?.path
      ? "Select one input PDF."
      : pageNumbersInputSummary.loading
        ? "Wait for the input PDF summary to finish."
        : !pageNumbersInputSummary.result
          ? "A valid input PDF summary is required."
          : parsedPageNumbersPages.error
            ? parsedPageNumbersPages.error
            : pageNumbersStartError
              ? pageNumbersStartError
              : pageNumbersMarginXError
                ? pageNumbersMarginXError
                : pageNumbersMarginYError
                  ? pageNumbersMarginYError
                  : pageNumbersFontSizeError
                    ? pageNumbersFontSizeError
                    : !pageNumbersOutputPath
                      ? "Select an output PDF."
                      : null;
  const imageWatermarkDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : !imageWatermarkInput?.path
      ? "Select one input PDF."
      : imageWatermarkInputSummary.loading
        ? "Wait for the input PDF summary to finish."
        : !imageWatermarkInputSummary.result
          ? "A valid input PDF summary is required."
          : imageWatermarkInputIsProtected
            ? "Protected PDFs are not supported. Decryption and permission bypass are not provided."
            : imageWatermarkImageError
              ? imageWatermarkImageError
              : parsedImageWatermarkPages.error
                ? parsedImageWatermarkPages.error
                : imageWatermarkWidthError
                  ? imageWatermarkWidthError
                  : imageWatermarkOpacityError
                    ? imageWatermarkOpacityError
                    : imageWatermarkRotationError
                      ? imageWatermarkRotationError
                      : !imageWatermarkOutputPath
                        ? "Select an output PDF."
                        : null;
  const textStampDisabledReason = !nativeDialogAvailable
    ? "PDF processing is available in the desktop app."
    : !textStampInput?.path
      ? "Select one input PDF."
      : textStampInputSummary.loading
        ? "Wait for the input PDF summary to finish."
        : !textStampInputSummary.result
          ? "A valid input PDF summary is required."
          : textStampInputIsProtected
            ? "Protected PDFs are not supported. Decryption and permission bypass are not provided."
            : textStampTextError
              ? textStampTextError
              : parsedTextStampPages.error
                ? parsedTextStampPages.error
                : textStampMarginXError
                  ? textStampMarginXError
                  : textStampMarginYError
                    ? textStampMarginYError
                    : textStampFontSizeError
                      ? textStampFontSizeError
                      : textStampOpacityError
                        ? textStampOpacityError
                        : textStampRotationError
                          ? textStampRotationError
                          : textStampOutputError;
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
  const selectedOperationLabel = pdfWorkbenchOperations.find(
    (operation) => operation.id === selectedOperation,
  )?.label ?? "Inspect";
  const activeSelection = selectedOperation === "inspect"
    ? inspectInput?.name ?? "No file selected"
    : selectedOperation === "merge"
      ? selectedPdfs.length > 0
        ? `${selectedPdfs.length} PDFs selected`
        : "No files selected"
      : selectedOperation === "split"
        ? splitInput?.name ?? "No file selected"
        : selectedOperation === "extract"
          ? extractInput?.name ?? "No file selected"
          : selectedOperation === "rotate"
            ? rotateInput?.name ?? "No file selected"
            : selectedOperation === "delete"
              ? deleteInput?.name ?? "No file selected"
              : selectedOperation === "reorder"
                ? reorderInput?.name ?? "No file selected"
                : selectedOperation === "textWatermark"
                  ? watermarkInput?.name ?? "No file selected"
                  : selectedOperation === "pageNumbers"
                    ? pageNumbersInput?.name ?? "No file selected"
                    : selectedOperation === "imageWatermark"
                      ? imageWatermarkInput?.name ?? "No file selected"
                      : textStampInput?.name ?? "No file selected";
  const operationStatuses: ReadonlyArray<{
    id: PdfWorkbenchOperation;
    label: string;
    status: string;
    className: string;
  }> = [
    { id: "inspect", label: "Inspect", status: isInspecting ? "Running" : inspectError ? "Needs attention" : inspectResult ? "Completed" : "Ready", className: isInspecting ? "is-running" : inspectError ? "is-error" : inspectResult ? "is-success" : "" },
    { id: "merge", label: "Merge", status: isMerging ? "Running" : error ? "Needs attention" : mergeResult ? "Completed" : "Ready", className: isMerging ? "is-running" : error ? "is-error" : mergeResult ? "is-success" : "" },
    { id: "split", label: "Split", status: isSplitting ? "Running" : splitError ? "Needs attention" : splitResult ? "Completed" : "Ready", className: isSplitting ? "is-running" : splitError ? "is-error" : splitResult ? "is-success" : "" },
    { id: "extract", label: "Extract", status: isExtracting ? "Running" : extractError ? "Needs attention" : extractResult ? "Completed" : "Ready", className: isExtracting ? "is-running" : extractError ? "is-error" : extractResult ? "is-success" : "" },
    { id: "rotate", label: "Rotate", status: isRotating ? "Running" : rotateError ? "Needs attention" : rotateResult ? "Completed" : "Ready", className: isRotating ? "is-running" : rotateError ? "is-error" : rotateResult ? "is-success" : "" },
    { id: "delete", label: "Delete", status: isDeleting ? "Running" : deleteError ? "Needs attention" : deleteResult ? "Completed" : "Ready", className: isDeleting ? "is-running" : deleteError ? "is-error" : deleteResult ? "is-success" : "" },
    { id: "reorder", label: "Reorder", status: isReordering ? "Running" : reorderError ? "Needs attention" : reorderResult ? "Completed" : "Ready", className: isReordering ? "is-running" : reorderError ? "is-error" : reorderResult ? "is-success" : "" },
    { id: "textWatermark", label: "Text watermark", status: isWatermarking ? "Running" : watermarkError ? "Needs attention" : watermarkResult ? "Completed" : "Ready", className: isWatermarking ? "is-running" : watermarkError ? "is-error" : watermarkResult ? "is-success" : "" },
    { id: "pageNumbers", label: "Page numbers", status: isAddingPageNumbers ? "Running" : pageNumbersError ? "Needs attention" : pageNumbersResult ? "Completed" : "Ready", className: isAddingPageNumbers ? "is-running" : pageNumbersError ? "is-error" : pageNumbersResult ? "is-success" : "" },
    { id: "imageWatermark", label: "Image watermark", status: isAddingImageWatermark ? "Running" : imageWatermarkError ? "Needs attention" : imageWatermarkResult ? "Completed" : "Ready", className: isAddingImageWatermark ? "is-running" : imageWatermarkError ? "is-error" : imageWatermarkResult ? "is-success" : "" },
    { id: "textStamp", label: "Text stamp", status: isAddingTextStamp ? "Running" : textStampError ? "Needs attention" : textStampResult ? "Completed" : "Ready", className: isAddingTextStamp ? "is-running" : textStampError ? "is-error" : textStampResult ? "is-success" : "" },
  ];
  const activeOperationStatus = operationStatuses.find(
    (operation) => operation.id === selectedOperation,
  ) ?? operationStatuses[0];

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
        <span className="pdf-tools-planned-badge">Inspect · Merge · Split · Extract · Rotate · Delete · Reorder · Text watermark · Page numbers · Image watermark · Text stamp</span>
      </div>

      <div className="pdf-tools-notice" role="note">
        <strong>PDF Workbench supports local page operations, additive text and JPEG image watermarks, page numbers, and short text stamps.</strong>
        <span>Preview, thumbnails, OCR, redaction, and direct text editing are not implemented.</span>
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
              <span>Active selection</span>
              <h2>{selectedOperationLabel}</h2>
            </div>
            <p className="pdf-tools-active-file" title={activeSelection}>{activeSelection}</p>
            <details className="pdf-tools-compact-details">
              <summary>All selected files</summary>
              <dl className="pdf-tools-file-overview">
                <div><dt>Inspect</dt><dd>{inspectInput?.name ?? "None"}</dd></div>
                <div><dt>Merge</dt><dd>{selectedPdfs.length > 0 ? `${selectedPdfs.length} PDFs` : "None"}</dd></div>
                <div><dt>Split</dt><dd>{splitInput?.name ?? "None"}</dd></div>
                <div><dt>Extract</dt><dd>{extractInput?.name ?? "None"}</dd></div>
                <div><dt>Rotate</dt><dd>{rotateInput?.name ?? "None"}</dd></div>
                <div><dt>Delete</dt><dd>{deleteInput?.name ?? "None"}</dd></div>
                <div><dt>Reorder</dt><dd>{reorderInput?.name ?? "None"}</dd></div>
                <div><dt>Watermark</dt><dd>{watermarkInput?.name ?? "None"}</dd></div>
                <div><dt>Page numbers</dt><dd>{pageNumbersInput?.name ?? "None"}</dd></div>
                <div><dt>Image watermark</dt><dd>{imageWatermarkInput?.name ?? "None"}</dd></div>
                <div><dt>Text stamp</dt><dd>{textStampInput?.name ?? "None"}</dd></div>
              </dl>
            </details>
            <div className="pdf-tools-local-notes">
              <p>PDF files stay on this device.</p>
              <p>Original files are not overwritten by default.</p>
              <p>Protected PDFs are not supported.</p>
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
            <span>Operation</span>
            <h2>Choose one task</h2>
            <p>Switching tasks keeps existing file selections and input values.</p>
          </div>

          <div className="pdf-tools-operation-selector" role="tablist" aria-label="PDF operation selector">
            {pdfWorkbenchOperations.map((operation) => (
              <button
                key={operation.id}
                type="button"
                role="tab"
                className={`pdf-tools-operation-tab${selectedOperation === operation.id ? " is-active" : ""}`}
                aria-selected={selectedOperation === operation.id}
                aria-controls={`pdf-operation-${operation.id}`}
                onClick={() => setSelectedOperation(operation.id)}
                disabled={isAnyOperationRunning}
              >
                {operation.label}
              </button>
            ))}
          </div>

          {selectedOperation === "inspect" && (
            <section
              id="pdf-operation-inspect"
              role="tabpanel"
              className="pdf-tools-panel pdf-tools-operation-card pdf-tools-active-operation"
              aria-labelledby="pdf-active-inspect-title"
            >
              <div className="pdf-tools-section-heading">
                <span>File summary</span>
                <h2 id="pdf-active-inspect-title">Inspect PDF</h2>
                <p>Inspect page count, PDF version, metadata, and protection status locally.</p>
              </div>
              <button type="button" className="btn btn-primary" onClick={selectInspectPdf} disabled={isAnyOperationRunning}>
                {isInspecting ? "Inspecting..." : "Select PDF to inspect"}
              </button>

              {isInspecting && (
                <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">
                  Reading safe document summary information locally...
                </div>
              )}
              {inspectError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{inspectError}</div>}
              {!isInspecting && inspectFeedback && inspectResult && (
                <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status"><strong>{inspectFeedback}</strong></div>
              )}
              {!inspectResult && !isInspecting && !inspectError && (
                <div className="pdf-tools-inspect-empty">
                  <strong>No PDF inspected yet.</strong>
                  <span>Select a local PDF to show its summary. Full local paths are not displayed.</span>
                </div>
              )}
              {inspectResult && (
                <div className="pdf-tools-inspect-result">
                  <div className="pdf-tools-inspect-file-name" title={inspectResult.file_name}>
                    <span>File</span><strong>{inspectResult.file_name}</strong>
                  </div>
                  <dl className="pdf-tools-inspect-summary">
                    <div><dt>Size</dt><dd>{formatFileSize(inspectResult.file_size_bytes)}</dd></div>
                    <div><dt>Pages</dt><dd>{inspectResult.page_count}</dd></div>
                    <div><dt>PDF version</dt><dd>{inspectResult.pdf_version}</dd></div>
                    <div><dt>Status</dt><dd><span className={`pdf-tools-protection-status ${inspectedPdfIsProtected ? "is-protected" : "is-normal"}`}>{inspectedPdfIsProtected ? "Protected" : "Normal"}</span></dd></div>
                  </dl>
                  {inspectMetadata.length > 0 && (
                    <details className="pdf-tools-compact-details">
                      <summary>Metadata</summary>
                      <dl className="pdf-tools-metadata-list">
                        {inspectMetadata.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}
                      </dl>
                    </details>
                  )}
                  {inspectedPdfIsProtected && (
                    <div className="pdf-tools-protected-warning" role="alert">
                      <strong>This PDF appears encrypted or permission-protected.</strong>
                      <span>Utility Tools Hub does not decrypt PDFs or bypass permissions.</span>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {selectedOperation === "merge" && (
            <div id="pdf-operation-merge" role="tabpanel" className="pdf-tools-active-operation">
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
            </div>
          )}

          <div className="pdf-tools-operation-grid">
        {selectedOperation === "split" && (
        <section id="pdf-operation-split" role="tabpanel" className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-split-title">
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
        )}

        {selectedOperation === "extract" && (
        <section id="pdf-operation-extract" role="tabpanel" className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-extract-title">
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
        )}

        {selectedOperation === "rotate" && (
        <section id="pdf-operation-rotate" role="tabpanel" className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-rotate-title">
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
        )}

        {selectedOperation === "delete" && (
        <section id="pdf-operation-delete" role="tabpanel" className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-delete-title">
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
        )}

        {selectedOperation === "reorder" && (
        <section id="pdf-operation-reorder" role="tabpanel" className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-reorder-title">
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
        )}

        {selectedOperation === "textWatermark" && (
        <section id="pdf-operation-textWatermark" role="tabpanel" className="pdf-tools-panel pdf-tools-operation-card pdf-tools-watermark-card" aria-labelledby="pdf-text-watermark-title">
          <div className="pdf-tools-section-heading">
            <span>Additive text · All or selected pages</span>
            <h2 id="pdf-text-watermark-title">Text watermark</h2>
            <p>Add text such as DRAFT or CONFIDENTIAL to a new PDF.</p>
          </div>
          <p className="pdf-tools-helper">Printable ASCII / Latin text only for now. Leave Pages empty to target all pages.</p>
          <p className="pdf-tools-warning"><strong>Additive only · Not redaction:</strong> This adds a new text layer. It does not edit or replace existing PDF text and cannot safely hide content.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-outline" onClick={selectWatermarkInput} disabled={isAnyOperationRunning}>
              Select input PDF
            </button>
            <button
              type="button"
              className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
              onClick={selectWatermarkOutputPdf}
              disabled={!nativeDialogAvailable || isAnyOperationRunning}
            >
              {nativeDialogAvailable ? "Select output PDF" : "Output PDF (Desktop only)"}
            </button>
          </div>
          <input
            ref={watermarkFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              selectBrowserWatermarkInput(event.currentTarget.files?.[0], event.currentTarget)
            }
          />

          <dl className="pdf-tools-selection-details">
            <div><dt>Input PDF</dt><dd>{watermarkInput?.name ?? "Not selected"}</dd></div>
            <div>
              <dt>Output PDF</dt>
              <dd className="pdf-tools-path">
                {watermarkOutputPath ? fileNameFromPath(watermarkOutputPath) : "Not selected"}
              </dd>
            </div>
          </dl>

          <OperationInputSummary
            fileName={watermarkInput?.name}
            summary={watermarkInputSummary}
            guidance="Page count checks selected targets. Protected PDFs may be rejected."
          />

          <label className="pdf-tools-field">
            <span>Watermark text</span>
            <input
              type="text"
              value={watermarkText}
              onChange={(event) => {
                setWatermarkText(event.currentTarget.value);
                setWatermarkResult(null);
                setWatermarkFeedback(null);
                setWatermarkError(null);
              }}
              disabled={isAnyOperationRunning}
              placeholder="DRAFT"
              aria-invalid={Boolean(watermarkTextError)}
              aria-describedby={watermarkTextError ? "pdf-watermark-text-help pdf-watermark-text-error" : "pdf-watermark-text-help"}
            />
          </label>
          <p id="pdf-watermark-text-help" className="pdf-tools-field-help">Printable ASCII only · {watermarkText.length}/128 characters</p>
          {watermarkTextError && <p id="pdf-watermark-text-error" className="pdf-tools-field-error">{watermarkTextError}</p>}

          <label className="pdf-tools-field">
            <span>Pages (optional)</span>
            <input
              type="text"
              inputMode="text"
              value={watermarkPagesInput}
              onChange={(event) => {
                setWatermarkPagesInput(event.currentTarget.value);
                setWatermarkResult(null);
                setWatermarkFeedback(null);
                setWatermarkError(null);
              }}
              disabled={isAnyOperationRunning}
              placeholder="All pages, or 1,3,5-7"
              aria-invalid={Boolean(parsedWatermarkPages.error)}
              aria-describedby={parsedWatermarkPages.error ? "pdf-watermark-pages-error" : undefined}
            />
          </label>
          {parsedWatermarkPages.error && <p id="pdf-watermark-pages-error" className="pdf-tools-field-error">{parsedWatermarkPages.error}</p>}

          <div className="pdf-tools-watermark-fields">
            <div className="pdf-tools-watermark-field-group">
              <label className="pdf-tools-field">
                <span>Opacity</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={watermarkOpacityInput}
                  onChange={(event) => {
                    setWatermarkOpacityInput(event.currentTarget.value);
                    setWatermarkResult(null);
                    setWatermarkFeedback(null);
                    setWatermarkError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(watermarkOpacityError)}
                  aria-describedby={watermarkOpacityError ? "pdf-watermark-opacity-error" : undefined}
                />
              </label>
              {watermarkOpacityError && <p id="pdf-watermark-opacity-error" className="pdf-tools-field-error">{watermarkOpacityError}</p>}
            </div>
            <div className="pdf-tools-watermark-field-group">
              <label className="pdf-tools-field">
                <span>Rotation (degrees)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={watermarkRotationInput}
                  onChange={(event) => {
                    setWatermarkRotationInput(event.currentTarget.value);
                    setWatermarkResult(null);
                    setWatermarkFeedback(null);
                    setWatermarkError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(watermarkRotationError)}
                  aria-describedby={watermarkRotationError ? "pdf-watermark-rotation-error" : undefined}
                />
              </label>
              {watermarkRotationError && <p id="pdf-watermark-rotation-error" className="pdf-tools-field-error">{watermarkRotationError}</p>}
            </div>
            <div className="pdf-tools-watermark-field-group">
              <label className="pdf-tools-field">
                <span>Font size (pt)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={watermarkFontSizeInput}
                  onChange={(event) => {
                    setWatermarkFontSizeInput(event.currentTarget.value);
                    setWatermarkResult(null);
                    setWatermarkFeedback(null);
                    setWatermarkError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(watermarkFontSizeError)}
                  aria-describedby={watermarkFontSizeError ? "pdf-watermark-font-size-error" : undefined}
                />
              </label>
              {watermarkFontSizeError && <p id="pdf-watermark-font-size-error" className="pdf-tools-field-error">{watermarkFontSizeError}</p>}
            </div>
          </div>

          <TextWatermarkOperationPlan
            summary={watermarkInputSummary}
            text={watermarkText}
            pagesInput={watermarkPagesInput}
            opacityInput={watermarkOpacityInput}
            rotationInput={watermarkRotationInput}
            fontSizeInput={watermarkFontSizeInput}
            outputPath={watermarkOutputPath}
          />

          <button type="button" className="btn btn-primary" onClick={addTextWatermark} disabled={!canWatermark}>
            {isWatermarking ? "Adding watermark..." : "Add watermark"}
          </button>
          {!canWatermark && !isWatermarking && (
            <p className="pdf-tools-operation-requirements">To enable Text watermark: {watermarkDisabledReason}</p>
          )}

          {isWatermarking && <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">Adding the text watermark to a new PDF...</div>}
          {watermarkError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{watermarkError}</div>}
          {!watermarkError && !isWatermarking && watermarkFeedback && (
            <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status">
              <strong>{watermarkFeedback}</strong>
              {watermarkResult && (
                <span>{watermarkResult.pages.length} target page{watermarkResult.pages.length === 1 ? "" : "s"} · Text: {watermarkResult.text} · {watermarkResult.page_count} total pages · Output: {fileNameFromPath(watermarkResult.output_path)}</span>
              )}
            </div>
          )}
        </section>
        )}

        {selectedOperation === "pageNumbers" && (
        <section id="pdf-operation-pageNumbers" role="tabpanel" className="pdf-tools-panel pdf-tools-operation-card pdf-tools-page-numbers-card" aria-labelledby="pdf-page-numbers-title">
          <div className="pdf-tools-section-heading">
            <span>Additive text · All or selected pages</span>
            <h2 id="pdf-page-numbers-title">Page numbers</h2>
            <p>Add page numbers to all or selected pages and save a new PDF.</p>
          </div>
          <p className="pdf-tools-helper">Leave Pages empty to target all pages. Page numbers start at 1 unless you choose another positive whole number.</p>
          <p className="pdf-tools-warning"><strong>Additive only · Not redaction:</strong> This adds new page-number text. It does not edit existing PDF text, remove existing page numbers, or hide content.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-outline" onClick={selectPageNumbersInput} disabled={isAnyOperationRunning}>
              Select input PDF
            </button>
            <button
              type="button"
              className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
              onClick={selectPageNumbersOutputPdf}
              disabled={!nativeDialogAvailable || isAnyOperationRunning}
            >
              {nativeDialogAvailable ? "Select output PDF" : "Output PDF (Desktop only)"}
            </button>
          </div>
          <input
            ref={pageNumbersFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              selectBrowserPageNumbersInput(event.currentTarget.files?.[0], event.currentTarget)
            }
          />

          <dl className="pdf-tools-selection-details">
            <div><dt>Input PDF</dt><dd>{pageNumbersInput?.name ?? "Not selected"}</dd></div>
            <div>
              <dt>Output PDF</dt>
              <dd className="pdf-tools-path">
                {pageNumbersOutputPath ? fileNameFromPath(pageNumbersOutputPath) : "Not selected"}
              </dd>
            </div>
          </dl>

          <OperationInputSummary
            fileName={pageNumbersInput?.name}
            summary={pageNumbersInputSummary}
            guidance="Page count checks selected targets. Protected PDFs may be rejected."
          />

          <label className="pdf-tools-field">
            <span>Pages (optional)</span>
            <input
              type="text"
              inputMode="text"
              value={pageNumbersPagesInput}
              onChange={(event) => {
                setPageNumbersPagesInput(event.currentTarget.value);
                setPageNumbersResult(null);
                setPageNumbersFeedback(null);
                setPageNumbersError(null);
              }}
              disabled={isAnyOperationRunning}
              placeholder="All pages, or 1,3,5-7"
              aria-invalid={Boolean(parsedPageNumbersPages.error)}
              aria-describedby={parsedPageNumbersPages.error ? "pdf-page-numbers-pages-help pdf-page-numbers-pages-error" : "pdf-page-numbers-pages-help"}
            />
          </label>
          <p id="pdf-page-numbers-pages-help" className="pdf-tools-field-help">1-based pages · Examples: 1, 1,3,5, 1-3, or 1,3,5-7</p>
          {parsedPageNumbersPages.error && <p id="pdf-page-numbers-pages-error" className="pdf-tools-field-error">{parsedPageNumbersPages.error}</p>}

          <div className="pdf-tools-parameter-fields">
            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Start number</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pageNumbersStartInput}
                  onChange={(event) => {
                    setPageNumbersStartInput(event.currentTarget.value);
                    setPageNumbersResult(null);
                    setPageNumbersFeedback(null);
                    setPageNumbersError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(pageNumbersStartError)}
                  aria-describedby={pageNumbersStartError ? "pdf-page-numbers-start-error" : undefined}
                />
              </label>
              {pageNumbersStartError && <p id="pdf-page-numbers-start-error" className="pdf-tools-field-error">{pageNumbersStartError}</p>}
            </div>
            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Format</span>
                <select
                  value={pageNumbersFormat}
                  onChange={(event) => {
                    setPageNumbersFormat(event.currentTarget.value as PageNumberFormat);
                    setPageNumbersResult(null);
                    setPageNumbersFeedback(null);
                    setPageNumbersError(null);
                  }}
                  disabled={isAnyOperationRunning}
                >
                  {pageNumberFormatOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Position</span>
                <select
                  value={pageNumbersPosition}
                  onChange={(event) => {
                    setPageNumbersPosition(event.currentTarget.value as PageNumberPosition);
                    setPageNumbersResult(null);
                    setPageNumbersFeedback(null);
                    setPageNumbersError(null);
                  }}
                  disabled={isAnyOperationRunning}
                >
                  {pageNumberPositionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Margin X (pt)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={pageNumbersMarginXInput}
                  onChange={(event) => {
                    setPageNumbersMarginXInput(event.currentTarget.value);
                    setPageNumbersResult(null);
                    setPageNumbersFeedback(null);
                    setPageNumbersError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(pageNumbersMarginXError)}
                  aria-describedby={pageNumbersMarginXError ? "pdf-page-numbers-margin-x-error" : undefined}
                />
              </label>
              {pageNumbersMarginXError && <p id="pdf-page-numbers-margin-x-error" className="pdf-tools-field-error">{pageNumbersMarginXError}</p>}
            </div>
            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Margin Y (pt)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={pageNumbersMarginYInput}
                  onChange={(event) => {
                    setPageNumbersMarginYInput(event.currentTarget.value);
                    setPageNumbersResult(null);
                    setPageNumbersFeedback(null);
                    setPageNumbersError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(pageNumbersMarginYError)}
                  aria-describedby={pageNumbersMarginYError ? "pdf-page-numbers-margin-y-error" : undefined}
                />
              </label>
              {pageNumbersMarginYError && <p id="pdf-page-numbers-margin-y-error" className="pdf-tools-field-error">{pageNumbersMarginYError}</p>}
            </div>
            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Font size (pt)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={pageNumbersFontSizeInput}
                  onChange={(event) => {
                    setPageNumbersFontSizeInput(event.currentTarget.value);
                    setPageNumbersResult(null);
                    setPageNumbersFeedback(null);
                    setPageNumbersError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(pageNumbersFontSizeError)}
                  aria-describedby={pageNumbersFontSizeError ? "pdf-page-numbers-font-size-error" : undefined}
                />
              </label>
              {pageNumbersFontSizeError && <p id="pdf-page-numbers-font-size-error" className="pdf-tools-field-error">{pageNumbersFontSizeError}</p>}
            </div>
          </div>

          <PageNumbersOperationPlan
            summary={pageNumbersInputSummary}
            pagesInput={pageNumbersPagesInput}
            startNumberInput={pageNumbersStartInput}
            format={pageNumbersFormat}
            position={pageNumbersPosition}
            marginXInput={pageNumbersMarginXInput}
            marginYInput={pageNumbersMarginYInput}
            fontSizeInput={pageNumbersFontSizeInput}
            outputPath={pageNumbersOutputPath}
          />

          <button type="button" className="btn btn-primary" onClick={addPageNumbers} disabled={!canAddPageNumbers}>
            {isAddingPageNumbers ? "Adding page numbers..." : "Add page numbers"}
          </button>
          {!canAddPageNumbers && !isAddingPageNumbers && (
            <p className="pdf-tools-operation-requirements">To enable Page numbers: {pageNumbersDisabledReason}</p>
          )}

          {isAddingPageNumbers && <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">Adding page numbers to a new PDF...</div>}
          {pageNumbersError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{pageNumbersError}</div>}
          {!pageNumbersError && !isAddingPageNumbers && pageNumbersFeedback && (
            <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status">
              <strong>{pageNumbersFeedback}</strong>
              {pageNumbersResult && (
                <span>{pageNumbersResult.pages.length} target page{pageNumbersResult.pages.length === 1 ? "" : "s"} · Start {pageNumbersResult.start_number} · {pageNumbersResult.page_count} total pages · Output: {fileNameFromPath(pageNumbersResult.output_path)}</span>
              )}
            </div>
          )}
        </section>
        )}

        {selectedOperation === "imageWatermark" && (
        <section id="pdf-operation-imageWatermark" role="tabpanel" className="pdf-tools-panel pdf-tools-operation-card pdf-tools-watermark-card" aria-labelledby="pdf-image-watermark-title">
          <div className="pdf-tools-section-heading">
            <span>JPEG image overlay · JPEG only</span>
            <h2 id="pdf-image-watermark-title">Image watermark</h2>
            <p>Add one baseline grayscale/RGB JPEG image to all or selected pages and save a new PDF.</p>
          </div>
          <p className="pdf-tools-helper">JPEG/JPG only for now. Position is fixed at center; width preserves the image aspect ratio. No image preview or thumbnails are rendered.</p>
          <p className="pdf-tools-warning"><strong>Additive only · Not redaction:</strong> Image watermark does not edit existing PDF text or remove existing images or page numbers. It cannot safely hide content.</p>
          <p className="pdf-tools-helper">PNG alpha, WebP, SVG, CMYK/YCCK JPEG, progressive JPEG, image stamps, text stamps, preview, OCR, redaction, and direct text editing are not implemented.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-outline" onClick={selectImageWatermarkInput} disabled={isAnyOperationRunning}>
              Select input PDF
            </button>
            <button type="button" className="btn btn-outline" onClick={selectImageWatermarkJpeg} disabled={isAnyOperationRunning}>
              Select JPEG image
            </button>
            <button
              type="button"
              className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
              onClick={selectImageWatermarkOutputPdf}
              disabled={!nativeDialogAvailable || isAnyOperationRunning}
            >
              {nativeDialogAvailable ? "Select output PDF" : "Output PDF (Desktop only)"}
            </button>
          </div>
          <input
            ref={imageWatermarkPdfFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              selectBrowserImageWatermarkInput(event.currentTarget.files?.[0], event.currentTarget)
            }
          />
          <input
            ref={imageWatermarkImageFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".jpg,.jpeg,image/jpeg"
            onChange={(event) =>
              selectBrowserImageWatermarkJpeg(event.currentTarget.files?.[0], event.currentTarget)
            }
          />

          <dl className="pdf-tools-selection-details">
            <div><dt>Input PDF</dt><dd>{imageWatermarkInput?.name ?? "Not selected"}</dd></div>
            <div><dt>JPEG image</dt><dd>{imageWatermarkImage?.name ?? "Not selected"}</dd></div>
            <div><dt>Position</dt><dd>Center · fixed</dd></div>
            <div>
              <dt>Output PDF</dt>
              <dd className="pdf-tools-path">
                {imageWatermarkOutputPath ? fileNameFromPath(imageWatermarkOutputPath) : "Not selected"}
              </dd>
            </div>
          </dl>

          <OperationInputSummary
            fileName={imageWatermarkInput?.name}
            summary={imageWatermarkInputSummary}
            guidance="Page count checks selected targets. Protected PDFs are not decrypted or bypassed."
          />

          <label className="pdf-tools-field">
            <span>Pages (optional)</span>
            <input
              type="text"
              inputMode="text"
              value={imageWatermarkPagesInput}
              onChange={(event) => {
                setImageWatermarkPagesInput(event.currentTarget.value);
                setImageWatermarkResult(null);
                setImageWatermarkFeedback(null);
                setImageWatermarkError(null);
              }}
              disabled={isAnyOperationRunning}
              placeholder="All pages, or 1,3,5-7"
              aria-invalid={Boolean(parsedImageWatermarkPages.error)}
              aria-describedby={parsedImageWatermarkPages.error ? "pdf-image-watermark-pages-help pdf-image-watermark-pages-error" : "pdf-image-watermark-pages-help"}
            />
          </label>
          <p id="pdf-image-watermark-pages-help" className="pdf-tools-field-help">Leave empty for all pages · Examples: 1, 1,3, 1-3, or 1,3,5-7</p>
          {parsedImageWatermarkPages.error && <p id="pdf-image-watermark-pages-error" className="pdf-tools-field-error">{parsedImageWatermarkPages.error}</p>}

          <div className="pdf-tools-watermark-fields">
            <div className="pdf-tools-watermark-field-group">
              <label className="pdf-tools-field">
                <span>Width (pt)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={imageWatermarkWidthInput}
                  onChange={(event) => {
                    setImageWatermarkWidthInput(event.currentTarget.value);
                    setImageWatermarkResult(null);
                    setImageWatermarkFeedback(null);
                    setImageWatermarkError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(imageWatermarkWidthError)}
                  aria-describedby={imageWatermarkWidthError ? "pdf-image-watermark-width-error" : undefined}
                />
              </label>
              {imageWatermarkWidthError && <p id="pdf-image-watermark-width-error" className="pdf-tools-field-error">{imageWatermarkWidthError}</p>}
            </div>
            <div className="pdf-tools-watermark-field-group">
              <label className="pdf-tools-field">
                <span>Opacity</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={imageWatermarkOpacityInput}
                  onChange={(event) => {
                    setImageWatermarkOpacityInput(event.currentTarget.value);
                    setImageWatermarkResult(null);
                    setImageWatermarkFeedback(null);
                    setImageWatermarkError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(imageWatermarkOpacityError)}
                  aria-describedby={imageWatermarkOpacityError ? "pdf-image-watermark-opacity-error" : undefined}
                />
              </label>
              {imageWatermarkOpacityError && <p id="pdf-image-watermark-opacity-error" className="pdf-tools-field-error">{imageWatermarkOpacityError}</p>}
            </div>
            <div className="pdf-tools-watermark-field-group">
              <label className="pdf-tools-field">
                <span>Rotation (degrees)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={imageWatermarkRotationInput}
                  onChange={(event) => {
                    setImageWatermarkRotationInput(event.currentTarget.value);
                    setImageWatermarkResult(null);
                    setImageWatermarkFeedback(null);
                    setImageWatermarkError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(imageWatermarkRotationError)}
                  aria-describedby={imageWatermarkRotationError ? "pdf-image-watermark-rotation-error" : undefined}
                />
              </label>
              {imageWatermarkRotationError && <p id="pdf-image-watermark-rotation-error" className="pdf-tools-field-error">{imageWatermarkRotationError}</p>}
            </div>
          </div>

          <ImageWatermarkOperationPlan
            summary={imageWatermarkInputSummary}
            image={imageWatermarkImage}
            pagesInput={imageWatermarkPagesInput}
            widthInput={imageWatermarkWidthInput}
            opacityInput={imageWatermarkOpacityInput}
            rotationInput={imageWatermarkRotationInput}
            outputPath={imageWatermarkOutputPath}
          />

          <button type="button" className="btn btn-primary" onClick={addImageWatermark} disabled={!canAddImageWatermark}>
            {isAddingImageWatermark ? "Adding image watermark..." : "Add image watermark"}
          </button>
          {!canAddImageWatermark && !isAddingImageWatermark && (
            <p className="pdf-tools-operation-requirements">To enable Image watermark: {imageWatermarkDisabledReason}</p>
          )}

          {isAddingImageWatermark && <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">Adding the JPEG image watermark to a new PDF...</div>}
          {imageWatermarkError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{imageWatermarkError}</div>}
          {!imageWatermarkError && !isAddingImageWatermark && imageWatermarkFeedback && (
            <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status">
              <strong>{imageWatermarkFeedback}</strong>
              {imageWatermarkResult && (
                <span>{imageWatermarkResult.pages.length} target page{imageWatermarkResult.pages.length === 1 ? "" : "s"} · Center · {imageWatermarkResult.width} × {imageWatermarkResult.height} pt · Opacity {imageWatermarkResult.opacity} · Rotation {imageWatermarkResult.rotation_degrees}° · {imageWatermarkResult.page_count} total pages · Output: {fileNameFromPath(imageWatermarkResult.output_path)}</span>
              )}
            </div>
          )}
        </section>
        )}

        {selectedOperation === "textStamp" && (
        <section id="pdf-operation-textStamp" role="tabpanel" className="pdf-tools-panel pdf-tools-operation-card" aria-labelledby="pdf-text-stamp-title">
          <div className="pdf-tools-section-heading">
            <span>Additive text · All or selected pages</span>
            <h2 id="pdf-text-stamp-title">Text stamp</h2>
            <p>Add a short status label such as APPROVED, REVIEWED, or PAID to a new PDF.</p>
          </div>
          <p className="pdf-tools-helper">Leave Pages empty to stamp all pages. Stamp text supports one printable ASCII / Latin-1 line, up to 64 characters. Japanese font embedding and multiple lines are not supported.</p>
          <p className="pdf-tools-warning"><strong>Additive only · Not redaction · Not PDF text editing:</strong> Adds a status label without removing existing text, images, page numbers, or watermarks. It is not a digital signature, identity verification, or an audit trail; border/background styling is not included.</p>

          <div className="pdf-tools-button-row">
            <button type="button" className="btn btn-outline" onClick={selectTextStampInput} disabled={isAnyOperationRunning}>
              Select input PDF
            </button>
            <button
              type="button"
              className={nativeDialogAvailable ? "btn btn-outline" : "btn btn-disabled"}
              onClick={selectTextStampOutputPdf}
              disabled={!nativeDialogAvailable || isAnyOperationRunning}
            >
              {nativeDialogAvailable ? "Select output PDF" : "Output PDF (Desktop only)"}
            </button>
          </div>
          <input
            ref={textStampFileInputRef}
            className="pdf-tools-hidden-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              selectBrowserTextStampInput(event.currentTarget.files?.[0], event.currentTarget)
            }
          />

          <dl className="pdf-tools-selection-details">
            <div><dt>Input PDF</dt><dd>{textStampInput?.name ?? "Not selected"}</dd></div>
            <div>
              <dt>Output PDF</dt>
              <dd className="pdf-tools-path">
                {textStampOutputPath ? fileNameFromPath(textStampOutputPath) : "Not selected"}
              </dd>
            </div>
          </dl>

          <OperationInputSummary
            fileName={textStampInput?.name}
            summary={textStampInputSummary}
            guidance="Page count checks selected targets. Protected PDFs are not supported."
          />

          <div className="pdf-tools-parameter-fields">
            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Stamp text</span>
                <input
                  type="text"
                  value={textStampText}
                  onChange={(event) => {
                    setTextStampText(event.currentTarget.value);
                    setTextStampResult(null);
                    setTextStampFeedback(null);
                    setTextStampError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  placeholder="APPROVED"
                  aria-invalid={Boolean(textStampTextError)}
                  aria-describedby={textStampTextError ? "pdf-text-stamp-text-help pdf-text-stamp-text-error" : "pdf-text-stamp-text-help"}
                />
              </label>
              <p id="pdf-text-stamp-text-help" className="pdf-tools-field-help pdf-tools-text-stamp-field-help">Short stamp text · Max 64 chars.</p>
              {textStampTextError && <p id="pdf-text-stamp-text-error" className="pdf-tools-field-error">{textStampTextError}</p>}
            </div>

            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Pages (optional)</span>
                <input
                  type="text"
                  inputMode="text"
                  value={textStampPagesInput}
                  onChange={(event) => {
                    setTextStampPagesInput(event.currentTarget.value);
                    setTextStampResult(null);
                    setTextStampFeedback(null);
                    setTextStampError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  placeholder="All pages, or 1,3,5-7"
                  aria-invalid={Boolean(parsedTextStampPages.error)}
                  aria-describedby={parsedTextStampPages.error ? "pdf-text-stamp-pages-help pdf-text-stamp-pages-error" : "pdf-text-stamp-pages-help"}
                />
              </label>
              <p id="pdf-text-stamp-pages-help" className="pdf-tools-field-help pdf-tools-text-stamp-field-help">Empty = all pages · Examples: 1,3 or 1-3</p>
              {parsedTextStampPages.error && <p id="pdf-text-stamp-pages-error" className="pdf-tools-field-error">{parsedTextStampPages.error}</p>}
            </div>

            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Position</span>
                <select
                  value={textStampPosition}
                  onChange={(event) => {
                    setTextStampPosition(event.currentTarget.value as TextStampPosition);
                    setTextStampResult(null);
                    setTextStampFeedback(null);
                    setTextStampError(null);
                  }}
                  disabled={isAnyOperationRunning}
                >
                  {textStampPositionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Margin X (pt)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={textStampMarginXInput}
                  onChange={(event) => {
                    setTextStampMarginXInput(event.currentTarget.value);
                    setTextStampResult(null);
                    setTextStampFeedback(null);
                    setTextStampError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(textStampMarginXError)}
                  aria-describedby={textStampMarginXError ? "pdf-text-stamp-margin-x-error" : undefined}
                />
              </label>
              {textStampMarginXError && <p id="pdf-text-stamp-margin-x-error" className="pdf-tools-field-error">{textStampMarginXError}</p>}
            </div>

            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Margin Y (pt)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={textStampMarginYInput}
                  onChange={(event) => {
                    setTextStampMarginYInput(event.currentTarget.value);
                    setTextStampResult(null);
                    setTextStampFeedback(null);
                    setTextStampError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(textStampMarginYError)}
                  aria-describedby={textStampMarginYError ? "pdf-text-stamp-margin-y-error" : undefined}
                />
              </label>
              {textStampMarginYError && <p id="pdf-text-stamp-margin-y-error" className="pdf-tools-field-error">{textStampMarginYError}</p>}
            </div>

            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Font size (pt)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={textStampFontSizeInput}
                  onChange={(event) => {
                    setTextStampFontSizeInput(event.currentTarget.value);
                    setTextStampResult(null);
                    setTextStampFeedback(null);
                    setTextStampError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(textStampFontSizeError)}
                  aria-describedby={textStampFontSizeError ? "pdf-text-stamp-font-size-error" : undefined}
                />
              </label>
              {textStampFontSizeError && <p id="pdf-text-stamp-font-size-error" className="pdf-tools-field-error">{textStampFontSizeError}</p>}
            </div>

            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Opacity</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={textStampOpacityInput}
                  onChange={(event) => {
                    setTextStampOpacityInput(event.currentTarget.value);
                    setTextStampResult(null);
                    setTextStampFeedback(null);
                    setTextStampError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(textStampOpacityError)}
                  aria-describedby={textStampOpacityError ? "pdf-text-stamp-opacity-error" : undefined}
                />
              </label>
              {textStampOpacityError && <p id="pdf-text-stamp-opacity-error" className="pdf-tools-field-error">{textStampOpacityError}</p>}
            </div>

            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Rotation (degrees)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={textStampRotationInput}
                  onChange={(event) => {
                    setTextStampRotationInput(event.currentTarget.value);
                    setTextStampResult(null);
                    setTextStampFeedback(null);
                    setTextStampError(null);
                  }}
                  disabled={isAnyOperationRunning}
                  aria-invalid={Boolean(textStampRotationError)}
                  aria-describedby={textStampRotationError ? "pdf-text-stamp-rotation-error" : undefined}
                />
              </label>
              {textStampRotationError && <p id="pdf-text-stamp-rotation-error" className="pdf-tools-field-error">{textStampRotationError}</p>}
            </div>

            <div className="pdf-tools-parameter-field-group">
              <label className="pdf-tools-field">
                <span>Color</span>
                <select
                  value={textStampColor}
                  onChange={(event) => {
                    setTextStampColor(event.currentTarget.value as TextStampColor);
                    setTextStampResult(null);
                    setTextStampFeedback(null);
                    setTextStampError(null);
                  }}
                  disabled={isAnyOperationRunning}
                >
                  {textStampColorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          <TextStampOperationPlan
            summary={textStampInputSummary}
            text={textStampText}
            pagesInput={textStampPagesInput}
            position={textStampPosition}
            marginXInput={textStampMarginXInput}
            marginYInput={textStampMarginYInput}
            fontSizeInput={textStampFontSizeInput}
            opacityInput={textStampOpacityInput}
            rotationInput={textStampRotationInput}
            color={textStampColor}
            outputPath={textStampOutputPath}
          />

          <button type="button" className="btn btn-primary" onClick={addTextStamp} disabled={!canAddTextStamp}>
            {isAddingTextStamp ? "Adding text stamp..." : "Add text stamp"}
          </button>
          {!canAddTextStamp && !isAddingTextStamp && (
            <p className="pdf-tools-operation-requirements">To enable Text stamp: {textStampDisabledReason}</p>
          )}

          {isAddingTextStamp && <div className="pdf-tools-feedback pdf-tools-feedback-loading pdf-tools-operation-feedback" role="status">Adding the text stamp to a new PDF...</div>}
          {textStampError && <div className="pdf-tools-feedback pdf-tools-feedback-error pdf-tools-operation-feedback" role="alert">{textStampError}</div>}
          {!textStampError && !isAddingTextStamp && textStampFeedback && (
            <div className="pdf-tools-feedback pdf-tools-operation-feedback" role="status">
              <strong>{textStampFeedback}</strong>
              {textStampResult && (
                <span>{textStampResult.pages.length} target page{textStampResult.pages.length === 1 ? "" : "s"} · {textStampResult.text} · {textStampResult.position} · {textStampResult.color} · {textStampResult.font_size} pt · Opacity {textStampResult.opacity} · Rotation {textStampResult.rotation_degrees}° · {textStampResult.page_count} total pages · Output: {fileNameFromPath(textStampResult.output_path)}</span>
              )}
            </div>
          )}
        </section>
        )}
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
              <li><span>{activeOperationStatus.label}</span><strong className={activeOperationStatus.className}>{activeOperationStatus.status}</strong></li>
            </ul>
            <details className="pdf-tools-compact-details pdf-tools-status-details">
              <summary>All operation statuses</summary>
              <ul className="pdf-tools-status-list">
                {operationStatuses.map((operation) => (
                  <li key={operation.id}><span>{operation.label}</span><strong className={operation.className}>{operation.status}</strong></li>
                ))}
              </ul>
            </details>
            <p className="pdf-tools-status-help">Detailed messages remain inside the active operation.</p>
          </section>

          <details className="pdf-tools-panel pdf-tools-compact-details pdf-tools-sidebar-disclosure">
            <summary>Available operations</summary>
          <section className="pdf-tools-sidebar-card" aria-labelledby="available-pdf-tools-title">
            <div className="pdf-tools-section-heading">
              <span>Available</span>
              <h2 id="available-pdf-tools-title">Local PDF operations</h2>
            </div>
            <div className="pdf-tools-capability-list pdf-tools-capability-available">
              {['Inspect PDF summary', 'Merge PDFs', 'Split PDF', 'Extract pages', 'Rotate pages', 'Delete pages', 'Reorder pages', 'Text watermark', 'Page numbers', 'JPEG image watermark', 'Text stamp'].map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </section>
          </details>

          <details className="pdf-tools-panel pdf-tools-compact-details pdf-tools-sidebar-disclosure">
            <summary>Planned tools</summary>
          <section className="pdf-tools-sidebar-card" aria-labelledby="planned-pdf-tools-title">
            <div className="pdf-tools-section-heading">
              <span>Planned</span>
              <h2 id="planned-pdf-tools-title">Future workspace tools</h2>
              <p>Planning only. Not available in this release.</p>
            </div>
            <div className="pdf-tools-capability-list pdf-tools-capability-planned">
              {plannedPageTools.map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </section>
          </details>

          <details className="pdf-tools-panel pdf-tools-compact-details pdf-tools-sidebar-disclosure pdf-tools-research">
            <summary>Research · Safety critical</summary>
          <section className="pdf-tools-sidebar-card" aria-labelledby="advanced-pdf-tools-title">
            <div className="pdf-tools-section-heading">
              <span>Research · Safety critical</span>
              <h2 id="advanced-pdf-tools-title">Not implemented</h2>
            </div>
            <div className="pdf-tools-capability-list pdf-tools-capability-research">
              {researchTools.map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </section>
          </details>

          <details className="pdf-tools-panel pdf-tools-compact-details pdf-tools-sidebar-disclosure pdf-tools-safety">
            <summary>Safety notes</summary>
          <section className="pdf-tools-sidebar-card" aria-labelledby="pdf-safety-title">
            <div className="pdf-tools-section-heading">
              <span>Important</span>
              <h2 id="pdf-safety-title">Safety notes</h2>
            </div>
            <ul>
              <li>PDF files stay on this device. Full local paths are not shown.</li>
              <li>Original files are not overwritten by default.</li>
              <li>Protected PDFs are rejected. Utility Tools Hub does not decrypt PDFs or bypass permissions.</li>
              <li>Delete pages removes whole pages only; it is not redaction. Visual masks are not safe redaction and do not remove underlying content.</li>
              <li>Image watermark is additive; it does not edit PDF text, remove existing images or page numbers, or provide redaction.</li>
              <li>Page numbers is additive; it does not edit PDF text, remove existing numbering, or provide redaction.</li>
              <li>Text stamp is additive; it does not edit or remove existing PDF text, images, page numbers, or watermarks, and it is not redaction.</li>
              <li>Text stamp border/background styling, real PDF preview, and thumbnails are not implemented.</li>
              <li>OCR and direct text editing are not implemented.</li>
            </ul>
          </section>
          </details>
        </aside>
      </div>
    </div>
  );
}
