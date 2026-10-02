import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';

const LocalHostContext = createContext(null);
const STATIC_PREVIEW = import.meta.env.VITE_EDITOR_RUNTIME === 'static';

export function useLocalHost() {return useContext(LocalHostContext);}

// Authoring opens immediately. Only checkout operations wait for the local host;
// public/static builds never request or receive local host access.
export function LocalHostProvider({children})
{
    const [connected, setConnected] = useState(false);
    const [connectionId, setConnectionId] = useState(null);
    const [checking, setChecking] = useState(!STATIC_PREVIEW);
    const inFlight = useRef(null);
    const refresh = useCallback(async () =>
    {
        if (STATIC_PREVIEW) return;
        inFlight.current?.abort();
        const controller = new AbortController();
        inFlight.current = controller;
        const timeout = setTimeout(() => controller.abort(), 8000);
        setChecking(true);
        try
        {
            const response = await fetch('/api/auth/session', {credentials: 'same-origin', cache: 'no-store', headers: {'Accept': 'application/json'}, signal: controller.signal});
            if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Local host unavailable.');
            const session = await response.json();
            if (!response.ok || session.accountsPaused !== true || session.localAccess !== true || !session.csrfToken) throw new Error('Local host unavailable.');
            if (!controller.signal.aborted)
            {
                setConnectionId(session.csrfToken);
                setConnected(true);
            }
        }
        catch {if (inFlight.current === controller) setConnected(false);}
        finally {clearTimeout(timeout); if (inFlight.current === controller) setChecking(false);}
    }, []);

    useEffect(() =>
    {
        if (STATIC_PREVIEW) return;
        refresh();
        const reconnect = () => {setConnected(false); refresh();};
        const focused = () => {if (document.visibilityState === 'visible') refresh();};
        window.addEventListener('workbench-host-disconnected', reconnect);
        window.addEventListener('focus', focused);
        const timer = setInterval(focused, 30000);
        return () =>
        {
            inFlight.current?.abort();
            clearInterval(timer);
            window.removeEventListener('workbench-host-disconnected', reconnect);
            window.removeEventListener('focus', focused);
        };
    }, [refresh]);

    return <LocalHostContext.Provider value={{connected, connectionId, checking, offline: STATIC_PREVIEW, refresh}}>{children}</LocalHostContext.Provider>;
}
