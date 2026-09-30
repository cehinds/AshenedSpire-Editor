import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import './auth.css';

const AuthContext = createContext(null);
const SESSION_URL = '/api/auth/session';
const STATIC_PREVIEW = import.meta.env.VITE_EDITOR_RUNTIME === 'static';

export function useAuth()
{
    return useContext(AuthContext);
}

export function AuthGate({children})
{
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [unavailable, setUnavailable] = useState(false);
    const [offline, setOffline] = useState(false);
    const [opened, setOpened] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [notice, setNotice] = useState('');
    const mounted = useRef(false);
    const inFlight = useRef(null);

    const refresh = useCallback(async (showLoading = false) =>
    {
        if (STATIC_PREVIEW)
        {
            setSession(null);
            setUnavailable(true);
            setLoading(false);
            return;
        }
        if (showLoading) setLoading(true);
        inFlight.current?.abort();
        const controller = new AbortController();
        inFlight.current = controller;
        const timeout = setTimeout(() => controller.abort(), 8000);
        try
        {
            const response = await fetch(SESSION_URL, {credentials: 'same-origin', cache: 'no-store', headers: {'Accept': 'application/json'}, signal: controller.signal});
            if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Authentication host unavailable.');
            const result = await response.json();
            if (!response.ok || typeof result.authenticated !== 'boolean' || typeof result.setupRequired !== 'boolean' || !result.csrfToken) throw new Error(result.error || 'Authentication host unavailable.');
            if (!mounted.current) return;
            setSession(result);
            setUnavailable(false);
            if (result.authenticated) {setOpened(true); setOffline(false);}
        }
        catch (error)
        {
            if (!mounted.current || (error.name === 'AbortError' && inFlight.current !== controller)) return;
            setSession(null);
            setUnavailable(true);
        }
        finally
        {
            clearTimeout(timeout);
            if (mounted.current && inFlight.current === controller) setLoading(false);
        }
    }, []);

    useEffect(() =>
    {
        mounted.current = true;
        refresh();
        if (STATIC_PREVIEW) return () => {mounted.current = false;};
        const expired = () =>
        {
            setSession(previous => previous ? {...previous, authenticated: false, username: null} : previous);
            setAccountOpen(false);
            setNotice('Session expired. Sign in again to reconnect. Unsaved editor buffer remains open.');
            refresh();
        };
        const focused = () => {if (document.visibilityState === 'visible') refresh();};
        window.addEventListener('workbench-auth-expired', expired);
        window.addEventListener('focus', focused);
        const timer = setInterval(() => {if (document.visibilityState === 'visible') refresh();}, 30000);
        return () =>
        {
            mounted.current = false;
            inFlight.current?.abort();
            clearInterval(timer);
            window.removeEventListener('workbench-auth-expired', expired);
            window.removeEventListener('focus', focused);
        };
    }, [refresh]);

    async function request(endpoint, body)
    {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try
        {
            const response = await fetch('/api/auth/' + endpoint, {method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: {'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Auth-CSRF': session?.csrfToken || ''}, body: JSON.stringify(body)});
            if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Local authentication host unavailable.');
            const result = await response.json();
            if (!response.ok)
            {
                if (response.status === 403 || response.status === 409 || (response.status === 401 && endpoint === 'logout')) await refresh();
                throw new Error(result.error || `Account request failed (${response.status}).`);
            }
            if (typeof result.authenticated !== 'boolean' || typeof result.setupRequired !== 'boolean' || !result.csrfToken) throw new Error('Invalid account host response.');
            setSession(result);
            setUnavailable(false);
            setOffline(false);
            if (result.authenticated) setOpened(true);
            return result;
        }
        catch (error)
        {
            if (error.name === 'AbortError') throw new Error('Account request timed out. Retry local host.');
            throw error;
        }
        finally {clearTimeout(timeout);}
    }

    async function logout()
    {
        try
        {
            await request('logout', {});
            setAccountOpen(false);
            setNotice('Signed out. Sign in to reconnect this editor.');
        }
        catch (error) {setNotice(error.message); setAccountOpen(true);}
    }

    const closeAccount = useCallback(() => setAccountOpen(false), []);
    const ready = session?.authenticated || offline;
    const context = {authenticated: session?.authenticated === true, offline, username: session?.username || null, openAccount: () => setAccountOpen(true), logout, exitOffline: () => {setOffline(false); setNotice(''); refresh(true);}};

    return <AuthContext.Provider value={context}>
        {opened ? <div hidden={!ready} inert={!ready ? true : undefined} className="authenticated-editor">{children}</div> : null}
        {!ready ? <main className="auth-screen">
            <section className="auth-card" aria-label="Editor account">
                <div className="auth-wordmark">AshenedSpire <span>EDITOR</span></div>
                {loading ? <><h1>Connecting editor host</h1><p role="status">Checking owner account and session…</p></> : unavailable ? <>
                    <h1>Local account host unavailable</h1>
                    <p>Hosted HTML supports offline authoring preview. Owner authentication, repository files, and build jobs require local editor host.</p>
                    <div className="auth-notice">Offline preview grants no account or repository access.</div>
                    <button className="primary" onClick={() => {setOffline(true); setOpened(true); setNotice('');}}>Open offline authoring preview</button>
                    <button onClick={() => refresh(true)}>Retry local host</button>
                </> : <SignIn session={session} request={request} notice={notice} onSuccess={() => setNotice('')}/>}
            </section>
        </main> : null}
        {ready && accountOpen ? <AccountDialog session={session} offline={offline} request={request} notice={notice} close={closeAccount} onPasswordChanged={() => {setAccountOpen(false); setNotice('Password changed. All sessions signed out. Sign in with new password.');}}/> : null}
    </AuthContext.Provider>;
}

function SignIn({session, request, notice, onSuccess})
{
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const setup = session?.setupRequired === true;
    async function submit(event)
    {
        event.preventDefault();
        if (busy) return;
        if (setup && password !== confirmation) {setError('Passwords must match.'); return;}
        setBusy(true);
        setError('');
        try {await request(setup ? 'setup' : 'login', {username: username.trim(), password}); onSuccess();}
        catch (problem) {setError(problem.message);}
        finally {setPassword(''); setConfirmation(''); setBusy(false);}
    }
    return <>
        <h1>{setup ? 'Create editor owner' : 'Sign in to editor'}</h1>
        <p>{setup ? 'First setup creates single owner account on this host. Choose your own username and password.' : 'Use editor owner account on this host.'}</p>
        {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
        <form onSubmit={submit}>
            <label htmlFor="auth-username">Username</label><input id="auth-username" name="username" maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9_.@-]{0,63}" title="1–64 letters, digits, underscore, dot, @ or hyphen; start with letter or digit" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={event => setUsername(event.target.value)} disabled={busy}/>
            <label htmlFor="auth-password">Password{setup ? ' (12–128 characters)' : ''}</label><input id="auth-password" name="password" type="password" minLength={setup ? 12 : undefined} maxLength={128} autoComplete={setup ? 'new-password' : 'current-password'} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/>
            {setup ? <><label htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" name="confirmPassword" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy}/></> : null}
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Connecting…' : setup ? 'Create owner account' : 'Sign in'}</button>
        </form>
    </>;
}

function AccountDialog({session, offline, request, notice, close, onPasswordChanged})
{
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const root = useRef(null);
    const busyRef = useRef(busy);
    busyRef.current = busy;
    useEffect(() =>
    {
        const previous = document.activeElement;
        root.current?.querySelector('button')?.focus();
        const keys = event =>
        {
            if (event.key === 'Escape' && !busyRef.current) {event.preventDefault(); event.stopPropagation(); close();}
            if (event.key === 'Tab')
            {
                const elements = [...root.current.querySelectorAll('input:not(:disabled),button:not(:disabled)')];
                const first = elements[0], last = elements.at(-1);
                if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
                else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
            }
        };
        const box = root.current;
        box?.addEventListener('keydown', keys);
        return () => {box?.removeEventListener('keydown', keys); previous?.focus();};
    }, [close]);
    async function submit(event)
    {
        event.preventDefault();
        if (busy) return;
        if (newPassword !== confirmation) {setError('New passwords must match.'); return;}
        setBusy(true);
        setError('');
        try {await request('password', {currentPassword, newPassword}); onPasswordChanged();}
        catch (problem) {setError(problem.message);}
        finally {setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setBusy(false);}
    }
    return <div className="auth-modal-backdrop" onClick={() => {if (!busy) close();}}>
        <section className="auth-card auth-account" role="dialog" aria-modal="true" aria-labelledby="account-title" ref={root} onClick={event => event.stopPropagation()}>
            <div className="auth-dialog-title"><h1 id="account-title">{offline ? 'Offline authoring preview' : 'Editor owner account'}</h1><button disabled={busy} onClick={close}>Close</button></div>
            {offline ? <p>Account host unavailable. Preview grants no authenticated repository or build access.</p> : <>
                <p>Signed in as <strong>{session?.username}</strong>.</p>
                {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
                <h2>Change password</h2>
                <p>Password change signs out every session. Unsaved editor buffer remains open for next sign-in.</p>
                <form onSubmit={submit}>
                    <input hidden readOnly name="username" value={session?.username || ''} autoComplete="username"/>
                    <label htmlFor="account-current">Current password</label><input id="account-current" name="currentPassword" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy}/>
                    <label htmlFor="account-new">New password (12–128 characters)</label><input id="account-new" name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={busy}/>
                    <label htmlFor="account-confirm">Confirm new password</label><input id="account-confirm" name="confirmPassword" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy}/>
                    {error ? <p className="auth-error" role="alert">{error}</p> : null}
                    <button className="primary" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Change password and sign out'}</button>
                </form>
            </>}
        </section>
    </div>;
}
