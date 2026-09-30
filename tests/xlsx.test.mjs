import assert from "node:assert/strict";
import test from "node:test";
import { createXlsxWorkbook, downloadXlsx, recordsToSheet, XLSX_MIME } from "../src/xlsx.js";

const decoder = new TextDecoder();
function checksum(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? crc >>> 1 ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50, "real ZIP end directory");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const directoryStart = offset;
  const parts = new Map();
  for (let index = 0; index < count; index += 1) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    assert.equal(view.getUint16(offset + 10, true), 0, "uncompressed ZIP member");
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const local = view.getUint32(offset + 42, true);
    assert.equal(view.getUint32(local, true), 0x04034b50);
    assert.equal(view.getUint16(local + 8, true), 0);
    assert.equal(view.getUint32(local + 22, true), size);
    const localNameLength = view.getUint16(local + 26, true);
    assert.equal(decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)), name);
    const start = local + 30 + localNameLength + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    assert.equal(checksum(data), view.getUint32(offset + 16, true), "central CRC validates file bytes");
    assert.equal(checksum(data), view.getUint32(local + 14, true), "local CRC validates file bytes");
    assert.ok(start + size <= directoryStart);
    parts.set(name, decoder.decode(data));
    offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  assert.equal(offset, end);
  assert.equal(offset - directoryStart, view.getUint32(end + 12, true));
  return parts;
}

test("XLSX is a genuine ZIP package with coherent workbook, worksheet, style and content-type relationships", () => {
  const workbook = createXlsxWorkbook([recordsToSheet("Cards", [{ id: "rogue:attack", cost: 2 }]), recordsToSheet("Tags", [{ id: "tag.rogue" }])]);
  const parts = readZip(workbook);
  assert.equal(parts.size, 7);
  assert.match(parts.get("[Content_Types].xml"), /spreadsheetml\.sheet\.main\+xml/);
  assert.match(parts.get("[Content_Types].xml"), /PartName="\/xl\/worksheets\/sheet2\.xml"/);
  assert.match(parts.get("_rels/.rels"), /Target="xl\/workbook\.xml"/);
  assert.match(parts.get("xl/workbook.xml"), /name="Cards" sheetId="1" r:id="rId1"/);
  assert.match(parts.get("xl/_rels/workbook.xml.rels"), /Id="rId2"[^>]+Target="worksheets\/sheet2\.xml"/);
  assert.match(parts.get("xl/styles.xml"), /cellXfs count="2"/);
  assert.match(parts.get("xl/worksheets/sheet1.xml"), /state="frozen"/);
  assert.match(parts.get("xl/worksheets/sheet1.xml"), /autoFilter ref="A1:B2"/);
});

test("Unicode, XML punctuation and formula-like values remain strings; numbers and booleans retain types", () => {
  const parts = readZip(createXlsxWorkbook([{ name: "Values", rows: [
    ["Rogue 🔥 日本語", "<&\"'>", "=HYPERLINK(\"https://invalid.test\")", "+1", "@SUM(A1)", "_x0000_", "line\r\n\tend\u0000"],
    [2.5, true, false, null, 1234567890123456, 12345678901234567890n, { effect: "burn", value: 3 }],
  ] }]));
  const xml = parts.get("xl/worksheets/sheet1.xml");
  assert.match(xml, /Rogue 🔥 日本語/);
  assert.match(xml, /&lt;&amp;&quot;&apos;&gt;/);
  assert.match(xml, /r="C1" t="inlineStr"[^>]*><is><t[^>]*>=HYPERLINK/);
  assert.ok(!xml.includes("<f>"), "no executable formula elements");
  assert.match(xml, /_x005F_x0000_/);
  assert.match(xml, /line_x000D_\n\tend_x0000_/);
  assert.ok(!xml.includes("\u0000"));
  assert.match(xml, /r="A2" t="n"><v>2\.5<\/v>/);
  assert.match(xml, /r="B2" t="b"><v>1<\/v>/);
  assert.match(xml, /r="C2" t="b"><v>0<\/v>/);
  assert.match(xml, /r="D2"\/>/);
  assert.match(xml, /1234567890123456<\/t>/);
  assert.match(xml, /12345678901234567890<\/t>/);
  assert.match(xml, /\{&quot;effect&quot;:&quot;burn&quot;,&quot;value&quot;:3\}/);
});

test("Sheet names obey Excel restrictions and stay unique after sanitizing and truncating", () => {
  const parts = readZip(createXlsxWorkbook(["'A/B:*?[C]\\'", "'A/B:*?[C]\\'", "History", "history", "x".repeat(40), "x".repeat(40), ""].map((name) => ({ name, rows: [] }))));
  const names = [...parts.get("xl/workbook.xml").matchAll(/<sheet name="([^"]*)"/g)].map((match) => match[1]);
  assert.equal(names.length, 7);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 7);
  for (const name of names) {
    assert.ok(name.length <= 31);
    assert.ok(!/[\\/?*:\[\]]/.test(name));
    assert.ok(!name.startsWith("'") && !name.endsWith("'"));
  }
  assert.equal(names[2], "History sheet");
  assert.equal(names[3], "History sheet (2)");
  assert.equal(names[6], "Sheet 7");
});

test("Record export preserves union columns, missing values, selected labels and nested authoring data", () => {
  const records = [{ id: "1", label: "One", effects: [{ op: "burn", amount: 2 }] }, { id: "2", extra: true }];
  assert.deepEqual(recordsToSheet("All", records).rows, [
    ["id", "label", "effects", "extra"], ["1", "One", records[0].effects, null], ["2", null, null, true],
  ]);
  assert.deepEqual(recordsToSheet("Named", records, [{ key: "id", label: "Card ID" }, "label"]).rows, [["Card ID", "label"], ["1", "One"], ["2", null]]);
  assert.match(readZip(createXlsxWorkbook([recordsToSheet("Records", records)])).get("xl/worksheets/sheet1.xml"), /&quot;op&quot;:&quot;burn&quot;/);
});

test("Excel column references cross Z and AA boundaries and empty workbooks have valid sheet data", () => {
  const values = Array.from({ length: 28 }, (_, index) => index);
  const parts = readZip(createXlsxWorkbook([{ name: "Wide", rows: [values] }, { name: "Empty", rows: [] }]));
  assert.match(parts.get("xl/worksheets/sheet1.xml"), /dimension ref="A1:AB1"/);
  assert.match(parts.get("xl/worksheets/sheet1.xml"), /r="Z1" t="n"><v>25<\/v>/);
  assert.match(parts.get("xl/worksheets/sheet1.xml"), /r="AA1" t="n"><v>26<\/v>/);
  assert.match(parts.get("xl/worksheets/sheet2.xml"), /<sheetData><\/sheetData>/);
});

test("Unsupported input and Excel limits fail explicitly instead of generating truncated or corrupt files", () => {
  assert.throws(() => createXlsxWorkbook([]), /at least one/);
  assert.throws(() => createXlsxWorkbook([{ rows: "not rows" }]), /rows must/);
  assert.throws(() => createXlsxWorkbook([{ rows: [null] }]), /row must/);
  assert.throws(() => createXlsxWorkbook([{ rows: [["x".repeat(32768)]] }]), /32767/);
  assert.throws(() => createXlsxWorkbook([{ rows: Array(1048577) }]), /1048576/);
  assert.throws(() => createXlsxWorkbook([{ rows: [Array(16385)] }]), /16384/);
  assert.throws(() => recordsToSheet("Bad", ["not a record"]), /array of objects/);
  const circular = {}; circular.self = circular;
  assert.throws(() => createXlsxWorkbook([{ rows: [[circular]] }]), /circular/i);
});

test("Browser export downloads binary XLSX bytes with correct MIME and filename", async () => {
  const previous = { document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, timeout: globalThis.setTimeout };
  let blob, clicked = false, removed = false, revoke;
  const anchor = { click() { clicked = true; }, remove() { removed = true; } };
  try {
    globalThis.document = { createElement: () => anchor, body: { append(value) { assert.equal(value, anchor); } } };
    URL.createObjectURL = (value) => { blob = value; return "blob:fixture"; };
    URL.revokeObjectURL = (value) => { revoke = value; };
    globalThis.setTimeout = (callback) => { callback(); return 0; };
    downloadXlsx("Tags", [recordsToSheet("Tags", [{ id: "tag.rogue" }])]);
    assert.equal(anchor.download, "Tags.xlsx");
    assert.equal(blob.type, XLSX_MIME);
    assert.ok(clicked && removed);
    assert.equal(revoke, "blob:fixture");
    const parts = readZip(new Uint8Array(await blob.arrayBuffer()));
    assert.match(parts.get("xl/worksheets/sheet1.xml"), /tag\.rogue/);
  } finally {
    if (previous.document === undefined) delete globalThis.document; else globalThis.document = previous.document;
    URL.createObjectURL = previous.create;
    URL.revokeObjectURL = previous.revoke;
    globalThis.setTimeout = previous.timeout;
  }
});
