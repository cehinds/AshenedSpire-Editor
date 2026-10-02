import {useEffect, useState} from 'react';
import {BALANCE_SOURCE, CARD_SOURCE_FILES, cardArrayNames, combatantStageProblems, scanCardSource} from './native-js-source.mjs';
import {normalizeLab} from './battlefield-lab.mjs';
import {assignments} from './data.js';

const classFile = card => CARD_SOURCE_FILES.find(file => file.endsWith(`/${card.class}.js`)) || CARD_SOURCE_FILES.find(file => file.endsWith('/colorless.js'));

/** Card and battlefield-stage adapters: JS-literal splice reviewed and verified by the local host. */
export function NativeSourcePanel({ctx, adapter, repoId, request, busy, action, setMessage})
{
    const [scan, setScan] = useState(null);
    const [path, setPath] = useState(adapter === 'card' ? '' : BALANCE_SOURCE);
    const [exportName, setExportName] = useState('');
    const [review, setReview] = useState(null);
    const card = ctx.card;
    const stage = normalizeLab(ctx.p.lab).stage;
    const draftKey = adapter === 'card' ? JSON.stringify(card) : JSON.stringify(stage);
    useEffect(() => {setScan(null); setReview(null); if (adapter === 'card') setPath('');}, [repoId, card.id, adapter]);
    useEffect(() => {setReview(null);}, [path, exportName]);
    const file = scan?.files.find(entry => entry.path === path);
    const elsewhere = scan?.files.filter(entry => entry.path !== path && entry.ids.includes(card.id)) || [];
    let ids = file?.ids || [];
    try {if (file && exportName) ids = scanCardSource(file.content, exportName).ids;} catch {ids = [];}
    const mode = file ? (ids.includes(card.id) ? 'replace' : 'append') : null;
    const stageProblems = adapter === 'combatantStage' ? combatantStageProblems(stage) : [];
    const stale = review && review.draftKey !== draftKey;

    async function locate()
    {
        const files = [], skipped = [];
        for (const candidate of CARD_SOURCE_FILES)
        {
            let current;
            try {current = await request(`/repos/${encodeURIComponent(repoId)}/file?path=${encodeURIComponent(candidate)}`);}
            catch (problem) {if (problem.name === 'AbortError') throw problem; skipped.push(candidate); continue;}
            try
            {
                const names = cardArrayNames(current.content);
                const scanned = scanCardSource(current.content, names.length > 1 ? names[0] : undefined);
                files.push({path: candidate, names, exportName: scanned.exportName, ids: scanned.ids, content: current.content});
            }
            catch (problem) {skipped.push(`${candidate} (${problem.message})`);}
        }
        if (!files.length) throw new Error('No AshenSpire card modules found under src/content/cards in this checkout.');
        setScan({files, skipped});
        const found = files.find(entry => entry.ids.includes(card.id));
        const preferred = found || files.find(entry => entry.path === classFile(card)) || files[0];
        setPath(preferred.path); setExportName(preferred.exportName);
        setMessage(found ? `${card.id} found in ${found.path}. Review to save the edited card.` : `${card.id} is new to the game. Review to add it to ${preferred.path}.`);
    }

    async function prepare()
    {
        if (adapter === 'card')
        {
            if (!file) throw new Error('Locate card modules and choose a target file first.');
            if (mode === 'append' && elsewhere.length) throw new Error(`Card ID ${card.id} already exists in ${elsewhere[0].path}. Choose that file to save it.`);
        }
        else if (!Object.keys(stage).length) throw new Error('No stage token overrides in this draft. Edit Battlefield → Stage tokens first.');
        else if (stageProblems.length) throw new Error(stageProblems.join(' '));
        const body = adapter === 'card' ? {adapter, path, card, mode, exportName: exportName || undefined} : {adapter, path, stage};
        const result = await request(`/repos/${encodeURIComponent(repoId)}/native-source/review`, {method: 'POST', body: JSON.stringify(body)});
        setReview({...result, body, draftKey});
    }

    async function save()
    {
        if (!review || stale) throw new Error('Draft changed since review. Review again before saving.');
        const result = await request(`/repos/${encodeURIComponent(repoId)}/native-source/save`, {method: 'POST', body: JSON.stringify({...review.body, revision: review.revision, expected: review.expected})});
        setReview(null);
        if (adapter === 'card')
        {
            setScan(previous => previous && {...previous, files: previous.files.map(entry => entry.path === result.path ? {...entry, content: result.content, ids: scanCardSource(result.content, entry.exportName).ids} : entry)});
            const rows = (ctx.p.tagging ?? assignments).filter(row => row.family === 'card' && row.objectId === card.id).length;
            setMessage(review.mode === 'append'
                ? `Card added to ${result.path}; evaluation verified. The game validator also needs this card's tag rows: open Tags → Tag assignments CSV and save (${rows} draft rows). Run a build or test job to check integration.`
                : `Card saved to ${result.path}; evaluation verified. Run a build or test job to check integration.`);
        }
        else setMessage(`combatantStage saved to ${result.path}; evaluation verified. Run a build or test job to check integration.`);
        ctx.tell?.('Native source saved to checkout. No commit or push.');
    }

    const verb = mode === 'append' ? 'Add card to game' : 'Save card to game';
    return <div className="native-source-panel">
        {adapter === 'card' ? <>
            <p><strong>{card.name}</strong> <code>{card.id}</code> · writes the native definition only; presentation sidecars stay in the editor export.</p>
            <div className="native-source-row">
                <button disabled={busy || !repoId} onClick={() => action(locate)}>{scan ? 'Rescan card modules' : 'Locate card modules'}</button>
                <label>Target module<select aria-label="Target card module" value={path} disabled={busy || !scan} onChange={event => {setPath(event.target.value); setExportName(scan.files.find(entry => entry.path === event.target.value)?.exportName || '');}}><option value="">{scan ? 'Choose module' : 'Locate first'}</option>{scan?.files.map(entry => <option key={entry.path} value={entry.path}>{entry.path} · {entry.exportName} · {entry.ids.length}{entry.ids.includes(card.id) ? ' · has card' : ''}</option>)}</select></label>
                {file?.names.length > 1 ? <label>Array<select aria-label="Card array" value={exportName} disabled={busy} onChange={event => setExportName(event.target.value)}>{file.names.map(name => <option key={name}>{name}</option>)}</select></label> : null}
            </div>
            {file ? <p>{mode === 'replace' ? `Replaces the ${card.id} literal in ${exportName}; the rest of the file is kept byte for byte.` : `Appends ${card.id} to ${exportName}${card.class && !path.endsWith(`/${card.class}.js`) ? ` (card class ${card.class})` : ''}.`}{elsewhere.length ? ` Also found in ${elsewhere.map(entry => entry.path).join(', ')}.` : ''}</p> : null}
            {scan?.skipped.length ? <small>Skipped: {scan.skipped.join(', ')}</small> : null}
        </> : <>
            <p><code>{BALANCE_SOURCE}</code> → <code>balance.ui.combatantStage</code>. Writes only the overridden numeric tokens; comments and other values stay as they are.</p>
            <p>{Object.keys(stage).length ? Object.entries(stage).map(([key, value]) => `${key} ${value}`).join(' · ') : 'No stage token overrides in this draft.'}</p>
            {stageProblems.map(problem => <p key={problem} className="native-bridge-error">{problem}</p>)}
        </>}
        <div className="button-row">
            <button disabled={busy || !repoId || (adapter === 'card' ? !file : !Object.keys(stage).length || stageProblems.length > 0)} onClick={() => action(prepare)}>Review {adapter === 'card' ? (mode === 'append' ? 'card addition' : 'card change') : 'stage change'}</button>
            {review ? <button className="primary" disabled={busy || stale || review.unchanged || review.before === review.after} onClick={() => action(save)}>{adapter === 'card' ? verb : 'Save stage tokens to game'}</button> : null}
        </div>
        {review ? <>
            <p role="status">{stale ? 'Draft changed since review. Review again.' : review.unchanged ? 'No change: the draft already matches the checkout value. Only source formatting would differ, so saving is disabled.' : `Verified: the host evaluated the result in an isolated Node process and it matches this draft (${review.exportName}). Revision ${review.revision.slice(0, 12)}.`}</p>
            <pre className="native-source-diff" aria-label="Reviewed source change">{review.diff || 'No change.'}</pre>
            <details><summary>Full before / after</summary><div className="native-bridge-diff"><label>Current checkout<textarea readOnly value={review.before}/></label><label>Proposed module<textarea readOnly value={review.after}/></label></div></details>
        </> : null}
    </div>;
}
