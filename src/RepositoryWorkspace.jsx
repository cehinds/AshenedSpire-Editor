import {useCallback, useEffect, useRef, useState} from 'react';
import {useLocalHost} from './AuthGate.jsx';
import './repository.css';
import {LocalBranches} from './LocalBranches.jsx';

const API = '/api/workbench';
const localRepos = repos => repos.filter(repo => repo.kind === 'local');

export function RepositoryWorkspace({mode, ctx = {}})
{
    const localHost = useLocalHost();
    const offline = localHost?.offline === true;
    const hostAvailable = localHost?.connected === true;
    const [host, setHost] = useState(null);
    const [repos, setRepos] = useState([]);
    const [repoId, setRepoId] = useState(ctx.repositorySelection || '');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [url, setUrl] = useState('');
    const [branch, setBranch] = useState('');
    const [trees, setTrees] = useState({});
    const [expanded, setExpanded] = useState(new Set(['']));
    const [treeBusy, setTreeBusy] = useState('');
    const [file, setFile] = useState(null);
    const [text, setText] = useState('');
    const [git, setGit] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [currentArtifacts, setCurrentArtifacts] = useState({artifacts: [], reason: 'Checking verified build outputs…'});
    const [jobError, setJobError] = useState('');
    const [pending, setPending] = useState(null);
    const [installReview, setInstallReview] = useState(false);
    const [preview, setPreview] = useState(null);
    const alive = useRef(true);
    const requests = useRef(new Set());
    const navigationGeneration = useRef(0);
    const loadedRepoId = useRef(null);
    const dirty = file !== null && text !== file.content;
    const repo = repos.find(item => item.id === repoId);
    const connected = hostAvailable && !offline && host?.connected === true;
    const ready = connected && repo?.status === 'connected';

    const request = useCallback(async (path, options = {}) =>
    {
        if (offline) throw new Error('Local editor host required. Offline preview supports authoring drafts only.');
        const controller = new AbortController();
        requests.current.add(controller);
        try
        {
            const response = await fetch(API + path, {
                ...options,
                signal: controller.signal,
                headers: {'Accept': 'application/json', ...(options.body ? {'Content-Type': 'application/json', 'X-Workbench-CSRF': host?.csrfToken || ''} : {}), ...options.headers}
            });
            const type = response.headers.get('content-type') || '';
            if (!type.includes('application/json')) throw new Error('Local repository host unavailable. Open workbench through its local host to connect repositories.');
            const value = await response.json();
            if (!response.ok)
            {
                if (response.status === 401) window.dispatchEvent(new CustomEvent('workbench-host-disconnected'));
                const problem = new Error(value.error || `Host request failed (${response.status}).`);
                problem.status = response.status;
                throw problem;
            }
            return value;
        }
        finally { requests.current.delete(controller); }
    }, [host?.csrfToken, offline]);
    const requestRef = useRef(request);
    requestRef.current = request;

    const guard = useCallback(next =>
    {
        if (dirty) setPending(() => next);
        else next();
    }, [dirty]);

    useEffect(() =>
    {
        if (ctx.repoGuardRef) ctx.repoGuardRef.current = guard;
        ctx.repoDirty?.(dirty);
        const onExit = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', onExit);
        return () => { window.removeEventListener('beforeunload', onExit); };
    }, [guard, dirty, ctx.repoGuardRef, ctx.repoDirty]);

    useEffect(() =>
    {
        alive.current = true;
        return () =>
        {
            alive.current = false;
            requests.current.forEach(controller => controller.abort());
            if (ctx.repoGuardRef) ctx.repoGuardRef.current = null;
            ctx.repoDirty?.(false);
        };
    }, []);

    useEffect(() =>
    {
        let active = true;
        if (!hostAvailable || offline)
        {
            setHost(null);
            setLoading(false);
            if (offline) setError('Local editor host required. Offline preview supports authoring drafts only.');
            return;
        }
        setHost(null);
        setLoading(true);
        setError('');
        async function load()
        {
            try
            {
                const status = await requestRef.current('/status');
                if (!status.connected || !status.capabilities?.includes('repositories')) throw new Error('Repository host does not support repository connections.');
                if (!active || !alive.current) return;
                setHost(status);
                const value = await requestRef.current('/repos');
                if (!active || !alive.current) return;
                setRepos(localRepos(value.repos));
                setRepoId(previous => localRepos(value.repos).some(item => item.id === previous) ? previous : localRepos(value.repos)[0]?.id || '');
            }
            catch (problem) { if (active && alive.current && problem.name !== 'AbortError') { setHost(null); setError(problem.message); } }
            finally { if (active && alive.current) setLoading(false); }
        }
        load();
        return () =>
        {
            active = false;
            requests.current.forEach(controller => controller.abort());
        };
    }, [hostAvailable, offline, localHost?.connectionId]);

    useEffect(() =>
    {
        if (!ready) { setGit(null); return; }
        let active = true;
        request(`/repos/${encodeURIComponent(repoId)}/git`).then(value => { if (active) setGit(value); }).catch(problem => { if (active && problem.name !== 'AbortError') setError(problem.message); });
        return () => { active = false; };
    }, [repoId, ready, request]);

    useEffect(() =>
    {
        if (!connected || !host.capabilities?.includes('builds')) return;
        let active = true;
        let timer;
        async function poll()
        {
            const results = await Promise.allSettled([
                request('/jobs'),
                ...(ready ? [request(`/repos/${encodeURIComponent(repoId)}/artifacts`)] : [])
            ]);
            if (!active) return;
            const jobResult = results[0];
            if (jobResult.status === 'fulfilled') { setJobs(jobResult.value.jobs); setJobError(''); }
            else if (jobResult.reason.name !== 'AbortError') setJobError(jobResult.reason.message);
            const artifactResult = results[1];
            if (artifactResult?.status === 'fulfilled') setCurrentArtifacts(artifactResult.value);
            else if (artifactResult?.status === 'rejected' && artifactResult.reason.name !== 'AbortError')
            {
                setCurrentArtifacts({artifacts: [], reason: artifactResult.reason.message});
            }
            if (active) timer = setTimeout(poll, 2500);
        }
        poll();
        return () => { active = false; clearTimeout(timer); };
    }, [connected, host, request, repoId, ready]);

    async function loadTree(path = '', generation = navigationGeneration.current)
    {
        setTreeBusy(path || '/');
        try
        {
            const value = await request(`/repos/${encodeURIComponent(repoId)}/tree?path=${encodeURIComponent(path)}`);
            if (generation === navigationGeneration.current && alive.current) setTrees(old => ({...old, [path]: value.entries}));
        }
        catch (problem) { if (generation === navigationGeneration.current && problem.name !== 'AbortError') setError(problem.message); }
        finally { if (generation === navigationGeneration.current) setTreeBusy(''); }
    }

    useEffect(() =>
    {
        if (loadedRepoId.current !== repoId)
        {
            loadedRepoId.current = repoId;
            setTrees({}); setExpanded(new Set([''])); setFile(null); setText(''); if (hostAvailable && !offline) setError(''); setMessage('');
        }
        setPreview(null); setCurrentArtifacts({artifacts: [], reason: 'Checking verified build outputs…'});
        navigationGeneration.current += 1;
        if (ready && host.capabilities?.includes('files')) loadTree('');
    }, [repoId, ready]);

    async function action(key, task)
    {
        if (busy) return;
        setBusy(key); setError(''); setMessage('');
        try { await task(); }
        catch (problem) { if (problem.name !== 'AbortError') setError(key === 'save' && problem.status === 409 && /revision|changed|stale/i.test(problem.message) ? 'Checkout file changed since opened. Your edits remain here. Reload current file before saving again; copy edits first if needed.' : problem.message); }
        finally { if (alive.current) setBusy(''); }
    }

    async function refreshRepos()
    {
        const value = await request('/repos');
        setRepos(localRepos(value.repos));
    }

    async function branchChanged(updated)
    {
        const switched = updated?.branch !== repo?.branch;
        await refreshRepos();
        const value = await request(`/repos/${encodeURIComponent(repoId)}/git`);
        setGit(value);
        if (switched)
        {
            navigationGeneration.current += 1;
            setTrees({}); setExpanded(new Set([''])); setFile(null); setText(''); setPreview(null);
            setCurrentArtifacts({artifacts: [], reason: 'Branch changed. Run a successful build to verify current outputs.'});
            await loadTree('');
        }
    }

    function selectRepo(id)
    {
        guard(() => { navigationGeneration.current += 1; setRepoId(id); ctx.setRepositorySelection?.(id); setInstallReview(false); });
    }

    function openRepositoryMode(id, nextMode)
    {
        // Review the entire navigation once, preserving pending repository selection.
        ctx.openWorkspace('project', nextMode, () => {
            navigationGeneration.current += 1;
            setRepoId(id);
            ctx.setRepositorySelection?.(id);
            setInstallReview(false);
        });
    }

    function loadFile(path)
    {
        action('file', async () =>
        {
            const generation = navigationGeneration.current;
            const value = await request(`/repos/${encodeURIComponent(repoId)}/file?path=${encodeURIComponent(path)}`);
            if (generation !== navigationGeneration.current) return;
            setFile(value); setText(value.content); setMessage('Checkout file loaded. Edits save only to local checkout.');
        });
    }

    function openFile(path)
    {
        if (file?.path === path && dirty) return;
        guard(() => loadFile(path));
    }

    async function toggleDirectory(path)
    {
        if (expanded.has(path)) setExpanded(old => { const next = new Set(old); next.delete(path); return next; });
        else
        {
            setExpanded(old => new Set([...old, path]));
            if (!trees[path]) await loadTree(path);
        }
    }

    function treeKey(event, entry)
    {
        const elements = [...event.currentTarget.closest('[role=tree]').querySelectorAll('[role=treeitem]')];
        const index = elements.indexOf(event.currentTarget);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); elements[Math.min(elements.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); elements[event.key === 'Home' ? 0 : elements.length - 1]?.focus(); }
        if (event.key === 'ArrowRight' && entry.type === 'directory' && !expanded.has(entry.path)) { event.preventDefault(); toggleDirectory(entry.path); }
        if (event.key === 'ArrowLeft' && entry.type === 'directory' && expanded.has(entry.path)) { event.preventDefault(); toggleDirectory(entry.path); }
    }

    function renderTree(path, depth = 0)
    {
        return (trees[path] || []).map(entry => <div key={entry.path} role="none">
            <button role="treeitem" aria-level={depth + 1} aria-expanded={entry.type === 'directory' ? expanded.has(entry.path) : undefined} aria-selected={file?.path === entry.path} className={'repo-tree-row ' + (file?.path === entry.path ? 'selected' : '')} style={{paddingLeft: 12 + depth * 18}} onKeyDown={event => treeKey(event, entry)} onClick={() => entry.type === 'directory' ? toggleDirectory(entry.path) : openFile(entry.path)} disabled={!!busy}>
                <span aria-hidden="true">{entry.type === 'directory' ? expanded.has(entry.path) ? '▾' : '▸' : '·'}</span><span>{entry.name}</span><span className="repo-entry-kind">{entry.type === 'directory' ? 'folder' : 'file'}</span>
            </button>
            {entry.type === 'directory' && expanded.has(entry.path) ? <div role="group">{treeBusy === entry.path ? <p className="repo-tree-message">Loading folder…</p> : trees[entry.path]?.length === 0 ? <p className="repo-tree-message">Empty folder</p> : renderTree(entry.path, depth + 1)}</div> : null}
        </div>);
    }

    function startJob(task, script)
    {
        action('job', async () =>
        {
            const value = await request(`/repos/${encodeURIComponent(repoId)}/jobs`, {method: 'POST', body: JSON.stringify({task, ...(script ? {script} : {})})});
            setJobs(old => [value.job, ...old.filter(item => item.id !== value.job.id)]);
            if (task === 'build') { setPreview(null); setCurrentArtifacts({artifacts: [], reason: 'Build running. Outputs unavailable until successful completion.'}); }
            setInstallReview(false); setMessage(`${task} started in local checkout. Browser authoring draft is separate.`);
        });
    }

    useEffect(() =>
    {
        if (!preview) return;
        if (preview.origin === 'current')
        {
            if (!(currentArtifacts.artifacts || []).some(artifact => artifact.url === preview.url))
            {
                setPreview(null);
                setMessage('Verified build outputs changed. Previous preview closed.');
            }
            return;
        }
        if (!preview.jobId) return;
        const previewJob = jobs.find(job => job.id === preview.jobId);
        if (previewJob?.artifactState === 'stale' || previewJob?.artifactsStale)
        {
            setPreview(null);
            setMessage('Build outputs replaced by later build. Previous preview closed.');
        }
    }, [jobs, preview, currentArtifacts]);

    const repoJobs = jobs.filter(job => job.repoId === repoId);
    const running = repoJobs.some(job => job.status === 'running');
    const scripts = Array.isArray(git?.scripts) ? git.scripts : [];
    const nativeCommands = git?.adapter === 'ashenspire-node';
    const currentJobArtifacts = repoJobs.some(job => job.status === 'succeeded' && job.artifactState !== 'stale' && !job.artifactsStale && job.artifacts?.length);

    return <section className="repository-workspace" aria-label={`${mode} workspace`}>
        <div className="repo-host-bar"><div><strong>{connected ? 'Local repository host' : loading ? 'Checking repository host…' : 'Repository host unavailable'}</strong><p>{connected ? `${host.host || 'local'} · checkout files and jobs · separate from browser draft` : 'Local checkouts, file writes, and builds require this editor’s local host.'}</p></div><span className={'repo-badge ' + (connected ? 'good' : '')}>{connected ? 'Host connected' : 'Not connected'}</span></div>
        <LocalBranches repoId={ready ? repoId : ''} disabled={!ready || !!busy || running} dirty={dirty} onChanged={branchChanged}/>
        {error ? <div role="alert" className="repo-notice error">{error}</div> : null}
        {message ? <div role="status" className="repo-notice">{message}</div> : null}
        {pending ? <div role="alert" className="repo-discard"><strong>Unsaved checkout edits</strong><p>Switching discards edits to {file?.path}. Copy text to keep separate copy.</p><div className="repo-buttons"><button onClick={() => { const next = pending; setPending(null); setText(file?.content || ''); next(); }}>Discard edits and continue</button><button className="primary" onClick={() => setPending(null)}>Keep editing</button></div></div> : null}
        {mode === 'Repositories' ? <>
            <div className="repo-section-heading"><h2>Local game repositories</h2><p>Add an existing local Git folder, then open an isolated editor checkout. No remote sign-in or network connection required.</p></div>
            <form className="repo-add-form" onSubmit={event => { event.preventDefault(); action('add', async () => { const value = await request('/repos', {method: 'POST', body: JSON.stringify({path: url.trim(), ...(branch.trim() ? {branch: branch.trim()} : {})})}); await refreshRepos(); selectRepo(value.repo.id); setUrl(''); setBranch(''); setMessage('Local repository registered. Open checkout to copy its committed files.'); }); }}>
                <label>Local Git repository folder<input value={url} onChange={event => setUrl(event.target.value)} placeholder="/absolute/path/to/game-repository" required disabled={!connected || !!busy}/></label>
                <label>Branch (optional)<input value={branch} onChange={event => setBranch(event.target.value)} placeholder="Current local branch" disabled={!connected || !!busy}/></label>
                <button className="primary" disabled={!connected || !!busy || !url.trim()}>{busy === 'add' ? 'Adding…' : 'Add repository'}</button>
            </form>
            <div className="repo-list">{repos.map(item => <article className={'repo-card ' + (item.id === repoId ? 'selected' : '')} key={item.id}>
                <div className="repo-card-top"><h3>{item.name}</h3><span className={'repo-badge ' + (item.status === 'connected' ? 'good' : '')}>{item.status}</span></div><code>{item.url}</code><p>Branch: {item.branch || 'current local branch'}{item.head ? ` · ${item.head.slice(0, 10)}` : ''}</p>{item.checkoutScope === 'game-source' ? <p>Game source checkout includes runtime assets. Large original artwork omitted.</p> : null}{item.error ? <div className="repo-notice error">{item.error}</div> : null}
                <div className="repo-buttons"><button disabled={!connected || !!busy} onClick={() => action('connect:' + item.id, async () => { const result = await request(`/repos/${encodeURIComponent(item.id)}/connect`, {method: 'POST', body: '{}'}); await refreshRepos(); selectRepo(item.id); if (result.warning || result.remoteUpdated === false) setError(result.warning || 'Local checkout remains connected.'); else setMessage(item.status === 'connected' ? 'Local checkout status refreshed; files preserved.' : 'Local repository copied. Isolated checkout ready.'); })}>{busy === 'connect:' + item.id ? item.status === 'connected' ? 'Refreshing…' : 'Copying…' : item.status === 'connected' ? 'Refresh local status' : 'Open local checkout'}</button><button disabled={!connected || !!busy} onClick={() => selectRepo(item.id)}>Select repository</button>{item.status === 'connected' ? <><button disabled={!!busy} onClick={() => openRepositoryMode(item.id, 'Files')}>Browse files</button><button disabled={!!busy} onClick={() => openRepositoryMode(item.id, 'Builds')}>Builds</button></> : null}</div>
                {connected && item.status !== 'connected' ? <BranchEditor key={item.id + item.branch} repo={item} disabled={!!busy} save={value => action('branch', async () => { await request(`/repos/${encodeURIComponent(item.id)}`, {method: 'PATCH', body: JSON.stringify({branch: value})}); await refreshRepos(); })}/> : null}
            </article>)}</div>
        </> : <>
            <div className="repo-select-row"><label>Selected repository<select value={repoId} disabled={!connected || !!busy} onChange={event => selectRepo(event.target.value)}><option value="">Select repository</option>{repos.map(item => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></label>{repo ? <span className="repo-badge">{repo.branch || 'default branch'}{git?.head ? ' · ' + git.head.slice(0, 10) : ''}</span> : null}</div>
            {repo?.checkoutScope === 'game-source' || git?.checkoutScope === 'game-source' ? <p>Game source checkout includes runtime assets. Large original artwork omitted.</p> : null}
            {!ready ? <div className="repo-empty"><h2>Open local repository first</h2><p>Files and builds use real local checkout. Add and open a local Git repository to edit saved source or build the game.</p><button onClick={() => ctx.setMode?.('Repositories')}>Local repositories</button></div> : mode === 'Files' ? !host.capabilities?.includes('files') ? <div className="repo-empty">Host file browsing unavailable.</div> : <div className="repo-files-grid">
                <aside className="repo-tree"><div className="repo-subheading"><strong>Checkout hierarchy</strong><button disabled={!!treeBusy} onClick={() => loadTree('')}>Refresh root</button></div><div role="tree" aria-label="Repository file hierarchy">{treeBusy === '/' ? <p>Loading checkout…</p> : trees['']?.length === 0 ? <p>Checkout empty.</p> : renderTree('')}</div></aside>
                <div className="repo-editor">{file ? <><div className="repo-subheading"><code>{file.path}</code><span className="repo-badge">{dirty ? 'Unsaved text edits' : 'Checkout file loaded'}</span></div><div className="repo-buttons"><button className="primary" disabled={!dirty || !!busy || running} onClick={() => action('save', async () => { const value = await request(`/repos/${encodeURIComponent(repoId)}/file`, {method: 'PUT', body: JSON.stringify({path: file.path, content: text, revision: file.revision})}); setFile({...file, ...value, content: value.content ?? text}); setMessage('Saved to local checkout. Use Git review before publishing.'); const status = await request(`/repos/${encodeURIComponent(repoId)}/git`); setGit(status); })}>{busy === 'save' ? 'Saving…' : 'Save local checkout'}</button><button disabled={!!busy} onClick={() => guard(() => loadFile(file.path))}>Reload current file</button></div>{running ? <p className="repo-notice">Repository job running. Checkout saves paused until job finishes.</p> : null}<label className="repo-editor-label">Text file · {file.size} bytes · revision {String(file.revision).slice(0, 12)}<textarea spellCheck={false} aria-label={'Edit checkout file ' + file.path} value={text} onChange={event => setText(event.target.value)} disabled={!!busy}/></label></> : <div className="repo-empty"><h2>Select text file</h2><p>Expand folders, then choose file. Binary files and oversized files stay read protected by host.</p></div>}</div>
            </div> : <div className="repo-builds">
                <div className="repo-section-heading"><h2>Checkout builds</h2><p>{nativeCommands ? 'Repository commands run in selected checkout.' : 'Declared package scripts run in selected checkout.'} Browser draft changes are not included.</p></div>
                <div className="repo-build-controls"><div><strong>{nativeCommands ? 'Repository commands' : 'Package scripts'}</strong><p>{git ? `${git.packageManager || 'No package manager'} · ${scripts.length} ${nativeCommands ? 'repository commands' : 'declared scripts'}` : 'Reading build commands…'}</p></div><div className="repo-buttons">{scripts.filter(name => /^(build|test)(:|$)/.test(name)).map(name => <button className={name.startsWith('build') ? 'primary' : ''} key={name} disabled={running || !!busy || !host.capabilities?.includes('builds')} onClick={() => startJob(name.startsWith('test') ? 'test' : 'build', name)}>{name}</button>)}<button disabled={running || !!busy || !git?.packageManager || git?.canInstall === false || !host.capabilities?.includes('builds')} onClick={() => setInstallReview(true)}>Install dependencies…</button></div>{git?.canInstall === false ? <p>Native game build adapter uses repository scripts; package install unavailable.</p> : null}{git && !scripts.some(name => /^(build|test)(:|$)/.test(name)) ? <p>{nativeCommands ? 'No build or test commands available from repository adapter.' : 'No build or test scripts declared in checkout root package.json.'}</p> : null}</div>
                {installReview ? <div className="repo-discard"><strong>Install checkout dependencies</strong><p>Executes package install in {repo?.name} using {git?.packageManager}. Package lifecycle scripts may run.</p><div className="repo-buttons"><button className="primary" disabled={running || !!busy} onClick={() => startJob('install')}>Execute package install</button><button onClick={() => setInstallReview(false)}>Cancel</button></div></div> : null}
                {git?.changes?.length ? <details className="repo-changes"><summary>{git.changes.length} checkout changes</summary><ul>{git.changes.map((change, index) => <li key={change.path + index}><code>{change.status}</code> {change.path}</li>)}</ul></details> : git ? <p>No local Git changes.</p> : null}
                {jobError ? <div className="repo-notice error" role="alert">{jobError}</div> : null}
                {!currentJobArtifacts ? <section className="repo-job" aria-label="Current verified build artifacts"><h3>Current verified build artifacts</h3>{running ? <p>Repository job running. Build output links paused until job finishes.</p> : currentArtifacts.artifacts?.length ? <><p>Successful checkout build verified by local host. Outputs remain available after host restart.</p><div className="repo-artifacts">{currentArtifacts.artifacts.map(artifact => <div key={artifact.path}><code>{artifact.path}</code>{safeArtifactUrl(artifact.url) ? <><a href={artifact.url} target="_blank" rel="noreferrer">Open artifact</a>{/\.html?(?:\?|$)|\/$/.test(artifact.url) ? <button onClick={() => setPreview({...artifact, origin: 'current'})}>Preview built game</button> : null}</> : <span>Host link unavailable</span>}</div>)}</div></> : <p>{currentArtifacts.reason || 'Run successful build to produce verified outputs.'}</p>}</section> : null}
                {repoJobs.length === 0 ? <div className="repo-empty"><h3>No checkout jobs yet</h3><p>Choose build command to run build or tests.</p></div> : repoJobs.map(job => <article key={job.id} className="repo-job"><div className="repo-card-top"><h3>{job.task}{job.script ? ' · ' + job.script : ''}</h3><span className={'repo-badge ' + (job.status === 'succeeded' ? 'good' : job.status === 'failed' ? 'bad' : '')}>{job.status}</span></div><p>{formatDate(job.startedAt)}{job.finishedAt ? ' → ' + formatDate(job.finishedAt) : ''}{job.exitCode !== undefined && job.exitCode !== null ? ' · exit ' + job.exitCode : ''}</p>{job.status === 'running' ? <button disabled={!!busy} onClick={() => action('cancel:' + job.id, async () => { await request(`/jobs/${encodeURIComponent(job.id)}/cancel`, {method: 'POST', body: '{}'}); setMessage('Cancellation requested. Waiting for host job status.'); })}>Cancel running job</button> : null}<details open={job.status === 'running' || job.status === 'failed'}><summary>Job output</summary><pre tabIndex={0}>{job.log || 'Waiting for job output…'}</pre></details>{job.artifactState === 'stale' || job.artifactsStale ? <p className="repo-notice">Build outputs replaced by later build.</p> : null}{job.status === 'succeeded' && job.artifactState !== 'stale' && !job.artifactsStale && job.artifacts?.length ? <div className="repo-artifacts"><strong>Build artifacts</strong>{job.artifacts.map(artifact => <div key={artifact.path}><code>{artifact.path}</code>{safeArtifactUrl(artifact.url) ? <><a href={artifact.url} target="_blank" rel="noreferrer">Open artifact</a>{/\.html?(?:\?|$)|\/$/.test(artifact.url) ? <button onClick={() => setPreview({...artifact, jobId: job.id})}>Preview built game</button> : null}</> : <span>Host link unavailable</span>}</div>)}</div> : null}</article>)}
                {preview ? <section className="repo-built-preview"><div className="repo-subheading"><h3>Saved build preview · {preview.path}</h3><button onClick={() => setPreview(null)}>Close preview</button></div><p>Built checkout artifact. Scripts run inside isolated frame; game engine state depends on artifact.</p><iframe title={'Built game artifact ' + preview.path} src={preview.url} sandbox="allow-scripts allow-downloads" referrerPolicy="no-referrer"/></section> : null}
            </div>}
        </>}
    </section>;
}

function BranchEditor({repo, disabled, save})
{
    const [value, setValue] = useState(repo.branch || '');
    return <form className="repo-branch-form" onSubmit={event => { event.preventDefault(); save(value.trim()); }}><label>Branch before local copy<input value={value} onChange={event => setValue(event.target.value)} placeholder="Current local branch" disabled={disabled}/></label><button disabled={disabled || value === (repo.branch || '')}>Save branch</button></form>;
}

function formatDate(value)
{
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString();
}

function safeArtifactUrl(value)
{
    if (typeof value !== 'string') return false;
    return value.startsWith('/api/workbench/') && !value.startsWith('//') && !/[\\\u0000-\u0020]/.test(value);
}
