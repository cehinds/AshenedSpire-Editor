import {useCallback, useEffect, useRef, useState} from 'react';
import {useAuth} from './AuthGate.jsx';
import './local-branches.css';

const API = '/api/workbench';

export function LocalBranches({repoId, disabled = false, dirty = false, onChanged})
{
    const auth = useAuth();
    const available = (auth?.localAccess === true || auth?.authenticated === true) && auth?.offline !== true && Boolean(repoId);
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState('');
    const [name, setName] = useState('');
    const [source, setSource] = useState('');
    const [switchAfter, setSwitchAfter] = useState(true);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [removeReview, setRemoveReview] = useState(null);
    const token = useRef('');
    const requests = useRef(new Set());
    const generation = useRef(0);
    const changed = useRef(onChanged);

    useEffect(() => {changed.current = onChanged;}, [onChanged]);

    const request = useCallback(async (route, method = 'GET', body) =>
    {
        if (!available) throw new Error('Connect the local editor host before managing branches.');
        const controller = new AbortController();
        requests.current.add(controller);
        const timeout = setTimeout(() => controller.abort(), 20000);
        try
        {
            const response = await fetch(API + route, {
                method,
                credentials: 'same-origin',
                signal: controller.signal,
                headers: {'Accept': 'application/json', ...(method !== 'GET' ? {'Content-Type': 'application/json', 'X-Workbench-CSRF': token.current} : {})},
                ...(body === undefined ? {} : {body: JSON.stringify(body)})
            });
            if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Local branch host unavailable.');
            const result = await response.json();
            if (!response.ok)
            {
                if (response.status === 401) window.dispatchEvent(new CustomEvent('workbench-auth-expired'));
                throw new Error(result.error || `Local branch request failed (${response.status}).`);
            }
            return result;
        }
        finally {clearTimeout(timeout); requests.current.delete(controller);}
    }, [available]);

    const refresh = useCallback(async () =>
    {
        const id = generation.current;
        setBusy('refresh');
        setError('');
        try
        {
            const [status, branches] = await Promise.all([request('/status'), request(`/repos/${encodeURIComponent(repoId)}/branches`)]);
            if (id !== generation.current) return;
            if (!Array.isArray(branches.branches)) throw new Error('Local host returned invalid branch list.');
            token.current = status.csrfToken;
            setData(branches);
            setSelected(previous => branches.branches.some(branch => branch.name === previous) ? previous : branches.current || '');
            setSource(previous => branches.branches.some(branch => branch.name === previous) ? previous : branches.current || '');
        }
        catch (problem) {if (id === generation.current && problem.name !== 'AbortError') setError(problem.message);}
        finally {if (id === generation.current) setBusy('');}
    }, [repoId, request]);

    useEffect(() =>
    {
        generation.current++;
        setData(null); setSelected(''); setSource(''); setRemoveReview(null); setMessage('');
        if (available && !disabled) refresh();
        return () => {generation.current++; for (const controller of requests.current) controller.abort(); requests.current.clear();};
    }, [available, disabled, refresh]);

    async function mutate(action, body)
    {
        if (busy || disabled || data?.busy || !available) return;
        const id = generation.current;
        setBusy(action); setError(''); setMessage('');
        try
        {
            const path = `/repos/${encodeURIComponent(repoId)}/branches${action === 'switch' ? '/switch' : ''}`;
            const result = await request(path, action === 'delete' ? 'DELETE' : 'POST', body);
            if (id !== generation.current) return;
            setData(result); setSelected(result.current || ''); setSource(result.current || ''); setRemoveReview(null);
            if (action === 'create') setName('');
            setMessage(action === 'delete' ? `Deleted local branch ${body.name}.` : action === 'switch' || body.switch ? `Current local branch: ${result.current}. Rebuild to verify branch outputs.` : `Created local branch ${body.name}; checkout stays on ${result.current}.`);
            try {await changed.current?.(result.repo, result);}
            catch {if (id === generation.current) setError('Branch change applied. Refresh repository views to reload files and build status.');}
        }
        catch (problem)
        {
            if (id === generation.current && problem.name !== 'AbortError')
            {
                setError(problem.message);
                try {const latest = await request(`/repos/${encodeURIComponent(repoId)}/branches`); if (id === generation.current) setData(latest);} catch {}
            }
        }
        finally {if (id === generation.current) setBusy('');}
    }

    const chosen = data?.branches?.find(branch => branch.name === selected);
    const locked = disabled || busy !== '' || data?.busy === true || !available || !data;
    const switchLocked = locked || dirty || data?.dirty === true;

    return <section className="local-branches" aria-label="Local source-control branches">
        <div className="local-branches-heading">
            <div><h3>Local branches</h3><p>Isolated checkout only. Source directory stays unchanged.</p></div>
            <button type="button" disabled={!available || disabled || Boolean(busy)} onClick={refresh}>Refresh branches</button>
        </div>
        {!available || disabled ? <p className="local-branches-note">Select an imported local checkout to manage branches through the local editor host.</p> : null}
        {error ? <p className="local-branches-error" role="alert">{error}</p> : null}
        {message ? <p className="local-branches-message" role="status">{message}</p> : null}
        {busy ? <p role="status">{busy === 'refresh' ? 'Reading local branches…' : 'Applying local branch change…'}</p> : null}
        {data ? <>
            <p>Current branch: <strong>{data.current || 'Detached HEAD'}</strong></p>
            {dirty ? <p className="local-branches-note">Save or discard editor buffer before switching branches.</p> : data.dirty ? <p className="local-branches-note">Checkout has local changes. Commit or resolve changes before switching. No automatic stash or discard.</p> : null}
            <div className="local-branches-existing">
                <label>Local branch<select value={selected} disabled={locked} onChange={event => {setSelected(event.target.value); setRemoveReview(null);}}>
                    {!data.branches.length ? <option value="">No local branches</option> : null}
                    {data.branches.map(branch => <option key={branch.name} value={branch.name}>{branch.name}{branch.current ? ' · current' : ''}{branch.protected ? ' · protected' : ''}</option>)}
                </select></label>
                <button type="button" disabled={switchLocked || !chosen || chosen.current} onClick={() => mutate('switch', {name: selected})}>Switch branch</button>
                <button type="button" disabled={locked || !chosen || chosen.current || chosen.protected} onClick={() => setRemoveReview(selected)}>Review deletion</button>
            </div>
            <form className="local-branches-create" onSubmit={event => {event.preventDefault(); mutate('create', {name: name.trim(), ...(source ? {from: source} : {}), switch: switchAfter});}}>
                <label>New branch name<input required maxLength={150} value={name} placeholder="feature/card-editing" disabled={locked} onChange={event => setName(event.target.value)}/></label>
                <label>Create from<select value={source} disabled={locked} onChange={event => setSource(event.target.value)}>
                    {!data.current ? <option value="">Current HEAD</option> : null}
                    {data.branches.map(branch => <option key={branch.name} value={branch.name}>{branch.name}</option>)}
                </select></label>
                <label className="local-branches-checkbox"><input type="checkbox" checked={switchAfter} disabled={locked} onChange={event => setSwitchAfter(event.target.checked)}/>Switch after creation</label>
                <button type="submit" disabled={locked || !name.trim() || switchAfter && switchLocked}>Create branch</button>
            </form>
            {removeReview ? <div className="local-branches-review" role="group" aria-label="Review local branch deletion">
                <p>Delete local branch <strong>{removeReview}</strong>? Git refuses deletion while commits remain unmerged. Current branch and main/test/dev stay protected.</p>
                <button type="button" disabled={locked} onClick={() => mutate('delete', {name: removeReview})}>Delete merged local branch</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => setRemoveReview(null)}>Keep branch</button>
            </div> : null}
            <details><summary>Branch restrictions</summary><ul>{(data.restrictions || []).map(rule => <li key={rule}>{rule}</li>)}</ul></details>
        </> : null}
    </section>;
}
