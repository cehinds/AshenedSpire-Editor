import {useEffect, useRef, useState} from 'react';
import {useLocalHost} from './AuthGate.jsx';
import {Notice} from './Controls.jsx';
import {validateGameSettings} from './game-settings.mjs';

export function LocalSettingsPromotion({value, ctx})
{
    const localHost = useLocalHost();
    const allowed = localHost?.connected === true && !localHost.offline;
    const [host, setHost] = useState(null);
    const [repos, setRepos] = useState([]);
    const [repoId, setRepoId] = useState('');
    const [git, setGit] = useState(null);
    const [reviewed, setReviewed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [job, setJob] = useState(null);
    const alive = useRef(true);
    const selectionGeneration = useRef(0);
    const requests = useRef(new Set());
    const repo = repos.find(item => item.id === repoId);
    const canPromote = allowed && repo?.kind === 'local' && repo?.status === 'connected' && git?.canPromoteSettings === true;

    useEffect(() =>
    {
        alive.current = true;
        return () => {alive.current = false; requests.current.forEach(controller => controller.abort());};
    }, []);
    useEffect(() => {setReviewed(false);}, [value, repoId]);
    useEffect(() =>
    {
        // A renewed browser session may belong to a restarted host. Require fresh
        // target inspection and review before any settings write with a new token.
        selectionGeneration.current += 1;
        setHost(null); setGit(null); setReviewed(false);
        requests.current.forEach(controller => controller.abort());
    }, [allowed, localHost?.connectionId]);

    async function request(path, options = {})
    {
        if (!allowed) throw new Error('Local editor host required.');
        const controller = new AbortController();
        requests.current.add(controller);
        try
        {
            const response = await fetch('/api/workbench' + path, {...options, signal: controller.signal, headers: {'Accept': 'application/json', ...(options.body ? {'Content-Type': 'application/json', 'X-Workbench-CSRF': host?.csrfToken || ''} : {})}});
            if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Local editor host unavailable.');
            const result = await response.json();
            if (!response.ok)
            {
                if (response.status === 401) window.dispatchEvent(new CustomEvent('workbench-host-disconnected'));
                throw new Error(result.error || `Local request failed (${response.status}).`);
            }
            return result;
        }
        finally {requests.current.delete(controller);}
    }

    async function load()
    {
        if (busy) return;
        setBusy(true); setError(''); setGit(null); setReviewed(false);
        const generation = ++selectionGeneration.current;
        try
        {
            const status = await request('/status');
            const result = await request('/repos');
            if (!alive.current || generation !== selectionGeneration.current) return;
            setHost(status);
            setRepos(result.repos.filter(repo => repo.kind === 'local'));
            setRepoId('');
        }
        catch (problem) {if (alive.current && problem.name !== 'AbortError') setError(problem.message);}
        finally {if (alive.current) setBusy(false);}
    }

    async function select(id)
    {
        setRepoId(id); setGit(null); setReviewed(false); setError('');
        const generation = ++selectionGeneration.current;
        if (!id) return;
        try
        {
            const result = await request(`/repos/${encodeURIComponent(id)}/git`);
            if (alive.current && generation === selectionGeneration.current) setGit(result);
        }
        catch (problem) {if (alive.current && generation === selectionGeneration.current && problem.name !== 'AbortError') setError(problem.message);}
    }

    async function promote()
    {
        if (busy || !reviewed || !canPromote) return;
        const issues = validateGameSettings(value);
        if (issues.length) {setError(issues.join('; ')); return;}
        setBusy(true); setError('');
        try
        {
            const result = await request(`/repos/${encodeURIComponent(repoId)}/jobs`, {method: 'POST', body: JSON.stringify({task: 'settings', profile: value})});
            if (!result.job?.id) throw new Error('Local host returned no settings job.');
            if (alive.current) {setJob(result.job); setReviewed(false); ctx.tell('Native settings promotion started; inspect real job log.');}
        }
        catch (problem) {if (alive.current && problem.name !== 'AbortError') setError(problem.message);}
        finally {if (alive.current) setBusy(false);}
    }

    useEffect(() =>
    {
        if (!allowed || !job?.id || !['running', 'queued'].includes(job.status)) return;
        let active = true, timer;
        async function poll()
        {
            try
            {
                const result = await request('/jobs');
                if (!active || !alive.current) return;
                const next = result.jobs.find(item => item.id === job.id);
                if (!next) {setError('Job no longer available. Host job history resets on restart; inspect checkout before retry.'); return;}
                setJob(next);
                if (['running', 'queued'].includes(next.status)) timer = setTimeout(poll, 1500);
            }
            catch (problem) {if (active && alive.current && problem.name !== 'AbortError') setError(problem.message);}
        }
        timer = setTimeout(poll, 500);
        return () => {active = false; clearTimeout(timer);};
    }, [job?.id, job?.status, allowed, host?.csrfToken]);

    return <section style={{marginTop: 30, borderTop: '1px solid var(--line)', paddingTop: 22}} aria-label="Local settings promotion">
        <h3>Promote native settings into local game defaults</h3>
        <Notice>Native tool validates profile, replaces <code>src/content/settingsDefaults.js</code> in selected isolated checkout, and excludes device/local-only settings. Empty overrides clear promoted defaults. Build game afterwards; browser draft export alone does not change builds.</Notice>
        {!allowed ? <p>Local editor host required. Offline preview supports JSON authoring and exports.</p> : <>
            <button disabled={busy || job?.status === 'running'} onClick={load}>{busy ? 'Working…' : 'Find local checkouts'}</button>
            <label className="field">Target checkout<select value={repoId} disabled={busy || !host || job?.status === 'running'} onChange={event => select(event.target.value)}><option value="">Select connected game checkout</option>{repos.filter(item => item.status === 'connected').map(item => <option key={item.id} value={item.id}>{item.name} / {item.branch || 'current branch'}</option>)}</select></label>
            {repo && git && !canPromote ? <Notice tone="warning">Checkout does not advertise native settings promotion. Connect AshenSpire checkout containing <code>tools/settings-defaults.mjs</code>.</Notice> : null}
            {canPromote ? <><p>Target: <strong>{repo.name}</strong> / {git.branch || repo.branch} / {git.head?.slice(0, 10)}. {Object.keys(value.overrides).length} submitted overrides replace promoted defaults.</p><label className="check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} disabled={busy || job?.status === 'running'}/>I reviewed profile JSON and target checkout. Replace promoted defaults; rebuild required.</label><button className="primary" disabled={!reviewed || busy || job?.status === 'running'} onClick={promote}>Promote reviewed settings into checkout</button></> : null}
        </>}
        {error ? <div role="alert" style={{marginTop: 16}}><Notice tone="error">{error}</Notice></div> : null}
        {job ? <div style={{marginTop: 18}}><p role="status">Native settings job: <strong>{job.status}</strong>{job.exitCode !== undefined ? ` / exit ${job.exitCode}` : ''}</p><pre aria-label="Settings promotion job log">{job.log || 'Waiting for tool output…'}</pre>{job.status === 'succeeded' ? <Notice tone="good">Native promotion finished. Inspect changed defaults in Files, then Build game to include them.</Notice> : null}<div className="button-row"><button onClick={() => ctx.setMode?.('Files')}>Inspect checkout files</button><button onClick={() => ctx.setMode?.('Builds')}>Open builds and all job logs</button></div></div> : null}
    </section>;
}
