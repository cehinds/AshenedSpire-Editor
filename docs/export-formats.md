# Editor export formats

| Format | Contents | Intended use |
|---|---|---|
| Workbench JSON | Full recoverable authoring draft with retained native documents and sidecars | Editor package import/recovery |
| Native JSON / CSV | Reviewed native document fields and source rows for supported adapters | Explicit native source integration |
| Excel `.xlsx` | Authored rows in real ZIP/Office Open XML workbook | Inspect, filter and share tabular draft data in Excel-compatible applications |

Excel export uses current draft records. It does not save repository files, generate game runtime code, or import edited spreadsheets back into editor. Native game save flows remain separate.

`src/xlsx.js` produces dependency-free `.xlsx` bytes with worksheet relationships, content types, inline string cells, typed numeric/boolean cells, wrapped content, styled headers, filters and frozen header row. Strings beginning with `=`, `+`, `-`, or `@` remain strings; no formula elements are emitted. Unicode and XML punctuation are escaped correctly. Large integer identifiers and JavaScript BigInt values stay text to preserve digits. Nested object/array values become JSON text within a cell.

Worksheet names are sanitized, truncated to Excel's 31-character limit, and made unique without invalid separators or reserved `History` name. Cell text beyond 32,767 characters raises explicit error instead of truncating content. Excel worksheet row/column limits are checked. Images, charts, macros and formulas are outside this tabular export.

Large image data URLs should remain in workbench/native JSON packages. Tabular Excel export should include asset identifiers or metadata, rather than embedded base64 image bytes.

## Component integration

```js
import { downloadXlsx, recordsToSheet } from './xlsx.js';

downloadXlsx('AshenedSpire-tags.xlsx', [
  recordsToSheet('Tags', project.nodes),
]);

downloadXlsx('AshenedSpire-cards.xlsx', [
  recordsToSheet('Cards', project.cards, [
    { key: 'id', label: 'Card ID' },
    { key: 'name', label: 'Name' },
    'effects',
  ]),
]);
```

For Node callers, `createXlsxWorkbook(sheets)` returns `Uint8Array`. Existing JSON download helper must not receive these bytes because it serializes objects as JSON.

## Format references

- [Microsoft: SpreadsheetML document structure](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document)
- [Microsoft: Inline string cells](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.inlinestring)
- [Microsoft: Escaped strings](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/d34ae755-c53f-4a44-a363-c6dd3ee018a4)
- [Microsoft: Worksheet name restrictions](https://support.microsoft.com/en-us/excel/rename-a-worksheet)
