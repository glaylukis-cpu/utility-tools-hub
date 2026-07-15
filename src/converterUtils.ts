function parseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("JSON could not be parsed. Check commas, quotes, and brackets.");
  }
}

export function formatJson(input: string): string {
  return JSON.stringify(parseJson(input), null, 2);
}

export function minifyJson(input: string): string {
  return JSON.stringify(parseJson(input));
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const finishField = () => {
    row.push(field);
    field = "";
  };

  const finishRow = () => {
    finishField();
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error("CSV contains an unexpected quote.");
      }
      inQuotes = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      finishRow();
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quoted value.");
  }

  if (field.length > 0 || row.length > 0) {
    finishRow();
  }

  return rows;
}

export function csvToJson(input: string): string {
  const rows = parseCsvRows(input);
  if (rows.length < 2) {
    throw new Error("CSV needs a header row and at least one data row.");
  }

  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => header === "")) {
    throw new Error("CSV header names cannot be empty.");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV header names must be unique.");
  }

  const records = rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${rowIndex + 2} has ${values.length} values; expected ${headers.length}.`,
      );
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });

  return JSON.stringify(records, null, 2);
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function jsonToCsv(input: string): string {
  const parsed = parseJson(input);
  if (!Array.isArray(parsed)) {
    throw new Error("JSON to CSV requires an array of objects.");
  }
  if (parsed.length === 0) {
    throw new Error("JSON array must contain at least one object.");
  }
  if (
    parsed.some(
      (value) => value === null || Array.isArray(value) || typeof value !== "object",
    )
  ) {
    throw new Error("Every JSON array item must be an object.");
  }

  const records = parsed as Record<string, unknown>[];
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  if (headers.length === 0) {
    throw new Error("JSON objects must contain at least one key.");
  }

  const lines = [
    headers.map(csvValue).join(","),
    ...records.map((record) => headers.map((header) => csvValue(record[header])).join(",")),
  ];
  return lines.join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInlineMarkdown(value: string): string {
  let output = "";
  let index = 0;

  while (index < value.length) {
    const marker = value[index];

    if (marker === "`") {
      const end = value.indexOf("`", index + 1);
      if (end !== -1) {
        output += `<code>${escapeHtml(value.slice(index + 1, end))}</code>`;
        index = end + 1;
        continue;
      }
    }

    if (value.startsWith("**", index)) {
      const end = value.indexOf("**", index + 2);
      if (end !== -1) {
        output += `<strong>${escapeHtml(value.slice(index + 2, end))}</strong>`;
        index = end + 2;
        continue;
      }
    }

    if (marker === "*") {
      const end = value.indexOf("*", index + 1);
      if (end !== -1) {
        output += `<em>${escapeHtml(value.slice(index + 1, end))}</em>`;
        index = end + 1;
        continue;
      }
    }

    output += escapeHtml(marker);
    index += 1;
  }

  return output;
}

export function markdownToHtml(input: string): string {
  const output: string[] = [];
  const paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      output.push(`<p>${paragraphLines.map(formatInlineMarkdown).join("<br>")}</p>`);
      paragraphLines.length = 0;
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      output.push(`<ul>\n${listItems.map((item) => `  <li>${item}</li>`).join("\n")}\n</ul>`);
      listItems = [];
    }
  };

  for (const line of input.replace(/\r\n?/g, "\n").split("\n")) {
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      output.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = /^\s*-\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      listItems.push(formatInlineMarkdown(listItem[1]));
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return output.join("\n");
}

export function encodeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function decodeBase64(input: string): string {
  const compact = input.replace(/\s/g, "");
  if (
    compact.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(compact) ||
    /=/.test(compact.slice(0, -2))
  ) {
    throw new Error("Input is not valid Base64 text.");
  }

  try {
    const binary = atob(compact);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Base64 could not be decoded as UTF-8 text.");
  }
}

export function encodeUrl(input: string): string {
  return encodeURIComponent(input);
}

export function decodeUrl(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    throw new Error("Input contains invalid URL encoding.");
  }
}
