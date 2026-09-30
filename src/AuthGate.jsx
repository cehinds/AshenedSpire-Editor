import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import './auth.css';

const AuthContext = createContext(null);
const STATIC_PREVIEW = import.meta.env.VITE_EDITOR_RUNTIME === 'static';

export function useAuth()
{
    return useContext(AuthContext);
}

async function jsonRequest(url, options = {})
{
    const response = await fetch(url, {credentials: 'same-origin', cache: 'no-store', ...options, headers: {Accept: 'application/json', ...options.headers}});
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Local editor host unavailable. GitHub connection requires the local editor host.');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `GitHub request failed (${response.status}).`);
    return result;
}

export function AuthGate({children})
{
    const [session, setSession] = useState(null);
    const [unavailable, setUnavailable] = useState(STATIC_PREVIEW);
    const [accountOpen, setAccountOpen] = useState(false);
    const [github, setGithub] = useState(null);
    const inFlight = useRef(null);

    const bootstrap = useCallback(() =>
    {
        if (STATIC_PREVIEW) return Promise.reject(new Error('GitHub connection requires the local editor host. This preview supports browser authoring.'));
        if (inFlight.current) return inFlight.current.promise;
        const controller = new AbortController();
        const operation = {controller};
        inFlight.current = operation;
        const timeout = setTimeout(() => controller.abort(), 8000);
        operation.promise = jsonRequest('/api/auth/session', {signal: controller.signal}).then(result =>
        {
            if (result.localAccess !== true || !result.csrfToken) throw new Error('Local editor host does not support automatic local access. Restart the updated local editor host.');
            if (!controller.signal.aborted) {setSession(result); setUnavailable(false);}
            return result;
        }).catch(error =>
        {
            if (inFlight.current === operation) {setSession(null); setUnavailable(true);}
            throw error;
        }).finally(() =>
        {
            clearTimeout(timeout);
            if (inFlight.current === operation) inFlight.current = null;
        });
        return operation.promise;
    }, []);

    useEffect(() =>
    {
        const refresh = () => {bootstrap().catch(() => {});};
        refresh();
        window.addEventListener('workbench-auth-expired', refresh);
        return () =>
        {
            inFlight.current?.controller.abort();
            inFlight.current = null;
            window.removeEventListener('workbench-auth-expired', refresh);
        };
    }, [bootstrap]);

    const closeAccount = useCallback(() => setAccountOpen(false), []);
    const context = {authenticated: false, localAccess: session?.localAccess === true, offline: unavailable, username: github?.connected ? github.username : null, openAccount: () => setAccountOpen(true)};

    return <AuthContext.Provider value={context}>
        <div className="authenticated-editor" inert={accountOpen ? true : undefined}>{children}</div>
        {accountOpen ? <AccountDialog bootstrap={bootstrap} onStatus={setGithub} close={closeAccount}/> : null}
    </AuthContext.Provider>;
}

function AccountDialog({bootstrap, onStatus, close})
{
    const [status, setStatus] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(true);
    const root = useRef(null);
    const operation = useRef(null);
    const timer = useRef(null);
    const active = useRef(false);
    const csrf = useRef(null);

    const update = useCallback(async (connect = false) =>
    {
        if (!active.current || operation.current) return;
        clearTimeout(timer.current);
        const controller = new AbortController();
        operation.current = controller;
        const timeout = setTimeout(() => controller.abort(), 30000);
        setBusy(true);
        setError('');
        try
        {
            if (!csrf.current || connect)
            {
                await bootstrap();
                if (controller.signal.aborted) return;
                const host = await jsonRequest('/api/workbench/status', {signal: controller.signal});
                if (!host.csrfToken) throw new Error('Local editor host returned no request token. Retry the connection.');
                csrf.current = host.csrfToken;
            }
            if (connect) await jsonRequest('/api/workbench/github/login', {method: 'POST', signal: controller.signal, headers: {'Content-Type': 'application/json', 'X-Workbench-CSRF': csrf.current}, body: JSON.stringify({})});
            const result = await jsonRequest('/api/workbench/github/status', {signal: controller.signal});
            if (typeof result.available !== 'boolean' || typeof result.connected !== 'boolean' || !['idle', 'pending', 'succeeded', 'failed'].includes(result.login?.state)) throw new Error('Local editor host returned an invalid GitHub status.');
            if (!active.current || controller.signal.aborted) return;
            setStatus(result);
            onStatus(result);
            if (result.login.state === 'pending') timer.current = setTimeout(() => {void update();}, 2000);
        }
        catch (problem)
        {
            if (active.current && operation.current === controller) setError(problem.name === 'AbortError' ? 'GitHub request timed out. Refresh status to check the connection.' : problem.message);
        }
        finally
        {
            clearTimeout(timeout);
            if (operation.current === controller)
            {
                operation.current = null;
                if (active.current) setBusy(false);
            }
        }
    }, [bootstrap, onStatus]);

    useEffect(() =>
    {
        active.current = true;
        void update();
        return () =>
        {
            active.current = false;
            clearTimeout(timer.current);
            operation.current?.abort();
            operation.current = null;
        };
    }, [update]);

    useEffect(() =>
    {
        const previous = document.activeElement;
        root.current?.querySelector('button')?.focus();
        const keys = event =>
        {
            if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); close();}
            if (event.key === 'Tab')
            {
                const elements = [...root.current.querySelectorAll('button:not(:disabled),a[href]')];
                const first = elements[0], last = elements.at(-1);
                if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
                else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
            }
        };
        const box = root.current;
        box?.addEventListener('keydown', keys);
        return () => {box?.removeEventListener('keydown', keys); previous?.focus();};
    }, [close]);

    const pending = status?.login.state === 'pending';
    const verificationUrl = status?.login.verificationUrl === 'https://github.com/login/device' ? status.login.verificationUrl : null;
    return <div className="auth-modal-backdrop" onClick={close}>
        <section className="auth-card auth-account" role="dialog" aria-modal="true" aria-labelledby="account-title" ref={root} onClick={event => event.stopPropagation()}>
            <div className="auth-dialog-title"><h1 id="account-title">GitHub account</h1><button onClick={close}>Close</button></div>
            <p>The editor opens without a sign-in or editor password. GitHub uses the existing credentials on this computer.</p>
            {status?.connected ? <p className="auth-notice" role="status">Connected to GitHub as <strong>{status.username}</strong>.</p> : status?.available === false ? <p className="auth-notice">GitHub connection is unavailable on this host. Local authoring remains available.</p> : !status && busy ? <p role="status">Checking GitHub connection…</p> : null}
            {pending ? <div className="auth-notice" role="status"><p>Complete authorization in your system default browser.</p>{status.login.code ? <p>Enter code: <strong className="github-device-code">{status.login.code}</strong></p> : <p>Waiting for the browser authorization code…</p>}{verificationUrl ? <a href={verificationUrl} target="_blank" rel="noopener noreferrer">Open GitHub authorization</a> : null}</div> : null}
            {status?.login.error || status?.login.state === 'failed' ? <p className="auth-error" role="alert">{status.login.error || 'GitHub authorization failed. Try connecting again.'}</p> : null}
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <p>Connect GitHub opens your system default browser. GitHub authorization does not connect a repository; a repository is connected only after its clone succeeds.</p>
            <button className="primary" disabled={busy || pending || !status?.available || status.connected} onClick={() => {void update(true);}}>Connect GitHub in browser</button>
            <button disabled={busy} onClick={() => {void update();}}>Refresh status</button>
        </section>
    </div>;
}
