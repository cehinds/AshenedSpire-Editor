// Native JS-literal source adapters for AshenSpire checkout modules.
//
// Card files (src/content/cards/*.js) and src/content/balance.js are ES modules
// whose data are object literals mixed with comments, helper constants and
// template literals. The editor never rewrites a whole module: it scans the
// file, locates one array element (a card) or one nested object's numeric
// properties (balance.ui.combatantStage), and splices a deterministic literal
// into that span. Every other byte stays as it was. The local host evaluates
// the result in an isolated Node process before anything is written.

const PUNCT_REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const NAME = /[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*/uy;
const NUMBER = /(?:0[xXbBoO][0-9a-fA-F_]+n?|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?n?)/y;
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
export const CARD_SOURCE_FILES = Object.freeze(['rogue', 'reaver', 'herald', 'starseer', 'colorless', 'coop', 'armaments'].map(name => `src/content/cards/${name}.js`));
export const BALANCE_SOURCE = 'src/content/balance.js';
export const MAX_SOURCE = 1024 * 1024;

class ScanError extends Error {}
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function tokenize(text, start, stopAtBrace)
{
    const tokens = [];
    let index = start, depth = 0;
    const regexAllowed = () =>
    {
        const previous = tokens.at(-1);
        if (!previous) return true;
        if (previous.type === 'name') return PUNCT_REGEX_KEYWORDS.has(previous.value);
        if (previous.type !== 'punct') return false;
        return ![')', ']', '}'].includes(previous.value);
    };
    while (index < text.length)
    {
        const character = text[index], next = text[index + 1];
        if (/\s/.test(character)) {index += 1; continue;}
        if (character === '/' && next === '/') {const end = text.indexOf('\n', index); index = end < 0 ? text.length : end; continue;}
        if (character === '/' && next === '*')
        {
            const end = text.indexOf('*/', index + 2);
            if (end < 0) throw new ScanError(`Unclosed comment at line ${lineOf(text, index)}.`);
            index = end + 2; continue;
        }
        if (character === '\'' || character === '"')
        {
            let cursor = index + 1;
            while (cursor < text.length && text[cursor] !== character)
            {
                if (text[cursor] === '\\') cursor += 1;
                else if (text[cursor] === '\n') throw new ScanError(`Unterminated string at line ${lineOf(text, index)}.`);
                cursor += 1;
            }
            if (cursor >= text.length) throw new ScanError(`Unterminated string at line ${lineOf(text, index)}.`);
            tokens.push({type: 'string', value: text.slice(index, cursor + 1), start: index, end: cursor + 1});
            index = cursor + 1; continue;
        }
        if (character === '`')
        {
            let cursor = index + 1, simple = true;
            for (;;)
            {
                if (cursor >= text.length) throw new ScanError(`Unterminated template literal at line ${lineOf(text, index)}.`);
                if (text[cursor] === '\\') {cursor += 2; continue;}
                if (text[cursor] === '`') break;
                if (text[cursor] === '$' && text[cursor + 1] === '{') {simple = false; cursor = tokenize(text, cursor + 2, true).end; continue;}
                cursor += 1;
            }
            tokens.push({type: 'template', value: text.slice(index, cursor + 1), start: index, end: cursor + 1, simple});
            index = cursor + 1; continue;
        }
        if (character === '/' && regexAllowed())
        {
            let cursor = index + 1, inClass = false;
            for (;;)
            {
                const value = text[cursor];
                if (value === undefined || value === '\n') throw new ScanError(`Unterminated regular expression at line ${lineOf(text, index)}.`);
                if (value === '\\') {cursor += 2; continue;}
                if (value === '[') inClass = true;
                else if (value === ']') inClass = false;
                else if (value === '/' && !inClass) break;
                cursor += 1;
            }
            cursor += 1;
            while (/[a-z]/.test(text[cursor] || '')) cursor += 1;
            tokens.push({type: 'regex', value: text.slice(index, cursor), start: index, end: cursor});
            index = cursor; continue;
        }
        NUMBER.lastIndex = index;
        if (/[0-9]/.test(character) || (character === '.' && /[0-9]/.test(next || '')))
        {
            const match = NUMBER.exec(text);
            tokens.push({type: 'number', value: match[0], start: index, end: index + match[0].length});
            index += match[0].length; continue;
        }
        NAME.lastIndex = index;
        const name = NAME.exec(text);
        if (name)
        {
            tokens.push({type: 'name', value: name[0], start: index, end: index + name[0].length});
            index += name[0].length; continue;
        }
        if (character === '.' && next === '.' && text[index + 2] === '.')
        {
            tokens.push({type: 'punct', value: '...', start: index, end: index + 3});
            index += 3; continue;
        }
        if (stopAtBrace)
        {
            if (character === '{') depth += 1;
            if (character === '}' && depth-- === 0) return {tokens, end: index + 1};
        }
        tokens.push({type: 'punct', value: character, start: index, end: index + 1});
        index += 1;
    }
    if (stopAtBrace) throw new ScanError('Unterminated template expression.');
    return {tokens, end: index};
}

/** Tokenizes enough JavaScript to find literal spans: strings, templates, comments and regex are atomic. */
export function scanJs(text)
{
    if (typeof text !== 'string') throw new Error('Native module must be text.');
    if (text.length > MAX_SOURCE) throw new Error('Native module exceeds 1 MiB.');
    try
    {
        const {tokens} = tokenize(text, 0, false);
        const stack = [];
        tokens.forEach((token, index) =>
        {
            token.depth = stack.length;
            if (token.type !== 'punct') return;
            if ('([{'.includes(token.value)) stack.push(index);
            else if (')]}'.includes(token.value))
            {
                const open = stack.pop();
                if (open === undefined || '([{'.indexOf(tokens[open].value) !== ')]}'.indexOf(token.value)) throw new ScanError(`Unbalanced ${token.value} at line ${lineOf(text, token.start)}.`);
                tokens[open].match = index; token.match = open; token.depth = stack.length;
            }
        });
        if (stack.length) throw new ScanError(`Unclosed ${tokens[stack.at(-1)].value} at line ${lineOf(text, tokens[stack.at(-1)].start)}.`);
        return tokens;
    }
    catch (error)
    {
        if (error instanceof ScanError) throw new Error(`Native module could not be scanned safely: ${error.message}`);
        throw error;
    }
}

export function unquote(raw)
{
    const body = raw.slice(1, -1);
    return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r\n|[\s\S])/g, (all, escape) =>
    {
        if (escape[0] === 'u') return String.fromCodePoint(parseInt(escape[1] === '{' ? escape.slice(2, -1) : escape.slice(1), 16));
        if (escape[0] === 'x') return String.fromCharCode(parseInt(escape.slice(1), 16));
        return {n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0', '\n': '', '\r\n': '', '\u2028': '', '\u2029': ''}[escape] ?? escape;
    });
}

function literalKey(token)
{
    if (!token) return undefined;
    if (token.type === 'name') return token.value;
    if (token.type === 'string' || (token.type === 'template' && token.simple)) return unquote(token.value);
    if (token.type === 'number') return String(Number(token.value.replaceAll('_', '')));
    return undefined;
}

function entries(tokens, open)
{
    const close = tokens[open].match, list = [];
    let first = open + 1;
    for (let index = open + 1; index <= close; index += 1)
    {
        const token = tokens[index];
        if (index === close || (token.type === 'punct' && token.value === ',' && token.depth === tokens[open].depth + 1))
        {
            if (first < index) list.push({first, last: index - 1, start: tokens[first].start, end: tokens[index - 1].end, comma: index < close ? index : undefined});
            first = index + 1;
        }
    }
    return list;
}

function properties(tokens, open)
{
    return entries(tokens, open).map(entry =>
    {
        const keyToken = tokens[entry.first], colon = tokens[entry.first + 1];
        const key = colon?.type === 'punct' && colon.value === ':' && entry.first + 1 < entry.last ? literalKey(keyToken) : undefined;
        return {...entry, key, valueFirst: key === undefined ? undefined : entry.first + 2};
    });
}

function declaration(tokens, name)
{
    const found = [];
    for (let index = 0; index + 3 < tokens.length; index += 1)
    {
        const token = tokens[index];
        if (token.depth !== 0 || token.type !== 'name' || !['const', 'let', 'var'].includes(token.value)) continue;
        if (tokens[index + 1].type === 'name' && tokens[index + 1].value === name && tokens[index + 2].value === '=') found.push(index + 3);
    }
    if (found.length !== 1) throw new Error(found.length ? `Native module declares ${name} more than once.` : `Native module has no top-level ${name} declaration.`);
    return found[0];
}

/** Names of top-level `export const <x>Cards = [` arrays. */
export function cardArrayNames(text)
{
    const tokens = scanJs(text), names = [];
    for (let index = 0; index + 4 < tokens.length; index += 1)
    {
        const [exported, keyword, name, equals, open] = tokens.slice(index, index + 5);
        if (exported.depth === 0 && exported.value === 'export' && keyword.value === 'const' && name.type === 'name' && /Cards$/.test(name.value) && equals.value === '=' && open.value === '[') names.push(name.value);
    }
    return names;
}

function cardArray(text, exportName)
{
    const names = cardArrayNames(text);
    const name = exportName || (names.length === 1 ? names[0] : '');
    if (!name) throw new Error(names.length ? `Choose card array: ${names.join(', ')}.` : 'No exported card array (export const <name>Cards = [ … ]) found in this file.');
    if (!names.includes(name)) throw new Error(`Exported card array ${name} not found in this file.`);
    const tokens = scanJs(text), open = declaration(tokens, name);
    const elements = entries(tokens, open).map(element =>
    {
        let id;
        if (tokens[element.first].value === '{' && tokens[element.first].match === element.last)
        {
            const key = properties(tokens, element.first).find(property => property.key === 'id');
            const value = key && tokens[key.valueFirst];
            if (key && key.valueFirst === key.last && (value.type === 'string' || (value.type === 'template' && value.simple))) id = unquote(value.value);
        }
        return {...element, id};
    });
    return {name, tokens, open, close: tokens[open].match, elements};
}

/** Locates the cards an exported array declares as object literals with a literal id. */
export function scanCardSource(text, exportName)
{
    const array = cardArray(text, exportName);
    return {exportName: array.name, ids: array.elements.map(element => element.id ?? null), opaque: array.elements.filter(element => element.id === undefined).length};
}

function quote(value)
{
    return '\'' + value.replace(/[\\'\u0000-\u001f\u007f\u2028\u2029]/g, character => ({'\\': '\\\\', '\'': '\\\'', '\n': '\\n', '\r': '\\r', '\t': '\\t'}[character] ?? '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'))) + '\'';
}

function inline(value)
{
    if (value === null) return 'null';
    if (typeof value === 'string') return quote(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number')
    {
        if (!Number.isFinite(value)) throw new Error('Native literal numbers must be finite.');
        return Object.is(value, -0) ? '-0' : String(value);
    }
    if (Array.isArray(value)) return value.length ? '[' + value.map(inline).join(', ') + ']' : '[]';
    if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype || typeof value === 'object' && Object.getPrototypeOf(value) === null)
    {
        const pairs = Object.entries(value).filter(([, item]) => item !== undefined);
        return pairs.length ? '{ ' + pairs.map(([key, item]) => propertyName(key) + ': ' + inline(item)).join(', ') + ' }' : '{}';
    }
    throw new Error('Native literals accept JSON values only.');
}

function propertyName(key)
{
    if (key === '__proto__') throw new Error('Native literal key __proto__ is not supported.');
    return IDENT.test(key) ? key : quote(key);
}

/** Deterministic JS literal. Short values stay on one line; long ones break at two-space indents. */
export function toJsLiteral(value, indent = '', width = 100)
{
    const flat = inline(value);
    if (flat.length + indent.length <= width || value === null || typeof value !== 'object' || !Object.keys(value).length) return flat;
    const inner = indent + '  ';
    if (Array.isArray(value)) return '[\n' + value.map(item => inner + toJsLiteral(item, inner, width) + ',\n').join('') + indent + ']';
    return '{\n' + Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => inner + propertyName(key) + ': ' + toJsLiteral(item, inner, width - key.length - 2) + ',\n').join('') + indent + '}';
}

const indentAt = (text, index) => text.slice(text.lastIndexOf('\n', index - 1) + 1, index).match(/^[ \t]*/)[0];
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Replaces (mode 'replace') or appends (mode 'append') one card literal; the rest of the file is untouched. */
export function spliceCardSource(text, card, {mode, exportName} = {})
{
    if (!plainRecord(card) || typeof card.id !== 'string' || !card.id) throw new Error('Card definition with text id required.');
    if (!['replace', 'append'].includes(mode)) throw new Error('Choose replace or append.');
    const array = cardArray(text, exportName);
    const matches = array.elements.filter(element => element.id === card.id);
    if (mode === 'replace')
    {
        if (matches.length !== 1) throw new Error(matches.length ? `Card ${card.id} appears more than once in ${array.name}.` : `Card ${card.id} is not an object literal with a literal id in ${array.name}. Add it instead, or edit this file in Files.`);
        const [match] = matches;
        return {exportName: array.name, mode, content: text.slice(0, match.start) + toJsLiteral(card, indentAt(text, match.start)) + text.slice(match.end)};
    }
    if (matches.length) throw new Error(`Card ${card.id} already exists in ${array.name}. Save it instead of adding.`);
    const last = array.elements.at(-1);
    if (!last)
    {
        const pad = indentAt(text, array.tokens[array.open].start) + '  ', at = array.tokens[array.open].end;
        return {exportName: array.name, mode, content: text.slice(0, at) + '\n' + pad + toJsLiteral(card, pad) + ',\n' + text.slice(at)};
    }
    const pad = indentAt(text, last.start), literal = toJsLiteral(card, pad);
    const content = last.comma !== undefined
        ? text.slice(0, array.tokens[last.comma].end) + '\n' + pad + literal + ',' + text.slice(array.tokens[last.comma].end)
        : text.slice(0, last.end) + ',\n' + pad + literal + text.slice(last.end);
    return {exportName: array.name, mode, content};
}

const NUMBER_VALUE = /^-?\s*(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?$/;

/** Writes numeric overrides into one nested object literal (e.g. balance → ui → combatantStage). */
export function spliceObjectNumbers(text, declarationName, path, overrides)
{
    if (!plainRecord(overrides) || !Object.keys(overrides).length) throw new Error('No overrides to write.');
    const tokens = scanJs(text);
    let open = declaration(tokens, declarationName);
    if (tokens[open].value !== '{') throw new Error(`${declarationName} must be an object literal.`);
    for (const key of path)
    {
        const found = properties(tokens, open).filter(property => property.key === key);
        if (found.length !== 1) throw new Error(found.length ? `${key} is declared more than once.` : `${[declarationName, ...path].join('.')} not found as an object literal; ${key} missing.`);
        const value = tokens[found[0].valueFirst];
        if (value.value !== '{' || value.match !== found[0].last) throw new Error(`${key} must be a plain object literal to edit safely.`);
        open = found[0].valueFirst;
    }
    const target = properties(tokens, open), edits = [];
    for (const [key, value] of Object.entries(overrides))
    {
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} must be a finite number.`);
        const found = target.filter(property => property.key === key);
        if (found.length > 1) throw new Error(`${key} is declared more than once.`);
        if (found.length)
        {
            const span = text.slice(tokens[found[0].valueFirst].start, tokens[found[0].last].end);
            if (!NUMBER_VALUE.test(span)) throw new Error(`${key} is not a plain number literal; edit it in Files.`);
            edits.push({start: tokens[found[0].valueFirst].start, end: tokens[found[0].last].end, text: inline(value)});
        }
        else
        {
            const last = target.at(-1);
            const pad = last ? indentAt(text, last.start) : indentAt(text, tokens[open].start) + '  ';
            const line = propertyName(key) + ': ' + inline(value);
            if (!last) edits.push({start: tokens[open].end, end: tokens[open].end, text: '\n' + pad + line + ',\n' + indentAt(text, tokens[open].start)});
            else if (last.comma !== undefined) edits.push({start: tokens[last.comma].end, end: tokens[last.comma].end, text: '\n' + pad + line + ','});
            else edits.push({start: last.end, end: last.end, text: ',\n' + pad + line});
        }
    }
    edits.sort((a, b) => b.start - a.start || b.end - a.end);
    let content = text;
    for (const edit of edits) content = content.slice(0, edit.start) + edit.text + content.slice(edit.end);
    return content;
}

/** Canonical, sorted-key JSON text; non-JSON values become explicit markers so a comparison cannot miss them. */
export function canonicalJson(value)
{
    const seen = new Set();
    const walk = item =>
    {
        if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
        if (typeof item === 'number') return Number.isFinite(item) ? item : {$nonJson: String(item)};
        if (item === undefined) return {$nonJson: 'undefined'};
        if (typeof item !== 'object') return {$nonJson: typeof item};
        if (seen.has(item)) return {$nonJson: 'circular'};
        seen.add(item);
        try
        {
            if (Array.isArray(item)) return item.map(walk);
            const prototype = Object.getPrototypeOf(item);
            if (prototype !== Object.prototype && prototype !== null) return {$nonJson: item.constructor?.name || 'object'};
            return Object.fromEntries(Object.keys(item).sort().filter(key => item[key] !== undefined).map(key => [key, walk(item[key])]));
        }
        finally {seen.delete(item);}
    };
    return JSON.stringify(walk(value));
}

/** Compact line diff covering the single changed region (prefix/suffix lines shared). */
export function changedRegion(before, after, context = 2)
{
    const a = before.split('\n'), b = after.split('\n');
    let prefix = 0;
    while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
    let suffix = 0;
    while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1;
    if (prefix === a.length && a.length === b.length) return '';
    const from = Math.max(0, prefix - context);
    const lines = [`@@ line ${prefix + 1} @@`];
    for (let index = from; index < prefix; index += 1) lines.push('  ' + a[index]);
    for (let index = prefix; index < a.length - suffix; index += 1) lines.push('- ' + a[index]);
    for (let index = prefix; index < b.length - suffix; index += 1) lines.push('+ ' + b[index]);
    for (let index = a.length - suffix; index < Math.min(a.length, a.length - suffix + context); index += 1) lines.push('  ' + a[index]);
    return lines.join('\n');
}

/** Native validate.js ranges for balance.ui.combatantStage. */
export const COMBATANT_STAGE_RANGES = Object.freeze({hudClearanceViewportPct: [0, 25], actionClearanceViewportPct: [0, 25], intentGapPx: [0, 24], centerPct: [25, 75]});

export function combatantStageProblems(stage)
{
    if (!plainRecord(stage)) return ['Stage overrides must be an object.'];
    const problems = [];
    for (const [key, value] of Object.entries(stage))
    {
        const range = COMBATANT_STAGE_RANGES[key];
        if (!range) problems.push(`Unknown combatantStage token ${key}.`);
        else if (typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1]) problems.push(`${key} must be ${range[0]}–${range[1]} (native validator range); draft has ${value}.`);
    }
    return problems;
}

/** Plans one native JS adapter write; shared by browser review and the host's authoritative check. */
export function planNativeSource(adapter, text, options)
{
    if (adapter === 'card')
    {
        const result = spliceCardSource(text, options.card, {mode: options.mode, exportName: options.exportName});
        return {content: result.content, exportName: result.exportName, mode: result.mode};
    }
    if (adapter === 'combatantStage')
    {
        const problems = combatantStageProblems(options.stage);
        if (problems.length) throw new Error(problems.join(' '));
        return {content: spliceObjectNumbers(text, 'balance', ['ui', 'combatantStage'], options.stage), exportName: 'balance'};
    }
    throw new Error('Unsupported native source adapter.');
}

/** Compares evaluated before/after module exports with the draft; returns problems (empty = verified). */
export function verifyNativeSource(adapter, options, evaluated)
{
    const problems = [];
    if (adapter === 'card')
    {
        const before = evaluated.before, after = evaluated.after, id = options.card.id;
        if (!Array.isArray(before) || !Array.isArray(after)) return ['Evaluated export is not a card array.'];
        const draft = canonicalJson(options.card), at = before.findIndex(card => card?.id === id);
        if (options.mode === 'replace')
        {
            if (at < 0) problems.push(`Evaluated ${options.exportName} has no card ${id}.`);
            else if (before.filter(card => card?.id === id).length > 1) problems.push(`Evaluated ${options.exportName} has duplicate ${id}.`);
            else if (canonicalJson(before[at]).includes('"$nonJson"')) problems.push(`Card ${id} uses non-JSON values (functions or computed objects); edit it in Files.`);
            if (after.length !== before.length) problems.push('Card count changed.');
        }
        else
        {
            if (at >= 0) problems.push(`Card ${id} already exists in evaluated ${options.exportName}.`);
            if (after.length !== before.length + 1) problems.push('Append did not add exactly one card.');
        }
        if (problems.length) return problems;
        const target = options.mode === 'replace' ? at : before.length;
        if (canonicalJson(after[target]) !== draft) problems.push(`Evaluated card ${id} differs from the reviewed draft.`);
        for (let index = 0; index < before.length; index += 1) if (index !== target && canonicalJson(before[index]) !== canonicalJson(after[index])) problems.push(`Card ${before[index]?.id ?? index} changed unexpectedly.`);
        return problems;
    }
    if (adapter === 'combatantStage')
    {
        const before = evaluated.before, after = evaluated.after;
        const stage = before?.ui?.combatantStage;
        if (!plainRecord(stage) || !plainRecord(after?.ui?.combatantStage)) return ['Evaluated balance.ui.combatantStage missing.'];
        if (canonicalJson(after.ui.combatantStage) !== canonicalJson({...stage, ...options.stage})) problems.push('Evaluated combatantStage differs from the reviewed draft.');
        const strip = value => ({...value, ui: {...value.ui, combatantStage: null}});
        if (canonicalJson(strip(before)) !== canonicalJson(strip(after))) problems.push('Other balance values changed unexpectedly.');
        return problems;
    }
    return ['Unsupported native source adapter.'];
}
