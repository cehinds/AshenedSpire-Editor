export const SETTINGS_LIMIT = 1024 * 1024;
export const SETTINGS_SOURCE = Object.freeze({repo: 'cehinds/AshenSpire', commit: '38166cb12a2d8901fce7727aca37cd8d2e7e4b2d', schemaVersion: 1, statRows: 7});

export const KNOWN_SETTINGS = Object.freeze([
    {key: 'gameConfig.presentation.playerSpriteScale', label: 'Player sprite scale', value: 1, group: 'Presentation', note: 'Native row: 0.5–2. Changes figure size; combat footprint stays unchanged.', source: 'src/model/advancedConfig.js'},
    {key: 'gameConfig.presentation.enemySpriteScale', label: 'Enemy sprite scale', value: 2, group: 'Presentation', note: 'Native row: 0.5–2. Changes figure size; targeting rules stay unchanged.', source: 'src/model/advancedConfig.js'},
    {key: 'gameConfig.presentation.settingsWidthPercent', label: 'Settings panel width', value: 100, group: 'Presentation', note: 'Native row: integer 60–100 percent of safe viewport.', source: 'src/model/advancedConfig.js'},
    {key: 'gameConfig.presentation.settingsHeightPercent', label: 'Settings panel height', value: 100, group: 'Presentation', note: 'Native row: integer 60–100 percent of safe viewport.', source: 'src/model/advancedConfig.js'},
    {key: 'gameConfig.progression.xpMultiplier', label: 'Experience gain multiplier', value: 1, group: 'Progression', note: 'Native row: 0.05–20. Applies to future experience gains after game import, including current run.', source: 'src/model/advancedConfig.js'},
    {key: 'settings.deckMinSize', label: 'Minimum deck size', value: 10, group: 'Deck', note: 'Applies to deck confirmation; gated by deckEditing and deckMinUnlimited=false. Confirm current limits in game.', source: 'src/ui/screens/settings.js'},
    {key: 'settings.deckMaxUnlimited', label: 'No maximum deck size', value: true, group: 'Deck', note: 'Applies to deck confirmation; gated by deckEditing.', source: 'src/ui/screens/settings.js'},
    {key: 'settings.uiScale', label: 'Interface scale', value: 'Auto', group: 'Device', note: 'Per-device key; excluded from profile synchronization and default promotion unless native synchronization explicitly includes devices.', source: 'src/ui/screens/settings.js'}
]);

export function emptyGameSettings()
{
    return {schemaVersion: 1, game: 'Ashen Spire', build: {}, statRows: 7, overrides: {}};
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateGameSettingsOptional(value)
{
    if (value === undefined) return [];
    return validateGameSettings(value);
}

export function validateGameSettings(value)
{
    const issues = [];
    if (!record(value)) return ['Game settings must be a native JSON object.'];
    if (value.schemaVersion !== 1) issues.push('Native settings schemaVersion must be 1.');
    if (value.game !== 'Ashen Spire') issues.push('Native game identifier must be "Ashen Spire".');
    if (!record(value.overrides)) issues.push('Native overrides must be an object.');
    if (value.build !== undefined && !record(value.build)) issues.push('build metadata must be an object.');
    for (const name of ['statRows', 'ratingsVersion'])
    {
        if (value[name] !== undefined && (!Number.isInteger(value[name]) || value[name] < 1)) issues.push(name + ' metadata must be a positive integer.');
    }
    if (value.promotionOwned !== undefined && (!Array.isArray(value.promotionOwned) || value.promotionOwned.some(key => typeof key !== 'string'))) issues.push('promotionOwned metadata must be an array of setting keys.');
    if (record(value.overrides) && Object.keys(value.overrides).some(key => !key.trim())) issues.push('Override keys must not be blank.');
    try
    {
        let count = 0;
        const seen = new Set();
        function inspect(item, depth)
        {
            if (++count > 20000 || depth > 32) throw new Error('Game settings JSON exceeds supported depth or item count.');
            if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
            if (typeof item === 'number' && Number.isFinite(item)) return;
            if (typeof item !== 'object') throw new Error('Game settings must contain JSON values only.');
            if (seen.has(item)) throw new Error('Game settings must not contain cycles.');
            if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new Error('Game settings must contain plain JSON objects.');
            seen.add(item);
            Object.values(item).forEach(child => inspect(child, depth + 1));
            seen.delete(item);
        }
        inspect(value, 0);
        if (new TextEncoder().encode(JSON.stringify(value)).length > SETTINGS_LIMIT) issues.push('Settings JSON must be at most 1 MiB.');
    }
    catch (error) {issues.push(error.message);}
    return issues;
}

export function parseGameSettings(text)
{
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > SETTINGS_LIMIT) throw new Error('Settings JSON must be at most 1 MiB.');
    let value;
    try {value = JSON.parse(text);} catch {throw new Error('Settings file is not valid JSON.');}
    const issues = validateGameSettings(value);
    if (issues.length) throw new Error(issues.join('; '));
    return value;
}

export function exportGameSettings(value)
{
    const issues = validateGameSettings(value);
    if (issues.length) throw new Error(issues.join('; '));
    const text = JSON.stringify(value, null, 2) + '\n';
    if (new TextEncoder().encode(text).length > SETTINGS_LIMIT) throw new Error('Formatted settings export exceeds 1 MiB. Reduce profile before exporting.');
    return text;
}

export function setGameOverride(value, key, json)
{
    if (typeof key !== 'string' || !key.trim()) throw new Error('Enter a native override key.');
    let parsed;
    try {parsed = JSON.parse(json);} catch {throw new Error('Override value must be valid JSON: number, boolean, quoted string, array, object, or null.');}
    const next = structuredClone(value);
    Object.defineProperty(next.overrides, key.trim(), {value: parsed, enumerable: true, writable: true, configurable: true});
    const issues = validateGameSettings(next);
    if (issues.length) throw new Error(issues.join('; '));
    return next;
}

export function removeGameOverride(value, key)
{
    const next = structuredClone(value);
    delete next.overrides[key];
    return next;
}
