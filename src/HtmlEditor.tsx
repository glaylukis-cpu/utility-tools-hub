import { useEffect, useRef, useState } from "react";
import "./HtmlEditor.css";

type BlockType = "heading" | "paragraph" | "button" | "divider" | "table" | "card" | "image";
type TextAlign = "left" | "center" | "right";
type TemplateName = "landing" | "article" | "product";
type CanvasViewport = "desktop" | "tablet" | "mobile";

const canvasViewportWidths: Record<CanvasViewport, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 390,
};

interface BlockStyle {
  align: TextAlign;
  backgroundColor: string;
  textColor: string;
  padding: number;
}

interface EditorBlock {
  id: number;
  type: BlockType;
  text: string;
  style: BlockStyle;
  imageDataUrl?: string;
}

const blockLabels: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  button: "Button",
  divider: "Divider",
  table: "Table",
  card: "Card",
  image: "Image",
};

const defaultText: Record<BlockType, string> = {
  heading: "Your heading",
  paragraph: "Write a paragraph here.",
  button: "Call to action",
  divider: "",
  table: "Name | Value\nExample | 100",
  card: "Card title",
  image: "Image description",
};

const templateLabels: Record<TemplateName, string> = {
  landing: "Landing Page",
  article: "Simple Article",
  product: "Product Card",
};

const templates: Record<TemplateName, Array<{ type: BlockType; text: string }>> = {
  landing: [
    { type: "heading", text: "Build something remarkable" },
    { type: "paragraph", text: "Introduce your product with a clear, focused message." },
    { type: "button", text: "Get started" },
    { type: "card", text: "Why choose us" },
  ],
  article: [
    { type: "heading", text: "Article title" },
    { type: "paragraph", text: "Write an engaging introduction for your article." },
    { type: "divider", text: "" },
    { type: "paragraph", text: "Continue the story with supporting details." },
  ],
  product: [
    { type: "image", text: "Product image" },
    { type: "heading", text: "Product name" },
    { type: "paragraph", text: "Describe the key benefit of this product." },
    { type: "button", text: "View product" },
  ],
};

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const EMPTY_IMAGE_DATA_URL = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"]);

function isSafeImageDataUrl(value: string | undefined): value is string {
  return typeof value === "string" && /^data:image\/(?:png|jpeg|gif|webp|bmp);base64,[a-z0-9+/=]+$/i.test(value);
}

function createStyle(type: BlockType): BlockStyle {
  return {
    align: "left",
    backgroundColor: type === "card" ? "#f8fafc" : "#ffffff",
    textColor: "#1e293b",
    padding: type === "divider" ? 8 : 16,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function styleToHtml(style: BlockStyle): string {
  return [
    `text-align:${style.align}`,
    `background-color:${style.backgroundColor}`,
    `color:${style.textColor}`,
    `padding:${style.padding}px`,
    "box-sizing:border-box",
  ].join(";");
}

function tableHtml(block: EditorBlock): string {
  const rows = block.text
    .split(/\r?\n/)
    .filter((row) => row.trim())
    .map((row, rowIndex) => {
      const tag = rowIndex === 0 ? "th" : "td";
      const cells = row
        .split("|")
        .map((cell) => `<${tag} style="border:1px solid #cbd5e1;padding:8px">${escapeHtml(cell.trim())}</${tag}>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table style="${styleToHtml(block.style)};width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table>`;
}

function blockToHtml(block: EditorBlock): string {
  const style = styleToHtml(block.style);
  const text = escapeHtml(block.text);

  switch (block.type) {
    case "heading":
      return `<h2 style="${style};margin:0">${text}</h2>`;
    case "paragraph":
      return `<p style="${style};margin:0;line-height:1.6">${text}</p>`;
    case "button":
      return `<div style="${style}"><a href="#" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#2563eb;color:#ffffff;text-decoration:none">${text}</a></div>`;
    case "divider":
      return `<div style="${style}"><hr style="border:0;border-top:1px solid #cbd5e1;margin:0"></div>`;
    case "table":
      return tableHtml(block);
    case "card":
      return `<section style="${style};border:1px solid #e2e8f0;border-radius:10px"><h3 style="margin:0 0 8px">${text}</h3><p style="margin:0;opacity:.75">Card content</p></section>`;
    case "image": {
      const source = isSafeImageDataUrl(block.imageDataUrl) ? block.imageDataUrl : EMPTY_IMAGE_DATA_URL;
      return `<div style="${style}"><img src="${source}" alt="${text}" style="display:block;max-width:100%;height:auto;margin:0 auto;background:#e2e8f0;min-height:120px"></div>`;
    }
  }
}

function generateHtml(blocks: EditorBlock[]): string {
  const content = blocks.map(blockToHtml).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HTML Editor Preview</title>
</head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#ffffff">
${content}
</body>
</html>`;
}

function CanvasBlock({ block }: { block: EditorBlock }) {
  const style = {
    textAlign: block.style.align,
    backgroundColor: block.style.backgroundColor,
    color: block.style.textColor,
    padding: block.style.padding,
  } as const;

  switch (block.type) {
    case "heading":
      return <h2 style={{ ...style, margin: 0 }}>{block.text}</h2>;
    case "paragraph":
      return <p style={{ ...style, margin: 0, lineHeight: 1.6 }}>{block.text}</p>;
    case "button":
      return <div style={style}><span className="html-editor-button-preview">{block.text}</span></div>;
    case "divider":
      return <div style={style}><hr /></div>;
    case "table":
      return <div style={style} className="html-editor-table-preview">{block.text}</div>;
    case "card":
      return <section style={style} className="html-editor-card-preview"><h3>{block.text}</h3><p>Card content</p></section>;
    case "image":
      return (
        <div style={style} className="html-editor-image-preview">
          {isSafeImageDataUrl(block.imageDataUrl)
            ? <img src={block.imageDataUrl} alt={block.text} />
            : <div className="html-editor-image-placeholder">No image selected</div>}
        </div>
      );
  }
}

export default function HtmlEditorPage({ onBack }: { onBack: () => void }) {
  const nextId = useRef(3);
  const [blocks, setBlocks] = useState<EditorBlock[]>([
    { id: 1, type: "heading", text: "Welcome", style: createStyle("heading") },
    { id: 2, type: "paragraph", text: "Start building your HTML page with blocks.", style: createStyle("paragraph") },
  ]);
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [htmlSource, setHtmlSource] = useState(() => generateHtml(blocks));
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [canvasViewport, setCanvasViewport] = useState<CanvasViewport>("desktop");

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;

  useEffect(() => {
    setHtmlSource(generateHtml(blocks));
    setCopied(false);
  }, [blocks]);

  const createBlock = (type: BlockType, text = defaultText[type]): EditorBlock => ({
      id: nextId.current++,
      type,
      text,
      style: createStyle(type),
    });

  const addBlock = (type: BlockType) => {
    const block = createBlock(type);
    setBlocks((current) => [...current, block]);
    setSelectedId(block.id);
    setImageError(null);
  };

  const applyTemplate = (template: TemplateName) => {
    if (blocks.length > 0 && !window.confirm("Replace the current blocks with this template?")) return;
    const nextBlocks = templates[template].map((block) => createBlock(block.type, block.text));
    setBlocks(nextBlocks);
    setSelectedId(nextBlocks[0]?.id ?? null);
    setImageError(null);
  };

  const updateSelected = (update: Partial<Pick<EditorBlock, "text" | "style">>) => {
    if (selectedId === null) return;
    setBlocks((current) => current.map((block) => block.id === selectedId ? { ...block, ...update } : block));
  };

  const updateStyle = <K extends keyof BlockStyle>(key: K, value: BlockStyle[K]) => {
    if (!selectedBlock) return;
    updateSelected({ style: { ...selectedBlock.style, [key]: value } });
  };

  const deleteSelected = () => {
    if (selectedId === null) return;
    setBlocks((current) => current.filter((block) => block.id !== selectedId));
    setSelectedId(null);
  };

  const moveSelected = (direction: -1 | 1) => {
    if (selectedId === null) return;
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === selectedId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const duplicateSelected = () => {
    if (!selectedBlock) return;
    const duplicate = {
      ...selectedBlock,
      id: nextId.current++,
      style: { ...selectedBlock.style },
    };
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === selectedBlock.id);
      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
    setSelectedId(duplicate.id);
  };

  const selectBlock = (id: number) => {
    setSelectedId(id);
    setImageError(null);
  };

  const selectImage = (file: File | undefined) => {
    if (!file || !selectedBlock || selectedBlock.type !== "image") return;
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError("Image must be 3MB or smaller.");
      return;
    }
    if (!allowedImageTypes.has(file.type)) {
      setImageError("Please choose a PNG, JPEG, GIF, WebP, or BMP image.");
      return;
    }

    const blockId = selectedBlock.id;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : undefined;
      if (!isSafeImageDataUrl(result)) {
        setImageError("The selected image could not be loaded safely.");
        return;
      }
      setBlocks((current) => current.map((block) => block.id === blockId ? { ...block, imageDataUrl: result } : block));
      setImageError(null);
    };
    reader.onerror = () => setImageError("The selected image could not be read.");
    reader.readAsDataURL(file);
  };

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(htmlSource);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const selectedIndex = blocks.findIndex((block) => block.id === selectedId);

  return (
    <div className="html-editor-page">
      <button className="btn btn-outline" onClick={onBack}>← Back to Tools</button>

      <div className="page-header html-editor-header">
        <div>
          <h1>HTML Editor</h1>
          <p>Build a simple HTML page from reusable blocks.</p>
        </div>
        <button className="btn btn-primary" onClick={copyHtml}>{copied ? "Copied" : "Copy HTML"}</button>
      </div>

      <div className="html-editor-workspace">
        <aside className="html-editor-panel html-editor-library">
          <h2>Block Library</h2>
          {(Object.keys(blockLabels) as BlockType[]).map((type) => (
            <button key={type} type="button" onClick={() => addBlock(type)}>
              <span>＋</span>{blockLabels[type]}
            </button>
          ))}
          <div className="html-editor-template-section">
            <h3>Templates</h3>
            {(Object.keys(templateLabels) as TemplateName[]).map((template) => (
              <button key={template} type="button" onClick={() => applyTemplate(template)}>
                {templateLabels[template]}
              </button>
            ))}
          </div>
        </aside>

        <section className="html-editor-panel html-editor-canvas-panel">
          <div className="html-editor-canvas-toolbar">
            <div className="html-editor-panel-title">
              <h2>Live Page Canvas</h2>
              <span>{blocks.length} blocks</span>
            </div>
            <div className="html-editor-viewport-switch" role="group" aria-label="Page width">
              {(Object.keys(canvasViewportWidths) as CanvasViewport[]).map((viewport) => (
                <button
                  key={viewport}
                  type="button"
                  className={canvasViewport === viewport ? "active" : ""}
                  aria-pressed={canvasViewport === viewport}
                  onClick={() => setCanvasViewport(viewport)}
                >
                  {viewport[0].toUpperCase() + viewport.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="html-editor-canvas">
            <div
              className="html-editor-page-frame"
              style={{ maxWidth: canvasViewportWidths[canvasViewport] }}
            >
              {blocks.length === 0 && (
                <div className="html-editor-empty html-editor-canvas-empty">
                  <strong>Start by adding a block or applying a template.</strong>
                  <span>Use Block Library or Templates to build this page.</span>
                </div>
              )}
              {blocks.map((block) => (
                <button
                  key={block.id}
                  type="button"
                className={`html-editor-canvas-block ${selectedId === block.id ? "selected" : ""}`}
                onClick={() => selectBlock(block.id)}
                title={block.type === "button" ? "Click to select this button block" : `Click to select ${blockLabels[block.type]}`}
              >
                  {selectedId === block.id && <span className="html-editor-block-label">{blockLabels[block.type]}</span>}
                  <CanvasBlock block={block} />
                  {block.type === "button" && <span className="html-editor-selection-hint">Click to select block</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="html-editor-panel html-editor-properties">
          <h2>Properties Panel</h2>
          {!selectedBlock && <div className="html-editor-empty">Select a block to edit.</div>}
          {selectedBlock && (
            <>
              <div className="html-editor-selected-type">{blockLabels[selectedBlock.type]}</div>
              {selectedBlock.type === "button" && (
                <p className="html-editor-help">
                  Button action is preview-only in this MVP. Generated HTML uses href=&quot;#&quot;.
                </p>
              )}
              {selectedBlock.type !== "divider" && (
                <label>
                  {selectedBlock.type === "image" ? "Alt text" : "Text"}
                  <textarea value={selectedBlock.text} onChange={(event) => updateSelected({ text: event.target.value })} rows={4} />
                </label>
              )}
              {selectedBlock.type === "image" && (
                <div className="html-editor-image-settings">
                  <label>
                    Image file
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        selectImage(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <div className="html-editor-image-limit">PNG, JPEG, GIF, WebP, or BMP. Maximum 3MB.</div>
                  {imageError && <div className="html-editor-image-error">{imageError}</div>}
                </div>
              )}
              <label>
                Align
                <select value={selectedBlock.style.align} onChange={(event) => updateStyle("align", event.target.value as TextAlign)}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label>
                Background
                <input type="color" value={selectedBlock.style.backgroundColor} onChange={(event) => updateStyle("backgroundColor", event.target.value)} />
              </label>
              <label>
                Text color
                <input type="color" value={selectedBlock.style.textColor} onChange={(event) => updateStyle("textColor", event.target.value)} />
              </label>
              <label>
                Padding
                <input type="number" min="0" max="64" value={selectedBlock.style.padding} onChange={(event) => updateStyle("padding", Math.min(64, Math.max(0, Number(event.target.value))))} />
              </label>
              <div className="html-editor-actions">
                <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex <= 0}>Move Up</button>
                <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex < 0 || selectedIndex >= blocks.length - 1}>Move Down</button>
                <button type="button" onClick={duplicateSelected}>Duplicate</button>
                <button type="button" className="danger" onClick={deleteSelected}>Delete</button>
              </div>
            </>
          )}
        </aside>
      </div>

      <details className="html-editor-panel html-editor-source-section">
        <summary>HTML Source</summary>
        <div className="html-editor-source-content">
          <p>Generated HTML for the current page.</p>
          <textarea value={htmlSource} readOnly spellCheck={false} />
        </div>
      </details>
    </div>
  );
}
