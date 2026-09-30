import {useMemo, useRef, useState} from 'react';
import {download, JsonEditor, Notice} from './Controls.jsx';
import {emptyGameSettings, exportGameSettings, KNOWN_SETTINGS, parseGameSettings, removeGameOverride, SETTINGS_LIMIT, setGameOverride, validateGameSettings} from './game-settings.mjs';
import {LocalSettingsPromotion} from './LocalSettingsPromotion.jsx';

const SOURCE = 'https://github.com/cehinds/AshenSpire/blob/38166cb12a2d8901fce7727aca37cd8d2e7e4b2d';

export function GameSettings({ctx})
{
    const value = useMemo(() => ctx.p.gameSettings ?? emptyGameSettings(), [ctx.p.gameSettings]);
    const [mode, setMode] = useState('Overrides');
    const [error, setError] = useState('');
    const [key, setKey] = useState('');
    const [json, setJson] = useState('1');
    const [known, setKnown] = useState('');
    const input = useRef(null);
    function apply(next, label)
    {
        const issues = validateGameSettings(next);
        if (issues.length) {setError(issues.join('; ')); return;}
        ctx.update(project => {project.gameSettings = next;}, label || 'Native settings draft updated');
        setError('');
    }
    async function importFile(event)
    {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        try
        {
            if (file.size > SETTINGS_LIMIT) throw new Error('Settings file must be at most 1 MiB.');
            apply(parseGameSettings(await file.text()), 'Native settings imported into authoring draft');
        }
        catch (problem) {setError(problem.message);}
    }
    function edit(entryKey)
    {
        setKey(entryKey);
        setJson(JSON.stringify(value.overrides[entryKey], null, 2));
        setKnown('');
        requestAnimationFrame(() => document.querySelector('[aria-label="Native override key"]')?.focus());
    }
    return <section className="padded" aria-label="Native game settings">
        <h2>Game settings / native JSON</h2>
        <Notice>Native envelope: schemaVersion 1 / game “Ashen Spire”. Structural validation only; actual game importer checks supported keys, ranges, migrations, and cross-setting rules. Authoring draft stays separate from checkout builds.</Notice>
        <div className="button-row"><button onClick={() => input.current.click()}>Import native settings JSON</button><button className="primary" onClick={() => {try {download('AshenSpire-settings.json', exportGameSettings(value)); ctx.tell('Native settings JSON exported');} catch (problem) {setError(problem.message);}}}>Export native settings JSON</button><span>{Object.keys(value.overrides).length} overrides</span></div>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={importFile}/>
        {error ? <div role="alert"><Notice tone="error">{error} Last valid settings remain active.</Notice></div> : null}
        <div className="button-row" aria-label="Game settings views">{['Overrides', 'JSON', 'Compatibility'].map(name => <button key={name} aria-pressed={mode === name} onClick={() => setMode(name)}>{name}</button>)}</div>
        {mode === 'JSON' ? <JsonEditor value={value} validate={validateGameSettings} onApply={next => apply(next, 'Reviewed native settings JSON applied to draft')}/> : mode === 'Compatibility' ? <>
            <h3>Import and runtime boundaries</h3>
            <p>Export preserves build metadata, statRows, ratingsVersion, promotionOwned, and unknown JSON metadata. New empty profile uses current statRows 7; older imported stamps remain unchanged for native migrations.</p>
            <p>promotionOwned identifies defaults owned by promotion. Editing an override does not rewrite ownership metadata. Inspect or edit ownership in JSON view when needed.</p>
            <div className="table-scroll"><table><thead><tr><th>Group</th><th>Native timing / restriction</th><th>Source</th></tr></thead><tbody>
                <tr><td>Balance and character rules</td><td>Generally projected into new run. Native notes define exceptions and inert fields.</td><td><a target="_blank" rel="noreferrer" href={SOURCE+'/src/model/advancedConfig.js'}>advancedConfig.js</a></td></tr>
                <tr><td>Experience gains</td><td>Applicable experience keys update future gains in current run after native import.</td><td><a target="_blank" rel="noreferrer" href={SOURCE+'/src/model/advancedConfig.js'}>isLiveXpSetting</a></td></tr>
                <tr><td>Device and local art</td><td>uiScale, textSize, tapFloor, fullscreen, quickNav, armamentsPhonePlacement are per-device; artQuality is always local-only. Default promotion omits these.</td><td><a target="_blank" rel="noreferrer" href={SOURCE+'/src/model/settingsSync.js'}>settingsSync.js</a></td></tr>
                <tr><td>Source defaults</td><td>Native promotion validates entire profile, replaces promoted defaults, then requires rebuild.</td><td><a target="_blank" rel="noreferrer" href={SOURCE+'/tools/settings-defaults.mjs'}>settings-defaults.mjs</a></td></tr>
            </tbody></table></div>
        </> : <>
            <form onSubmit={event => {event.preventDefault(); try {apply(setGameOverride(value, key, json));} catch (problem) {setError(problem.message);}}}>
                <label className="field">Known source key<select value={known} onChange={event => {const row = KNOWN_SETTINGS.find(item => item.key === event.target.value); setKnown(event.target.value); if (row) {setKey(row.key); setJson(JSON.stringify(row.value));}}}><option value="">Custom key / import from game</option>{KNOWN_SETTINGS.map(row => <option key={row.key} value={row.key}>{row.group} / {row.label}</option>)}</select></label>
                {known ? <p>{KNOWN_SETTINGS.find(row => row.key === known)?.note} <a target="_blank" rel="noreferrer" href={SOURCE+'/'+KNOWN_SETTINGS.find(row => row.key === known)?.source}>Inspect native row</a></p> : null}
                <label className="field">Native override key<input aria-label="Native override key" required value={key} onChange={event => {setKey(event.target.value); setKnown('');}} placeholder="gameConfig.… or settings.…"/></label>
                <label className="field">Typed JSON value<textarea aria-label="Override JSON value" rows={3} spellCheck={false} required value={json} onChange={event => setJson(event.target.value)}/></label>
                <button className="primary" type="submit">{Object.hasOwn(value.overrides, key.trim()) ? 'Update override in draft' : 'Add override to draft'}</button>
            </form>
            <div className="table-scroll" style={{marginTop: 22}}><table><thead><tr><th>Native key</th><th>JSON value</th><th>Actions</th></tr></thead><tbody>{Object.entries(value.overrides).map(([entryKey, entryValue]) => <tr key={entryKey}><td><code>{entryKey}</code></td><td><code>{JSON.stringify(entryValue)}</code></td><td><button onClick={() => edit(entryKey)}>Edit</button> <button onClick={() => apply(removeGameOverride(value, entryKey), 'Native override removed from draft')}>Remove</button></td></tr>)}</tbody></table></div>
            {!Object.keys(value.overrides).length ? <p style={{marginTop: 16}}>Empty overrides inherit game defaults. Add known key or import actual game export.</p> : null}
        </>}
        <LocalSettingsPromotion value={value} ctx={ctx}/>
    </section>;
}
