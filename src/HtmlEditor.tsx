import { useEffect, useRef, useState } from "react";
import "./HtmlEditor.css";

type BlockType = "heading" | "paragraph" | "button" | "divider" | "table" | "card" | "image" | "search" | "navigation";
type TextAlign = "left" | "center" | "right";
type TemplateName = "landing" | "article" | "product";
type CanvasViewport = "desktop" | "tablet" | "mobile";
type BlockWidth = "full" | "half" | "third";
type FontWeight = "normal" | "500" | "700";
type LinkType = "none" | "page" | "custom";
type NavigationLayout = "horizontal" | "vertical";
type ImageWidth = "auto" | "25%" | "50%" | "75%" | "100%";
type ImageObjectFit = "contain" | "cover";

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
  width: BlockWidth;
  fontSize: number;
  fontWeight: FontWeight;
  underline: boolean;
}

interface EditorBlock {
  id: number;
  type: BlockType;
  text: string;
  style: BlockStyle;
  imageDataUrl?: string;
  imageWidth?: ImageWidth;
  imageMaxWidth?: number;
  imageBorderRadius?: number;
  imageObjectFit?: ImageObjectFit;
  imageCaption?: string;
  imageCaptionAlign?: TextAlign;
  searchButtonText?: string;
  navigationLayout?: NavigationLayout;
  navigationShowCurrent?: boolean;
  navigationGap?: number;
  link: {
    type: LinkType;
    pageId: number | null;
    customUrl: string;
  };
}

interface EditorPage {
  id: number;
  title: string;
  slug: string;
  blocks: EditorBlock[];
}

const blockLabels: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  button: "Button",
  divider: "Divider",
  table: "Table",
  card: "Card",
  image: "Image",
  search: "Search bar",
  navigation: "Navigation",
};

const defaultText: Record<BlockType, string> = {
  heading: "Your heading",
  paragraph: "Write a paragraph here.",
  button: "Call to action",
  divider: "",
  table: "Name | Value\nExample | 100",
  card: "Card title",
  image: "Image description",
  search: "Search this site",
  navigation: "",
};

const templateLabels: Record<TemplateName, string> = {
  landing: "Landing Page",
  article: "Simple Article",
  product: "Product Card",
};

const templates: Record<TemplateName, Array<{ type: BlockType; text: string; width?: BlockWidth }>> = {
  landing: [
    { type: "navigation", text: "" },
    { type: "heading", text: "Build something remarkable" },
    { type: "paragraph", text: "Introduce your product with a clear, focused message." },
    { type: "button", text: "Get started" },
    { type: "card", text: "Why choose us" },
  ],
  article: [
    { type: "navigation", text: "" },
    { type: "heading", text: "Article title" },
    { type: "paragraph", text: "Write an engaging introduction for your article." },
    { type: "divider", text: "" },
    { type: "paragraph", text: "Continue the story with supporting details." },
  ],
  product: [
    { type: "navigation", text: "" },
    { type: "heading", text: "Product name" },
    { type: "paragraph", text: "Describe the key benefit of this product." },
    { type: "image", text: "Product image", width: "half" },
    { type: "button", text: "View product", width: "half" },
  ],
};

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const EMPTY_IMAGE_DATA_URL = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"]);

function isSafeImageDataUrl(value: string | undefined): value is string {
  return typeof value === "string" && /^data:image\/(?:png|jpeg|gif|webp|bmp);base64,[a-z0-9+/=]+$/i.test(value);
}

const linkableBlockTypes = new Set<BlockType>(["heading", "paragraph", "button", "card", "image"]);

function createLink(): EditorBlock["link"] {
  return { type: "none", pageId: null, customUrl: "" };
}

function slugFromTitle(title: string, fallbackId: number): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return slug || `page-${fallbackId}`;
}

function uniqueSlug(title: string, pages: EditorPage[], fallbackId: number, excludePageId?: number): string {
  const base = slugFromTitle(title, fallbackId);
  let candidate = base;
  let suffix = 2;
  while (pages.some((page) => page.id !== excludePageId && page.slug === candidate)) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

function safeCustomUrl(value: string): string {
  const url = value.trim();
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url) || url.startsWith("#")) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return "#";
}

function resolveLinkHref(block: EditorBlock, pages: EditorPage[]): string | null {
  if (block.link.type === "page") {
    const target = pages.find((page) => page.id === block.link.pageId);
    return target ? `${target.slug}.html` : "#";
  }
  if (block.link.type === "custom") return safeCustomUrl(block.link.customUrl);
  return null;
}

function createStyle(type: BlockType): BlockStyle {
  return {
    align: "left",
    backgroundColor: type === "card" ? "#f8fafc" : "#ffffff",
    textColor: "#1e293b",
    padding: type === "divider" ? 8 : 16,
    width: "full",
    fontSize: type === "heading" ? 24 : 16,
    fontWeight: type === "heading" ? "700" : "normal",
    underline: false,
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
    `font-size:${style.fontSize}px`,
    `font-weight:${style.fontWeight}`,
    `text-decoration:${style.underline ? "underline" : "none"}`,
    "white-space:pre-wrap",
    "box-sizing:border-box",
  ].join(";");
}

function blockWidthToHtml(width: BlockWidth): string {
  const basis = width === "half"
    ? "calc((100% - 16px) / 2)"
    : width === "third"
      ? "calc((100% - 32px) / 3)"
      : "100%";
  return `flex:0 0 ${basis};max-width:${basis};min-width:0;box-sizing:border-box`;
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

function blockToHtml(block: EditorBlock, pages: EditorPage[], currentPageId: number): string {
  const style = styleToHtml(block.style);
  const text = escapeHtml(block.text);
  const href = resolveLinkHref(block, pages);
  let content: string;

  switch (block.type) {
    case "heading":
      content = `<h2 style="${style};margin:0">${text}</h2>`;
      break;
    case "paragraph":
      content = `<p style="${style};margin:0;line-height:1.6">${text}</p>`;
      break;
    case "button":
      content = `<div style="${style}"><a href="${escapeHtml(href ?? "#")}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#2563eb;color:#ffffff;text-decoration:${block.style.underline ? "underline" : "none"}">${text}</a></div>`;
      break;
    case "divider":
      content = `<div style="${style}"><hr style="border:0;border-top:1px solid #cbd5e1;margin:0"></div>`;
      break;
    case "table":
      content = tableHtml(block);
      break;
    case "card":
      content = `<section style="${style};border:1px solid #e2e8f0;border-radius:10px"><h3 style="margin:0 0 8px">${text}</h3><p style="margin:0;opacity:.75">Card content</p></section>`;
      break;
    case "image": {
      const source = isSafeImageDataUrl(block.imageDataUrl) ? block.imageDataUrl : EMPTY_IMAGE_DATA_URL;
      const imageWidth = block.imageWidth ?? "100%";
      const imageMaxWidth = Math.max(1, block.imageMaxWidth ?? 640);
      const imageBorderRadius = Math.max(0, block.imageBorderRadius ?? 8);
      const imageObjectFit = block.imageObjectFit ?? "contain";
      const caption = block.imageCaption?.trim()
        ? `<figcaption style="margin-top:8px;text-align:${block.imageCaptionAlign ?? "center"}">${escapeHtml(block.imageCaption)}</figcaption>`
        : "";
      content = `<figure style="${style};margin:0"><img src="${source}" alt="${text}" style="display:block;width:${imageWidth};max-width:min(100%, ${imageMaxWidth}px);height:auto;margin:0 auto;background:#e2e8f0;min-height:120px;border-radius:${imageBorderRadius}px;object-fit:${imageObjectFit}">${caption}</figure>`;
      break;
    }
    case "search":
      content = `<form action="#" method="get" role="search" style="${style};display:flex;gap:8px"><input type="search" name="q" placeholder="${text}" style="box-sizing:border-box;min-width:0;flex:1;padding:10px;border:1px solid #cbd5e1;border-radius:6px"><button type="submit" style="padding:10px 16px;border:0;border-radius:6px;background:#2563eb;color:#ffffff">${escapeHtml(block.searchButtonText ?? "Search")}</button></form>`;
      break;
    case "navigation": {
      const layout = block.navigationLayout ?? "horizontal";
      const gap = Math.max(0, block.navigationGap ?? 16);
      const flexAlign = block.style.align === "center" ? "center" : block.style.align === "right" ? "flex-end" : "flex-start";
      const layoutStyle = layout === "horizontal"
        ? `flex-direction:row;justify-content:${flexAlign};align-items:center`
        : `flex-direction:column;align-items:${flexAlign}`;
      const links = pages.map((page) => {
        const isCurrent = block.navigationShowCurrent !== false && page.id === currentPageId;
        const emphasis = isCurrent ? "font-weight:700;border-bottom:2px solid currentColor" : "";
        return `<a href="${escapeHtml(`${page.slug}.html`)}" style="color:inherit;text-decoration:${block.style.underline ? "underline" : "none"};${emphasis}">${escapeHtml(page.title || "Untitled Page")}</a>`;
      }).join("");
      content = `<nav aria-label="Page navigation" style="${style};display:flex;flex-wrap:wrap;gap:${gap}px;${layoutStyle}">${links}</nav>`;
      break;
    }
  }

  if (href && block.type !== "button" && linkableBlockTypes.has(block.type)) {
    return `<a href="${escapeHtml(href)}" style="display:block;color:inherit;text-decoration:inherit">${content}</a>`;
  }
  return content;
}

function generateHtml(blocks: EditorBlock[], pages: EditorPage[], pageTitle: string, currentPageId: number): string {
  const content = blocks
    .map((block) => `<div data-block-width="${block.style.width}" style="${blockWidthToHtml(block.style.width)}">${blockToHtml(block, pages, currentPageId)}</div>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    @media (max-width: 480px) {
      [data-block-width] { flex-basis: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#ffffff">
<main style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
${content}
</main>
</body>
</html>`;
}

function CanvasBlock({ block, pages, currentPageId }: { block: EditorBlock; pages: EditorPage[]; currentPageId: number }) {
  const style = {
    textAlign: block.style.align,
    backgroundColor: block.style.backgroundColor,
    color: block.style.textColor,
    padding: block.style.padding,
    fontSize: block.style.fontSize,
    fontWeight: block.style.fontWeight,
    textDecoration: block.style.underline ? "underline" : "none",
    whiteSpace: "pre-wrap",
  } as const;

  switch (block.type) {
    case "heading":
      return <h2 style={{ ...style, margin: 0 }}>{block.text}</h2>;
    case "paragraph":
      return <p style={{ ...style, margin: 0, lineHeight: 1.6 }}>{block.text}</p>;
    case "button":
      return <div style={style}><span className="html-editor-button-preview">{block.text}</span></div>;
    case "divider":
      return <div style={style}><hr className="html-editor-divider-preview" /></div>;
    case "table": {
      const rows = block.text
        .split(/\r?\n/)
        .filter((row) => row.trim())
        .map((row) => row.split("|").map((cell) => cell.trim()));

      return (
        <table style={{ ...style, width: "100%", borderCollapse: "collapse" }} className="html-editor-table-preview">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${block.id}-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => rowIndex === 0
                  ? <th key={`${block.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</th>
                  : <td key={`${block.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "card":
      return <section style={style} className="html-editor-card-preview"><h3>{block.text}</h3><p>Card content</p></section>;
    case "image": {
      const imageStyle = {
        width: block.imageWidth ?? "100%",
        maxWidth: `min(100%, ${Math.max(1, block.imageMaxWidth ?? 640)}px)`,
        borderRadius: Math.max(0, block.imageBorderRadius ?? 8),
        objectFit: block.imageObjectFit ?? "contain",
      } as const;
      return (
        <figure style={{ ...style, margin: 0 }} className="html-editor-image-preview">
          {isSafeImageDataUrl(block.imageDataUrl)
            ? <img src={block.imageDataUrl} alt={block.text} style={imageStyle} />
            : <div className="html-editor-image-placeholder" style={imageStyle}>No image selected</div>}
          {block.imageCaption && <figcaption style={{ textAlign: block.imageCaptionAlign ?? "center" }}>{block.imageCaption}</figcaption>}
        </figure>
      );
    }
    case "search":
      return (
        <form style={style} className="html-editor-search-preview" onSubmit={(event) => event.preventDefault()}>
          <input type="search" placeholder={block.text} readOnly tabIndex={-1} />
          <button type="button" tabIndex={-1}>{block.searchButtonText ?? "Search"}</button>
        </form>
      );
    case "navigation": {
      const layout = block.navigationLayout ?? "horizontal";
      const flexAlign = block.style.align === "center" ? "center" : block.style.align === "right" ? "flex-end" : "flex-start";
      return (
        <nav
          aria-label="Page navigation preview"
          className={`html-editor-navigation-preview is-${layout}`}
          style={{
            ...style,
            gap: Math.max(0, block.navigationGap ?? 16),
            justifyContent: layout === "horizontal" ? flexAlign : undefined,
            alignItems: layout === "vertical" ? flexAlign : "center",
          }}
        >
          {pages.map((page) => (
            <span
              key={page.id}
              className={block.navigationShowCurrent !== false && page.id === currentPageId ? "is-current" : ""}
            >
              {page.title || "Untitled Page"}
            </span>
          ))}
        </nav>
      );
    }
  }
}

export default function HtmlEditorPage({ onBack }: { onBack: () => void }) {
  const nextId = useRef(3);
  const nextPageId = useRef(2);
  const [pages, setPages] = useState<EditorPage[]>([
    {
      id: 1,
      title: "Home",
      slug: "index",
      blocks: [
        { id: 1, type: "heading", text: "Welcome", style: createStyle("heading"), link: createLink() },
        { id: 2, type: "paragraph", text: "Start building your HTML page with blocks.", style: createStyle("paragraph"), link: createLink() },
      ],
    },
  ]);
  const [currentPageId, setCurrentPageId] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [canvasViewport, setCanvasViewport] = useState<CanvasViewport>("desktop");

  const currentPage = pages.find((page) => page.id === currentPageId) ?? pages[0];
  const blocks = currentPage?.blocks ?? [];
  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;
  const htmlSource = generateHtml(blocks, pages, currentPage?.title ?? "Untitled Page", currentPageId);

  useEffect(() => {
    setCopied(false);
  }, [pages, currentPageId]);

  const updateCurrentBlocks = (update: (current: EditorBlock[]) => EditorBlock[]) => {
    setPages((current) => current.map((page) => page.id === currentPageId
      ? { ...page, blocks: update(page.blocks) }
      : page));
  };

  const createBlock = (type: BlockType, text = defaultText[type], width: BlockWidth = "full"): EditorBlock => ({
      id: nextId.current++,
      type,
      text,
      style: { ...createStyle(type), width },
      imageWidth: type === "image" ? "100%" : undefined,
      imageMaxWidth: type === "image" ? 640 : undefined,
      imageBorderRadius: type === "image" ? 8 : undefined,
      imageObjectFit: type === "image" ? "contain" : undefined,
      imageCaption: type === "image" ? "" : undefined,
      imageCaptionAlign: type === "image" ? "center" : undefined,
      searchButtonText: type === "search" ? "Search" : undefined,
      navigationLayout: type === "navigation" ? "horizontal" : undefined,
      navigationShowCurrent: type === "navigation" ? true : undefined,
      navigationGap: type === "navigation" ? 16 : undefined,
      link: createLink(),
    });

  const addBlock = (type: BlockType) => {
    const block = createBlock(type);
    updateCurrentBlocks((current) => [...current, block]);
    setSelectedId(block.id);
    setImageError(null);
  };

  const applyTemplate = (template: TemplateName) => {
    if (blocks.length > 0 && !window.confirm("Replace the current blocks with this template?")) return;
    const nextBlocks = templates[template].map((block) => createBlock(block.type, block.text, block.width));
    updateCurrentBlocks(() => nextBlocks);
    setSelectedId(nextBlocks[0]?.id ?? null);
    setImageError(null);
  };

  const updateSelected = (update: Partial<Pick<EditorBlock, "text" | "style" | "imageWidth" | "imageMaxWidth" | "imageBorderRadius" | "imageObjectFit" | "imageCaption" | "imageCaptionAlign" | "searchButtonText" | "navigationLayout" | "navigationShowCurrent" | "navigationGap" | "link">>) => {
    if (selectedId === null) return;
    updateCurrentBlocks((current) => current.map((block) => block.id === selectedId ? { ...block, ...update } : block));
  };

  const updateStyle = <K extends keyof BlockStyle>(key: K, value: BlockStyle[K]) => {
    if (!selectedBlock) return;
    updateSelected({ style: { ...selectedBlock.style, [key]: value } });
  };

  const deleteSelected = () => {
    if (selectedId === null) return;
    updateCurrentBlocks((current) => current.filter((block) => block.id !== selectedId));
    setSelectedId(null);
  };

  const moveSelected = (direction: -1 | 1) => {
    if (selectedId === null) return;
    updateCurrentBlocks((current) => {
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
    updateCurrentBlocks((current) => {
      const index = current.findIndex((block) => block.id === selectedBlock.id);
      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
    setSelectedId(duplicate.id);
  };

  const updateLink = (update: Partial<EditorBlock["link"]>) => {
    if (!selectedBlock) return;
    updateSelected({ link: { ...selectedBlock.link, ...update } });
  };

  const switchPage = (page: EditorPage) => {
    setCurrentPageId(page.id);
    setSelectedId(page.blocks[0]?.id ?? null);
    setImageError(null);
  };

  const addPage = () => {
    const id = nextPageId.current++;
    const title = `Page ${id}`;
    const page: EditorPage = { id, title, slug: uniqueSlug(title, pages, id), blocks: [] };
    setPages((current) => [...current, page]);
    switchPage(page);
  };

  const renameCurrentPage = (title: string) => {
    setPages((current) => current.map((page) => page.id === currentPageId
      ? {
          ...page,
          title,
          slug: page.id === 1 && title.trim().toLowerCase() === "home"
            ? "index"
            : uniqueSlug(title, current, page.id, page.id),
        }
      : page));
  };

  const duplicatePage = () => {
    if (!currentPage) return;
    const id = nextPageId.current++;
    const title = `${currentPage.title || "Page"} Copy`;
    const duplicateBlocks = currentPage.blocks.map((block) => ({
      ...block,
      id: nextId.current++,
      style: { ...block.style },
      link: { ...block.link },
    }));
    const page: EditorPage = {
      id,
      title,
      slug: uniqueSlug(title, pages, id),
      blocks: duplicateBlocks,
    };
    setPages((current) => [...current, page]);
    switchPage(page);
  };

  const deletePage = () => {
    if (!currentPage || pages.length <= 1) return;
    const remaining = pages
      .filter((page) => page.id !== currentPage.id)
      .map((page) => ({
        ...page,
        blocks: page.blocks.map((block) => block.link.type === "page" && block.link.pageId === currentPage.id
          ? { ...block, link: createLink() }
          : block),
      }));
    const nextPage = remaining[0];
    setPages(remaining);
    setCurrentPageId(nextPage.id);
    setSelectedId(nextPage.blocks[0]?.id ?? null);
    setImageError(null);
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
      updateCurrentBlocks((current) => current.map((block) => block.id === blockId ? { ...block, imageDataUrl: result } : block));
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
          <div className="html-editor-pages-section">
            <div className="html-editor-pages-heading">
              <h2>Pages</h2>
              <span>{pages.length}</span>
            </div>
            <div className="html-editor-page-list">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={page.id === currentPageId ? "active" : ""}
                  onClick={() => switchPage(page)}
                >
                  <span>{page.title || "Untitled Page"}</span>
                  <code>{page.slug}.html</code>
                </button>
              ))}
            </div>
            <label className="html-editor-page-title-field">
              Rename Page
              <input type="text" value={currentPage?.title ?? ""} onChange={(event) => renameCurrentPage(event.target.value)} />
            </label>
            <div className="html-editor-page-actions">
              <button type="button" onClick={addPage}>Add Page</button>
              <button type="button" onClick={duplicatePage}>Duplicate Page</button>
              <button type="button" onClick={deletePage} disabled={pages.length <= 1}>Delete Page</button>
            </div>
          </div>
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
            <div className="html-editor-canvas-heading">
              <div className="html-editor-panel-title">
                <h2>Live Page Canvas</h2>
                <span>{blocks.length} blocks</span>
              </div>
              <div className="html-editor-current-output">
                <span>{currentPage?.title || "Untitled Page"}</span>
                <code>{currentPage?.slug ?? "page"}.html</code>
              </div>
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
              className={`html-editor-page-frame ${canvasViewport === "mobile" ? "is-mobile" : ""}`}
              style={{ maxWidth: canvasViewportWidths[canvasViewport] }}
            >
              {blocks.length === 0 && (
                <div className="html-editor-empty html-editor-canvas-empty">
                  <strong>Start by adding a block or applying a template.</strong>
                  <span>Use Block Library or Templates to build this page.</span>
                </div>
              )}
              {blocks.map((block) => (
                <div
                  key={block.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${blockLabels[block.type]} block`}
                  className={`html-editor-canvas-block html-editor-block-width-${block.style.width} ${selectedId === block.id ? "selected" : ""}`}
                  onClick={() => selectBlock(block.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectBlock(block.id);
                    }
                  }}
                  title={block.type === "button" ? "Click to select this button block" : `Click to select ${blockLabels[block.type]}`}
                >
                  {selectedId === block.id && <span className="html-editor-block-label">{blockLabels[block.type]}</span>}
                  <CanvasBlock block={block} pages={pages} currentPageId={currentPageId} />
                </div>
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
                  Button action is preview-only in this MVP. Generated HTML uses the selected link or href=&quot;#&quot;.
                </p>
              )}
              {selectedBlock.type === "search" && (
                <p className="html-editor-help">
                  Search bar is visual-only in this MVP. Generated HTML submits to &quot;#&quot; and does not search pages yet.
                </p>
              )}
              {selectedBlock.type === "search" ? (
                <>
                  <label>
                    Placeholder
                    <input type="text" value={selectedBlock.text} onChange={(event) => updateSelected({ text: event.target.value })} />
                  </label>
                  <label>
                    Button text
                    <input type="text" value={selectedBlock.searchButtonText ?? "Search"} onChange={(event) => updateSelected({ searchButtonText: event.target.value })} />
                  </label>
                </>
              ) : selectedBlock.type !== "divider" && selectedBlock.type !== "navigation" && (
                <label>
                  {selectedBlock.type === "image" ? "Alt text" : "Text"}
                  <textarea
                    value={selectedBlock.text}
                    onChange={(event) => updateSelected({ text: event.target.value })}
                    rows={selectedBlock.type === "paragraph" || selectedBlock.type === "card" ? 6 : 4}
                  />
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
                  <label>
                    Image width
                    <select value={selectedBlock.imageWidth ?? "100%"} onChange={(event) => updateSelected({ imageWidth: event.target.value as ImageWidth })}>
                      <option value="auto">Auto</option>
                      <option value="25%">25%</option>
                      <option value="50%">50%</option>
                      <option value="75%">75%</option>
                      <option value="100%">100%</option>
                    </select>
                  </label>
                  <label>
                    Max width
                    <input type="number" min="1" max="2000" value={selectedBlock.imageMaxWidth ?? 640} onChange={(event) => updateSelected({ imageMaxWidth: Math.min(2000, Math.max(1, Number(event.target.value) || 1)) })} />
                  </label>
                  <label>
                    Border radius
                    <input type="number" min="0" max="100" value={selectedBlock.imageBorderRadius ?? 8} onChange={(event) => updateSelected({ imageBorderRadius: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} />
                  </label>
                  <label>
                    Object fit
                    <select value={selectedBlock.imageObjectFit ?? "contain"} onChange={(event) => updateSelected({ imageObjectFit: event.target.value as ImageObjectFit })}>
                      <option value="contain">Contain</option>
                      <option value="cover">Cover</option>
                    </select>
                  </label>
                  <label>
                    Caption
                    <textarea rows={3} value={selectedBlock.imageCaption ?? ""} onChange={(event) => updateSelected({ imageCaption: event.target.value })} />
                  </label>
                  <label>
                    Caption align
                    <select value={selectedBlock.imageCaptionAlign ?? "center"} onChange={(event) => updateSelected({ imageCaptionAlign: event.target.value as TextAlign })}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                </div>
              )}
              {selectedBlock.type === "navigation" && (
                <div className="html-editor-navigation-settings">
                  <p className="html-editor-help">Navigation links update automatically from the Pages list.</p>
                  <label>
                    Layout
                    <select value={selectedBlock.navigationLayout ?? "horizontal"} onChange={(event) => updateSelected({ navigationLayout: event.target.value as NavigationLayout })}>
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical">Vertical</option>
                    </select>
                  </label>
                  <label className="html-editor-checkbox-row">
                    <input type="checkbox" checked={selectedBlock.navigationShowCurrent !== false} onChange={(event) => updateSelected({ navigationShowCurrent: event.target.checked })} />
                    Show current page emphasis
                  </label>
                  <label>
                    Link gap
                    <input type="number" min="0" max="64" value={selectedBlock.navigationGap ?? 16} onChange={(event) => updateSelected({ navigationGap: Math.min(64, Math.max(0, Number(event.target.value) || 0)) })} />
                  </label>
                </div>
              )}
              {linkableBlockTypes.has(selectedBlock.type) && (
                <div className="html-editor-link-settings">
                  <label>
                    Link type
                    <select
                      value={selectedBlock.link.type}
                      onChange={(event) => {
                        const type = event.target.value as LinkType;
                        updateLink({
                          type,
                          pageId: type === "page" ? selectedBlock.link.pageId ?? pages[0]?.id ?? null : selectedBlock.link.pageId,
                        });
                      }}
                    >
                      <option value="none">None</option>
                      <option value="page">Page</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  {selectedBlock.link.type === "page" && (
                    <label>
                      Link page
                      <select value={selectedBlock.link.pageId ?? ""} onChange={(event) => updateLink({ pageId: Number(event.target.value) })}>
                        {pages.map((page) => <option key={page.id} value={page.id}>{page.title || "Untitled Page"} ({page.slug}.html)</option>)}
                      </select>
                    </label>
                  )}
                  {selectedBlock.link.type === "custom" && (
                    <>
                      <label>
                        Custom URL
                        <input type="url" value={selectedBlock.link.customUrl} onChange={(event) => updateLink({ customUrl: event.target.value })} placeholder="https://example.com" />
                      </label>
                      {selectedBlock.link.customUrl && safeCustomUrl(selectedBlock.link.customUrl) === "#" && selectedBlock.link.customUrl.trim() !== "#" && (
                        <p className="html-editor-help">Unsafe URLs are output as href=&quot;#&quot;.</p>
                      )}
                    </>
                  )}
                </div>
              )}
              <label>
                Block width
                <select value={selectedBlock.style.width} onChange={(event) => updateStyle("width", event.target.value as BlockWidth)}>
                  <option value="full">Full</option>
                  <option value="half">Half</option>
                  <option value="third">Third</option>
                </select>
              </label>
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
                Font size
                <input
                  type="number"
                  min="12"
                  max="72"
                  value={selectedBlock.style.fontSize}
                  onChange={(event) => updateStyle("fontSize", Math.min(72, Math.max(12, Number(event.target.value) || 12)))}
                />
              </label>
              <label>
                Font weight
                <select value={selectedBlock.style.fontWeight} onChange={(event) => updateStyle("fontWeight", event.target.value as FontWeight)}>
                  <option value="normal">Normal</option>
                  <option value="500">Medium</option>
                  <option value="700">Bold</option>
                </select>
              </label>
              <label className="html-editor-checkbox-row">
                <input type="checkbox" checked={selectedBlock.style.underline} onChange={(event) => updateStyle("underline", event.target.checked)} />
                Underline
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
