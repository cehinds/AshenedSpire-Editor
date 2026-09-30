export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const spreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationshipNamespace = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const encoder = new TextEncoder();
const limits = { rows: 1048576, columns: 16384, text: 32767 };

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function spreadsheetText(value) {
  const text = String(value);
  if (text.length > limits.text) throw new Error("Excel cells support at most 32767 text characters");
  // Literal OOXML escapes must not be decoded as control characters by Excel.
  const literalSafe = text.replace(/_(?=x[0-9a-f]{4}_)/gi, "_x005F_");
  let encoded = "";
  for (const character of literalSafe) {
    const point = character.codePointAt(0);
    if (point < 32 && point !== 9 && point !== 10 || point >= 0xd800 && point <= 0xdfff || point === 0xfffe || point === 0xffff) {
      encoded += `_x${point.toString(16).toUpperCase().padStart(4, "0")}_`;
    } else encoded += character;
  }
  return escapeXml(encoded);
}

function textValue(value) {
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : "Invalid Date";
  if (typeof value === "object") return JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item);
  if (["function", "symbol"].includes(typeof value)) throw new TypeError("Unsupported Excel cell value");
  return String(value);
}

function columnName(index) {
  let result = "";
  for (let number = index + 1; number; number = Math.floor((number - 1) / 26)) {
    result = String.fromCharCode(65 + (number - 1) % 26) + result;
  }
  return result;
}

function cellXml(value, reference, header) {
  const style = header ? ' s="1"' : "";
  if (value === null || value === undefined) return `<c r="${reference}"${style}/>`;
  if (typeof value === "boolean") return `<c r="${reference}"${style} t="b"><v>${value ? 1 : 0}</v></c>`;
  // Excel numbers have 15 significant digits; long integer identifiers stay exact as text.
  if (typeof value === "number" && Number.isFinite(value) && !(Number.isInteger(value) && Math.abs(value) >= 1e15)) {
    return `<c r="${reference}"${style} t="n"><v>${value}</v></c>`;
  }
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${spreadsheetText(textValue(value))}</t></is></c>`;
}

function truncateName(value, maximum = 31) {
  return value.slice(0, maximum).replace(/[\uD800-\uDBFF]$/, "");
}

function sheetName(value, index, used) {
  let base = String(value ?? "").replace(/[\\/?*:\[\]\u0000-\u001f\u007f]/g, " ").trim().replace(/^'+|'+$/g, "").trim();
  if (!base) base = `Sheet ${index + 1}`;
  if (base.toLowerCase() === "history") base = "History sheet";
  base = truncateName(base);
  let result = base;
  for (let number = 2; used.has(result.toLowerCase()); number += 1) {
    const suffix = ` (${number})`;
    result = truncateName(base, 31 - suffix.length) + suffix;
  }
  used.add(result.toLowerCase());
  return result;
}

function worksheetXml(sheet) {
  if (!Array.isArray(sheet.rows)) throw new TypeError("Excel worksheet rows must be an array");
  if (sheet.rows.length > limits.rows) throw new Error("Excel worksheet exceeds 1048576 rows");
  let columns = 0;
  for (const row of sheet.rows) {
    if (!Array.isArray(row)) throw new TypeError("Each Excel worksheet row must be an array");
    if (row.length > limits.columns) throw new Error("Excel worksheet exceeds 16384 columns");
    columns = Math.max(columns, row.length);
  }
  const lastCell = `${columnName(Math.max(columns - 1, 0))}${Math.max(sheet.rows.length, 1)}`;
  const hasHeader = Boolean(sheet.header && sheet.rows.length && columns);
  const pane = hasHeader ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' : "";
  const widths = Array.from({ length: columns }, (_, index) => {
    const width = Math.min(60, Math.max(12, ...sheet.rows.slice(0, 200).map((row) => textValue(row[index] ?? "").length + 2)));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const rows = sheet.rows.map((row, index) => `<row r="${index + 1}"${hasHeader && index === 0 ? ' ht="24" customHeight="1"' : ""}>${Array.from(row, (value, column) => cellXml(value, `${columnName(column)}${index + 1}`, hasHeader && index === 0)).join("")}</row>`).join("");
  return `${xmlDeclaration}<worksheet xmlns="${spreadsheetNamespace}"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${columns ? `<cols>${widths}</cols>` : ""}<sheetData>${rows}</sheetData>${hasHeader ? `<autoFilter ref="A1:${lastCell}"/>` : ""}</worksheet>`;
}

const stylesXml = `${xmlDeclaration}<styleSheet xmlns="${spreadsheetNamespace}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF26313A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8;
  return (value ^ 0xffffffff) >>> 0;
}

function zipStored(parts) {
  const files = parts.map(([name, text]) => ({ name: encoder.encode(name), data: encoder.encode(text) }));
  if (files.length > 65535) throw new Error("Excel package requires unsupported ZIP64 entry count");
  const localSize = files.reduce((sum, file) => sum + 30 + file.name.length + file.data.length, 0);
  const directorySize = files.reduce((sum, file) => sum + 46 + file.name.length, 0);
  if (localSize + directorySize + 22 >= 0xffffffff) throw new Error("Excel package exceeds supported ZIP size");
  const bytes = new Uint8Array(localSize + directorySize + 22);
  const view = new DataView(bytes.buffer);
  let localOffset = 0;
  let directoryOffset = localSize;
  for (const file of files) {
    const crc = crc32(file.data);
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 20, true);
    view.setUint16(localOffset + 6, 0x800, true);
    view.setUint16(localOffset + 12, 33, true); // Fixed 1980-01-01 DOS date makes exports deterministic.
    view.setUint32(localOffset + 14, crc, true);
    view.setUint32(localOffset + 18, file.data.length, true);
    view.setUint32(localOffset + 22, file.data.length, true);
    view.setUint16(localOffset + 26, file.name.length, true);
    bytes.set(file.name, localOffset + 30);
    bytes.set(file.data, localOffset + 30 + file.name.length);
    view.setUint32(directoryOffset, 0x02014b50, true);
    view.setUint16(directoryOffset + 4, 20, true);
    view.setUint16(directoryOffset + 6, 20, true);
    view.setUint16(directoryOffset + 8, 0x800, true);
    view.setUint16(directoryOffset + 14, 33, true);
    view.setUint32(directoryOffset + 16, crc, true);
    view.setUint32(directoryOffset + 20, file.data.length, true);
    view.setUint32(directoryOffset + 24, file.data.length, true);
    view.setUint16(directoryOffset + 28, file.name.length, true);
    view.setUint32(directoryOffset + 42, localOffset, true);
    bytes.set(file.name, directoryOffset + 46);
    localOffset += 30 + file.name.length + file.data.length;
    directoryOffset += 46 + file.name.length;
  }
  view.setUint32(directoryOffset, 0x06054b50, true);
  view.setUint16(directoryOffset + 8, files.length, true);
  view.setUint16(directoryOffset + 10, files.length, true);
  view.setUint32(directoryOffset + 12, directorySize, true);
  view.setUint32(directoryOffset + 16, localSize, true);
  return bytes;
}

export function recordsToSheet(name, records, columns) {
  if (!Array.isArray(records) || records.some((record) => !record || typeof record !== "object" || Array.isArray(record))) {
    throw new TypeError("Excel records must be an array of objects");
  }
  const fields = columns ?? [...new Set(records.flatMap((record) => Object.keys(record)))];
  if (!Array.isArray(fields)) throw new TypeError("Excel columns must be an array");
  const descriptors = fields.map((field) => typeof field === "string" ? { key: field, label: field } : field);
  if (descriptors.some((field) => !field || typeof field.key !== "string")) throw new TypeError("Excel columns require string keys");
  return {
    name,
    header: true,
    rows: [descriptors.map((field) => field.label ?? field.key), ...records.map((record) => descriptors.map((field) => Object.hasOwn(record, field.key) ? record[field.key] : null))],
  };
}

export function createXlsxWorkbook(sheets) {
  if (!Array.isArray(sheets) || !sheets.length) throw new Error("Excel workbook requires at least one worksheet");
  const used = new Set();
  const normalized = sheets.map((sheet, index) => {
    if (!sheet || typeof sheet !== "object") throw new TypeError("Invalid Excel worksheet");
    return { ...sheet, name: sheetName(sheet.name, index, used) };
  });
  const workbook = `${xmlDeclaration}<workbook xmlns="${spreadsheetNamespace}" xmlns:r="${relationshipNamespace}"><bookViews><workbookView/></bookViews><sheets>${normalized.map((sheet, index) => `<sheet name="${spreadsheetText(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`;
  const relationships = `${xmlDeclaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${normalized.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${relationshipNamespace}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rIdStyles" Type="${relationshipNamespace}/styles" Target="styles.xml"/></Relationships>`;
  const contentTypes = `${xmlDeclaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${normalized.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  return zipStored([
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", `${xmlDeclaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relationshipNamespace}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", workbook],
    ["xl/_rels/workbook.xml.rels", relationships],
    ["xl/styles.xml", stylesXml],
    ...normalized.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet)]),
  ]);
}

export function downloadXlsx(filename, sheets) {
  const bytes = createXlsxWorkbook(sheets);
  const blob = new Blob([bytes], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = /\.xlsx$/i.test(filename) ? filename : `${filename}.xlsx`;
  document.body.append(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
