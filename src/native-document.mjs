import {clone, validateProject} from './core.mjs';

// Native checkout documents with a draft model in the editor. Keys are document
// IDs; `ws` is the workspace that offers them. Older receipts used the
// workspace name as document ID, so tags/scenes/ui keep their names.
export const NATIVE_DOCUMENTS = {
    tags: {ws: 'tags', label: 'Tags CSV', field: 'nodes', extension: '.csv', path: 'content/source/nodes.csv', columns: ['id', 'parentId', 'label'], key: row => row.id},
    tagging: {ws: 'tags', label: 'Tag assignments CSV', field: 'tagging', extension: '.csv', path: 'content/source/tagging.csv', columns: ['family', 'scope', 'objectId', 'tagId'], key: row => JSON.stringify([row.family, row.scope, row.objectId, row.tagId])},
    effects: {ws: 'tags', label: 'Node effects JSON', field: 'effects', extension: '.json', path: 'content/source/nodeEffects.json'},
    scenes: {ws: 'scenes', label: 'Opening scene JSON', field: 'scenes', extension: '.json', path: 'content/config/ui/screens/prologue.json'},
    ui: {ws: 'ui', label: 'UI configuration JSON', field: 'ui', extension: '.json', path: 'content/config/ui/scenes/w4a-combat.json'}
};

/** Other native ERD sources the editor reads only as snapshots; no draft model, so no adapter. */
export const READ_ONLY_ERD_SOURCES = Object.freeze(['nodeRelations.csv', 'nodeVariables.csv', 'nodeTerms.csv', 'tagFamilies.csv', 'familyNodes.csv']);

export const documentsFor = ws => Object.keys(NATIVE_DOCUMENTS).filter(id => NATIVE_DOCUMENTS[id].ws === ws);

export function checkDocumentPath(doc, value)
{
    const type = NATIVE_DOCUMENTS[doc];
    if (!type) throw new Error('Native checkout bridge supports Tags, tag assignments, node effects, Opening scenes, and UI settings only.');
    if (typeof value !== 'string' || !value || value.startsWith('/') || /[\\\x00-\x1f]/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) || !value.toLowerCase().endsWith(type.extension)) throw new Error(`Choose existing relative ${type.extension} file in checkout.`);
    return value;
}

const csvCell = value =>
{
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) || /^[ \t]*#/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
};
const csvLine = (record, headers) => headers.map(header => csvCell(record[header])).join(',');

/**
 * Parses native CSV and keeps its layout: each record's raw line and the
 * comment/blank lines before it, so a save can restore them in place.
 */
export function parseNativeCSV(content, columns = NATIVE_DOCUMENTS.tags.columns, label = 'Tags CSV')
{
    const records = [], comments = [];
    let cells = [], cell = '', quoted = false, closed = false, start = -1, pending = [];
    const text = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    for (let index = 0; index <= text.length; index += 1)
    {
        const character = text[index];
        const atRecordStart = !quoted && !closed && !cells.length && !cell && start < 0;
        if (atRecordStart && character === '#')
        {
            const end = text.indexOf('\n', index);
            const line = text.slice(index, end < 0 ? text.length : end);
            comments.push(line); pending.push(line);
            index = end < 0 ? text.length : end;
            continue;
        }
        if (atRecordStart && character === '\n') {pending.push(''); continue;}
        if (atRecordStart && character !== undefined) start = index;
        if (quoted)
        {
            if (character === undefined) throw new Error('Unclosed CSV quote.');
            if (character === '"' && text[index + 1] === '"') {cell += '"'; index += 1;}
            else if (character === '"') {quoted = false; closed = true;}
            else cell += character;
        }
        else if (character === '"')
        {
            if (cell || closed) throw new Error('Malformed CSV quoting.');
            quoted = true;
        }
        else if (character === ',' || character === '\n' || character === undefined)
        {
            if (character === ',') {cells.push(cell); cell = ''; closed = false;}
            else
            {
                if (cells.length || cell || closed) {records.push({cells: [...cells, cell], raw: text.slice(start, index), before: pending}); pending = [];}
                cells = []; cell = ''; closed = false; start = -1;
            }
        }
        else
        {
            if (closed) throw new Error('Unexpected text after CSV quote.');
            cell += character;
        }
    }
    const header = records.shift();
    const headers = header?.cells || [];
    if (!headers.length || new Set(headers).size !== headers.length || headers.some(name => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) || !columns.every(name => headers.includes(name))) throw new Error(`${label} requires unique ${columns.join(', ')} columns.`);
    const value = records.map((record, index) =>
    {
        if (record.cells.length !== headers.length) throw new Error(`CSV record ${index + 2} has wrong column count.`);
        return Object.fromEntries(headers.map((name, column) => [name, record.cells[column]]));
    });
    if (!value.length) throw new Error(`${label} must contain records.`);
    return {value, headers, comments, layout: {before: header.before, header: header.raw, rows: records.map(({raw, before}) => ({raw, before})), trailing: pending}};
}

export function parseNativeDocument(doc, content)
{
    const type = NATIVE_DOCUMENTS[doc];
    if (!type) throw new Error('Unsupported native document.');
    if (typeof content !== 'string' || new TextEncoder().encode(content).length > 1024 * 1024) throw new Error('Native text document exceeds 1 MiB.');
    if (type.extension === '.csv') return parseNativeCSV(content, type.columns, type.label);
    const value = JSON.parse(content);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Native JSON root must be object.');
    if (doc === 'scenes' && !Array.isArray(value.components?.sequence?.scenes)) throw new Error('Full native opening sequence document required.');
    if (doc === 'ui' && (!value.sizing?.bands || typeof value.sizing.bands !== 'object')) throw new Error('Full native UI sizing document required.');
    if (doc === 'effects' && Object.values(value).some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry))) throw new Error('Native node effects must map node IDs to effect objects.');
    return {value};
}

export function mergedNativeProject(project, doc, content)
{
    const parsed = parseNativeDocument(doc, content);
    const next = clone(project);
    next[NATIVE_DOCUMENTS[doc].field] = clone(parsed.value);
    const issues = validateProject(next);
    if (issues.length) throw new Error(issues.join('; '));
    return {next, parsed};
}

function retainKeys(source, draft, location = 'document')
{
    if (Array.isArray(source))
    {
        if (!Array.isArray(draft)) throw new Error(`Retain native array at ${location}.`);
        for (const entry of source)
        {
            if (!entry || typeof entry !== 'object' || !entry.id) continue;
            const current = draft.find(value => value?.id === entry.id);
            if (current) retainKeys(entry, current, `${location}[${entry.id}]`);
        }
    }
    else if (source && typeof source === 'object')
    {
        if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error(`Retain native object at ${location}.`);
        for (const key of Object.keys(source))
        {
            if (!Object.hasOwn(draft, key)) throw new Error(`Native field ${location}.${key} missing. Load checkout before editing; retain source metadata.`);
            retainKeys(source[key], draft[key], `${location}.${key}`);
        }
    }
}

/**
 * Writes CSV records in draft order. Unchanged records keep their exact source
 * line; comments and blank lines stay before the record they preceded (or the
 * next surviving one when a record is removed). New records follow the last
 * record, ahead of trailing comments.
 */
function serializeCSV(type, value, parsed)
{
    const headers = [...new Set([...parsed.headers, ...value.flatMap(record => Object.keys(record))])];
    if (headers.some(header => !/^[A-Za-z][A-Za-z0-9_]*$/.test(header))) throw new Error('Unsupported native CSV column.');
    for (const record of value)
    {
        if (parsed.headers.some(header => !Object.hasOwn(record, header)) || Object.values(record).some(cell => typeof cell !== 'string')) throw new Error(`Retain all source CSV columns as text for every ${type.label} record.`);
    }
    const layout = parsed.layout || {before: parsed.comments || [], header: csvLine(Object.fromEntries(parsed.headers.map(name => [name, name])), parsed.headers), rows: parsed.value.map(() => ({raw: null, before: []})), trailing: []};
    const sameHeaders = headers.length === parsed.headers.length;
    const kept = new Set(value.map(type.key)), source = new Map();
    let carry = [];
    parsed.value.forEach((record, index) =>
    {
        const row = layout.rows[index], key = type.key(record);
        if (kept.has(key) && !source.has(key)) {source.set(key, {record, raw: row.raw, before: [...carry, ...row.before]}); carry = [];}
        else carry.push(...row.before);
    });
    const lines = [...layout.before, sameHeaders && layout.header ? layout.header : csvLine(Object.fromEntries(headers.map(name => [name, name])), headers)];
    for (const record of value)
    {
        const original = source.get(type.key(record));
        if (original)
        {
            lines.push(...original.before);
            const unchanged = sameHeaders && original.raw !== null && headers.every(name => original.record[name] === record[name]);
            lines.push(unchanged ? original.raw : csvLine(record, headers));
        }
        else lines.push(csvLine(record, headers));
    }
    lines.push(...carry, ...layout.trailing);
    return lines.join('\n') + '\n';
}

export function serializeNativeDocument(project, doc, receipt)
{
    if (!receipt || receipt.ws !== doc || !receipt.parsed || !receipt.revision) throw new Error('Load this checkout document into draft before saving.');
    const type = NATIVE_DOCUMENTS[doc];
    if (!type) throw new Error('Unsupported native document.');
    const issues = validateProject(project);
    if (issues.length) throw new Error(issues.join('; '));
    const value = project[type.field];
    if (value === undefined) throw new Error(`${type.label} has no draft. Load it from the checkout first.`);
    let content;
    if (type.extension === '.csv') content = serializeCSV(type, value, receipt.parsed);
    else
    {
        retainKeys(receipt.parsed.value, value);
        content = JSON.stringify(value, null, 2) + '\n';
    }
    mergedNativeProject(project, doc, content);
    return content;
}

export function reviewNativeSave(project, doc, receipt, current)
{
    if (!receipt || receipt.ws !== doc || current.path !== receipt.path || current.revision !== receipt.revision) throw new Error('Checkout changed since load. Draft edits retained. Copy edits, then reload checkout document before saving.');
    mergedNativeProject(project, doc, current.content);
    return {before: current.content, after: serializeNativeDocument(project, doc, receipt), revision: current.revision};
}
