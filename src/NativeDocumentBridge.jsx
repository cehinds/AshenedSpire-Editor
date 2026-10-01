import {useEffect, useRef, useState} from 'react';
import {useLocalHost} from './AuthGate.jsx';
import {NATIVE_DOCUMENTS, checkDocumentPath, mergedNativeProject, reviewNativeSave, serializeNativeDocument} from './native-document.mjs';
import './native-document.css';

export function NativeDocumentBridge({ctx, open, onClose})
{
    const localHost = useLocalHost();
    const allowed = localHost?.connected === true && !localHost.offline;
    const type = NATIVE_DOCUMENTS[ctx.ws];
    const [repos, setRepos] = useState([]);
    const [targets, setTargets] = useState({});
    const [receipts, setReceipts] = useState({});
    const [review, setReview] = useState(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const token = useRef('');
    const requests = useRef(new Set());
    const root = useRef(null);
    const closeRef = useRef(onClose);
    const contextRef = useRef(ctx);
    const busyRef = useRef(busy);
    closeRef.current = onClose; contextRef.current = ctx; busyRef.current = busy;
    const target = targets[ctx.ws] || {repoId: '', path: type?.path || ''};
    const receipt = receipts[ctx.ws];
    const loaded = receipt?.repoId === target.repoId && receipt?.path === target.path;

    async function request(path, options = {})
    {
        if (!allowed) throw new Error('Local editor host required. Offline preview cannot read or save checkout documents.');
        const controller = new AbortController();
        requests.current.add(controller);
        const timeout = setTimeout(() => controller.abort(), 15000);
        try
        {
            const response = await fetch('/api/workbench' + path, {...options, signal: controller.signal, credentials: 'same-origin', headers: {'Accept': 'application/json', ...(options.body ? {'Content-Type': 'application/json', 'X-Workbench-CSRF': token.current} : {})}});
            if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Local document host unavailable.');
            const result = await response.json();
            if (!response.ok)
            {
                if (response.status === 401) window.dispatchEvent(new CustomEvent('workbench-host-disconnected'));
                throw new Error(result.error || `Checkout request failed (${response.status}).`);
            }
            return result;
        }
        finally {clearTimeout(timeout); requests.current.delete(controller);}
    }

    useEffect(() =>
    {
        if (!open) return;
        setError(''); setMessage(''); setReview(null);
        let active = true;
        if (!allowed || !type) setBusy(false);
        if (allowed && type)
        {
            setBusy(true);
            (async () =>
            {
                const status = await request('/status');
                if (!status.connected || !status.capabilities?.includes('files')) throw new Error('Local host does not support native document files.');
                if (!active) return;
                token.current = status.csrfToken;
                const result = await request('/repos');
                if (!active) return;
                const connected = result.repos.filter(repo => repo.kind === 'local' && repo.status === 'connected');
                setRepos(connected);
                setTargets(previous => ({...previous, [ctx.ws]: previous[ctx.ws] || {repoId: connected[0]?.id || '', path: type.path}}));
            })().catch(problem => {if (active && problem.name !== 'AbortError') setError(problem.message);}).finally(() => {if (active) setBusy(false);});
        }
        return () => {active = false; requests.current.forEach(controller => controller.abort());};
    }, [open, ctx.ws, allowed, localHost?.connectionId]);

    useEffect(() =>
    {
        if (!open) return;
        const previous = document.activeElement;
        root.current?.querySelector('button')?.focus();
        const keys = event =>
        {
            if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); if (!busyRef.current) closeRef.current();}
            if (event.key !== 'Tab') return;
            const controls = [...root.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')];
            if (event.shiftKey && document.activeElement === controls[0]) {event.preventDefault(); controls.at(-1)?.focus();}
            else if (!event.shiftKey && document.activeElement === controls.at(-1)) {event.preventDefault(); controls[0]?.focus();}
        };
        const element = root.current;
        element?.addEventListener('keydown', keys);
        return () => {element?.removeEventListener('keydown', keys); previous?.focus();};
    }, [open]);

    function changeTarget(patch)
    {
        setTargets(previous => ({...previous, [ctx.ws]: {...target, ...patch}}));
        setReceipts(previous => {const next = {...previous}; delete next[ctx.ws]; return next;});
        setReview(null); setError(''); setMessage('');
    }

    async function action(work)
    {
        if (busy) return;
        setBusy(true); setError(''); setMessage('');
        try {await work();}
        catch (problem) {if (problem.name !== 'AbortError') setError(problem.message);}
        finally {setBusy(false);}
    }

    const fileEndpoint = () => `/repos/${encodeURIComponent(target.repoId)}/file`;
    async function readCurrent()
    {
        checkDocumentPath(ctx.ws, target.path);
        if (!repos.some(repo => repo.id === target.repoId)) throw new Error('Select connected checkout.');
        return request(fileEndpoint() + '?path=' + encodeURIComponent(target.path));
    }

    async function load()
    {
        const ws = ctx.ws;
        const current = await readCurrent();
        const {next, parsed} = mergedNativeProject(contextRef.current.p, ws, current.content);
        contextRef.current.update(project => {project[type.field] = next[type.field];}, `Loaded ${type.label} from checkout`);
        setReceipts(previous => ({...previous, [ws]: {ws, repoId: target.repoId, path: target.path, revision: current.revision, parsed}}));
        setReview(null);
        setMessage('Checkout document loaded into draft. Close bridge, edit workspace, then reopen to review and save.');
    }

    async function prepareReview()
    {
        const current = await readCurrent();
        setReview({...reviewNativeSave(contextRef.current.p, ctx.ws, receipt, current), ws: ctx.ws, repoId: target.repoId, path: target.path});
    }

    async function save()
    {
        if (!review || review.ws !== ctx.ws || review.repoId !== target.repoId || review.path !== target.path || serializeNativeDocument(contextRef.current.p, ctx.ws, receipt) !== review.after) throw new Error('Draft changed since review. Review again before saving.');
        const current = await readCurrent();
        const checked = reviewNativeSave(contextRef.current.p, ctx.ws, receipt, current);
        if (checked.after !== review.after) throw new Error('Draft changed during checkout check. Review again.');
        const result = await request(fileEndpoint(), {method: 'PUT', body: JSON.stringify({path: target.path, content: review.after, revision: review.revision})});
        const {parsed} = mergedNativeProject(contextRef.current.p, ctx.ws, result.content);
        setReceipts(previous => ({...previous, [ctx.ws]: {...receipt, revision: result.revision, parsed}}));
        setReview(null); setMessage('Native document saved to isolated checkout. Run real build or validation job to check game integration.');
        contextRef.current.tell?.('Native checkout document saved. No commit or push.');
    }

    if (!open) return null;
    return <div className="native-bridge-backdrop"><section className="native-bridge" ref={root} role="dialog" aria-modal="true" aria-labelledby="native-bridge-title">
        <div className="native-bridge-heading"><h2 id="native-bridge-title">Native checkout document</h2><button disabled={busy} onClick={onClose}>Close</button></div>
        {!type ? <p>Supported: Tags CSV, Opening scene full JSON, and UI configuration JSON. Cards, effects, battlefield proposals, and native ERD documents require separate adapters.</p> : !allowed ? <p>Local editor host required. Offline authoring preview cannot load or save repository files.</p> : <>
            <p>{type.label}: load existing checkout document, edit draft, review changes, then save explicitly. Structural validation runs before load and save; native compiler remains separate.</p>
            <label>Connected local repository<select aria-label="Native document repository" value={target.repoId} disabled={busy} onChange={event => changeTarget({repoId: event.target.value})}><option value="">Select local checkout</option>{repos.map(repo => <option key={repo.id} value={repo.id}>{repo.name} · {repo.branch}</option>)}</select></label>
            <label>Existing native file path<input aria-label="Native document path" value={target.path} disabled={busy} onChange={event => changeTarget({path: event.target.value})}/></label>
            <p>{loaded ? `Loaded revision ${receipt.revision.slice(0, 12)}. Receipt stays in this session; restart requires loading again.` : 'Load required before saving. Loading replaces current workspace document; draft Undo restores prior document.'}</p>
            <div className="button-row"><button disabled={busy || !target.repoId} onClick={() => action(load)}>Load checkout into draft</button><button disabled={busy || !loaded || !target.repoId} onClick={() => action(prepareReview)}>Review native save</button></div>
            {review ? <><div className="native-bridge-diff"><label>Current checkout<textarea readOnly value={review.before}/></label><label>Proposed native document<textarea readOnly value={review.after}/></label></div><button className="primary" disabled={busy || review.before === review.after} onClick={() => action(save)}>Save reviewed native document</button></> : null}
            {!busy && !repos.length ? <p>Open local repository under Project tools → Repositories first. GitHub connection stays skipped.</p> : null}
        </>}
        {busy ? <p role="status">Checking local checkout…</p> : null}{error ? <p role="alert" className="native-bridge-error">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    </section></div>;
}
