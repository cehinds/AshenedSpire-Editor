import {clone, toCSV, validateProject} from './core.mjs';

export const NATIVE_DOCUMENTS = {
    tags: {label: 'Tags CSV', field: 'nodes', extension: '.csv', path: 'content/source/nodes.csv'},
    scenes: {label: 'Opening scene JSON', field: 'scenes', extension: '.json', path: 'content/config/ui/screens/prologue.json'},
    ui: {label: 'UI configuration JSON', field: 'ui', extension: '.json', path: 'content/config/ui/scenes/w4a-combat.json'}
};

export function checkDocumentPath(ws, value)
{
    const type = NATIVE_DOCUMENTS[ws];
    if (!type) throw new Error('Native checkout bridge supports Tags, Opening scenes, and UI settings only.');
    if (typeof value !== 'string' || !value || value.startsWith('/') || /[\\\u0000-\u001f]/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) || !value.toLowerCase().endsWith(type.extension)) throw new Error(`Choose existing relative ${type.extension} file in checkout.`);
    return value;
}

export function parseNativeCSV(content)
{
    const records = [], comments = [];
    let cells = [], cell = '', quoted = false, closed = false;
    const text = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    for (let index = 0; index <= text.length; index += 1)
    {
        const character = text[index];
        if (!quoted && !closed && !cells.length && !cell && character === '#')
        {
            const end = text.indexOf('\n', index);
            comments.push(text.slice(index, end < 0 ? text.length : end));
            index = end < 0 ? text.length : end;
            continue;
        }
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
                if (cells.length || cell || closed) records.push([...cells, cell]);
                cells = []; cell = ''; closed = false;
            }
        }
        else
        {
            if (closed) throw new Error('Unexpected text after CSV quote.');
            cell += character;
        }
    }
    const headers = records.shift() || [];
    if (!headers.length || new Set(headers).size !== headers.length || headers.some(header => !/^[A-Za-z][A-Za-z0-9_]*$/.test(header)) || !['id', 'parentId', 'label'].every(header => headers.includes(header))) throw new Error('Tags CSV requires unique id, parentId, and label columns.');
    const value = records.map((record, index) =>
    {
        if (record.length !== headers.length) throw new Error(`CSV record ${index + 2} has wrong column count.`);
        return Object.fromEntries(headers.map((header, column) => [header, record[column]]));
    });
    if (!value.length) throw new Error('Tags CSV must contain records.');
    return {value, headers, comments};
}

export function parseNativeDocument(ws, content)
{
    if (!NATIVE_DOCUMENTS[ws]) throw new Error('Unsupported native document.');
    if (typeof content !== 'string' || new TextEncoder().encode(content).length > 1024 * 1024) throw new Error('Native text document exceeds 1 MiB.');
    if (ws === 'tags') return parseNativeCSV(content);
    const value = JSON.parse(content);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Native JSON root must be object.');
    if (ws === 'scenes' && !Array.isArray(value.components?.sequence?.scenes)) throw new Error('Full native opening sequence document required.');
    if (ws === 'ui' && (!value.sizing?.bands || typeof value.sizing.bands !== 'object')) throw new Error('Full native UI sizing document required.');
    return {value};
}

export function mergedNativeProject(project, ws, content)
{
    const parsed = parseNativeDocument(ws, content);
    const next = clone(project);
    next[NATIVE_DOCUMENTS[ws].field] = clone(parsed.value);
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

export function serializeNativeDocument(project, ws, receipt)
{
    if (!receipt || receipt.ws !== ws || !receipt.parsed || !receipt.revision) throw new Error('Load this checkout document into draft before saving.');
    const issues = validateProject(project);
    if (issues.length) throw new Error(issues.join('; '));
    const value = project[NATIVE_DOCUMENTS[ws].field];
    let content;
    if (ws === 'tags')
    {
        const headers = [...new Set([...receipt.parsed.headers, ...value.flatMap(record => Object.keys(record))])];
        if (headers.some(header => !/^[A-Za-z][A-Za-z0-9_]*$/.test(header))) throw new Error('Unsupported native CSV column.');
        for (const record of value)
        {
            if (receipt.parsed.headers.some(header => !Object.hasOwn(record, header)) || Object.values(record).some(cell => typeof cell !== 'string')) throw new Error('Retain all source CSV columns as text for every tag record.');
        }
        content = (receipt.parsed.comments.length ? receipt.parsed.comments.join('\n') + '\n' : '') + toCSV(value, headers);
    }
    else
    {
        retainKeys(receipt.parsed.value, value);
        content = JSON.stringify(value, null, 2) + '\n';
    }
    mergedNativeProject(project, ws, content);
    return content;
}

export function reviewNativeSave(project, ws, receipt, current)
{
    if (!receipt || receipt.ws !== ws || current.path !== receipt.path || current.revision !== receipt.revision) throw new Error('Checkout changed since load. Draft edits retained. Copy edits, then reload checkout document before saving.');
    mergedNativeProject(project, ws, current.content);
    return {before: current.content, after: serializeNativeDocument(project, ws, receipt), revision: current.revision};
}
