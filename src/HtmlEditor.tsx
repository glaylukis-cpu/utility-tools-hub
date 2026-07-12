import { useEffect, useRef, useState } from "react";
import "./HtmlEditor.css";

type BlockType = "heading" | "paragraph" | "button" | "divider" | "table" | "card";
type TextAlign = "left" | "center" | "right";

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
}

const blockLabels: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  button: "Button",
  divider: "Divider",
  table: "Table",
  card: "Card",
};

const defaultText: Record<BlockType, string> = {
  heading: "Your heading",
  paragraph: "Write a paragraph here.",
  button: "Call to action",
  divider: "",
  table: "Name | Value\nExample | 100",
  card: "Card title",
};

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

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;

  useEffect(() => {
    setHtmlSource(generateHtml(blocks));
    setCopied(false);
  }, [blocks]);

  const addBlock = (type: BlockType) => {
    const block: EditorBlock = {
      id: nextId.current++,
      type,
      text: defaultText[type],
      style: createStyle(type),
    };
    setBlocks((current) => [...current, block]);
    setSelectedId(block.id);
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
        </aside>

        <section className="html-editor-panel html-editor-canvas-panel">
          <div className="html-editor-panel-title">
            <h2>Editor Canvas</h2>
            <span>{blocks.length} blocks</span>
          </div>
          <div className="html-editor-canvas">
            {blocks.length === 0 && <div className="html-editor-empty">Add a block from the library.</div>}
            {blocks.map((block) => (
              <button
                key={block.id}
                type="button"
                className={`html-editor-canvas-block ${selectedId === block.id ? "selected" : ""}`}
                onClick={() => setSelectedId(block.id)}
                title={block.type === "button" ? "Click to select this button block" : `Click to select ${blockLabels[block.type]}`}
              >
                <span className="html-editor-block-label">{blockLabels[block.type]}</span>
                <CanvasBlock block={block} />
                {block.type === "button" && <span className="html-editor-selection-hint">Click to select block</span>}
              </button>
            ))}
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
                  Text
                  <textarea value={selectedBlock.text} onChange={(event) => updateSelected({ text: event.target.value })} rows={4} />
                </label>
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

      <section className="html-editor-output-grid">
        <div className="html-editor-panel">
          <div className="html-editor-panel-title"><h2>HTML Preview</h2></div>
          <iframe title="HTML Editor Preview" srcDoc={htmlSource} sandbox="" />
        </div>
        <div className="html-editor-panel">
          <div className="html-editor-panel-title"><h2>HTML Source</h2></div>
          <textarea value={htmlSource} readOnly spellCheck={false} />
        </div>
      </section>
    </div>
  );
}
