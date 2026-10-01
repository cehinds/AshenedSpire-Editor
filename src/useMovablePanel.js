import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';

const RESET_EVENT = 'ashenedspire:reset-panel-positions';
const positionKeys = /^(ashenedspire\.(menu-position\.|dialog-position\.|studio\.inspector\.position\.))/;

export function resetPanelPositions() {
    try {
        for (const key of Object.keys(localStorage)) if (positionKeys.test(key)) localStorage.removeItem(key);
    } catch {}
    window.dispatchEvent(new Event(RESET_EVENT));
}

export function useMovablePanel({storageKey, initialSize = {width: 320, height: 400}, defaultPosition, onMoveStart, enabled = true}) {
    const ref = useRef(null);
    const options = useRef({initialSize, defaultPosition, onMoveStart, enabled});
    options.current = {initialSize, defaultPosition, onMoveStart, enabled};
    const fallback = useCallback(() => options.current.defaultPosition?.() ?? {x: 16, y: 80}, []);
    const clamp = useCallback(point => {
        const bounds = options.current.enabled ? ref.current?.getBoundingClientRect() : null;
        const size = options.current.initialSize;
        const width = bounds?.width || size.width, height = bounds?.height || size.height;
        return {x: Math.max(8, Math.min(Number(point.x) || 0, Math.max(8, window.innerWidth - width - 8))),
            y: Math.max(8, Math.min(Number(point.y) || 0, Math.max(8, window.innerHeight - height - 8)))};
    }, []);
    const [position, updatePosition] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey));
            if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return saved;
        } catch {}
        return fallback();
    });
    const current = useRef(position);
    current.current = position;
    const drag = useRef(null);
    const [dragging, setDragging] = useState(false);
    const setPosition = useCallback(point => updatePosition(clamp(typeof point === 'function' ? point(current.current) : point)), [clamp]);
    const reset = useCallback(() => {
        try {localStorage.removeItem(storageKey);} catch {}
        drag.current = null; setDragging(false); setPosition(fallback());
    }, [storageKey, fallback, setPosition]);
    useLayoutEffect(() => {
        if (!enabled) return;
        const constrain = () => updatePosition(value => {
            const next = clamp(value); return next.x === value.x && next.y === value.y ? value : next;
        });
        constrain();
        const observer = new ResizeObserver(constrain);
        if (ref.current) observer.observe(ref.current);
        window.addEventListener('resize', constrain);
        return () => {observer.disconnect(); window.removeEventListener('resize', constrain);};
    }, [clamp, reset, enabled]);
    useEffect(() => {
        window.addEventListener(RESET_EVENT, reset);
        return () => window.removeEventListener(RESET_EVENT, reset);
    }, [reset]);
    useEffect(() => {
        if (dragging || !enabled) return;
        const timer = setTimeout(() => {
            try {localStorage.setItem(storageKey, JSON.stringify(position));} catch {}
        }, 150);
        return () => clearTimeout(timer);
    }, [storageKey, position, dragging, enabled]);
    function finish(event, cancel = false) {
        const active = drag.current;
        if (!active || (event.pointerId !== undefined && event.pointerId !== active.pointerId)) return;
        drag.current = null; setDragging(false);
        if (cancel) setPosition(active.origin);
        if (active.target.hasPointerCapture?.(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
    }
    const dragHandleProps = {
        onPointerDown(event) {
            if (event.button !== 0 || event.target.closest('button,input,select,textarea,a,[data-no-drag]')) return;
            event.preventDefault(); event.currentTarget.focus();
            options.current.onMoveStart?.();
            drag.current = {pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: {...current.current}, target: event.currentTarget};
            event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
        },
        onPointerMove(event) {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId) return;
            setPosition({x: active.origin.x + event.clientX - active.x, y: active.origin.y + event.clientY - active.y});
        },
        onPointerUp: event => finish(event),
        onPointerCancel: event => finish(event, true),
        onLostPointerCapture: event => finish(event, true),
        onKeyDown(event) {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Escape' && drag.current) {
                event.preventDefault(); event.stopPropagation(); finish(event, true); return;
            }
            const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
            if (!direction && event.key !== 'Home') return;
            event.preventDefault(); event.stopPropagation();
            if (event.key === 'Home') reset();
            else {options.current.onMoveStart?.(); const step = event.shiftKey ? 40 : 10; setPosition({x: current.current.x + direction[0] * step, y: current.current.y + direction[1] * step});}
        }
    };
    return {ref, position, style: {left: position.x, top: position.y}, dragHandleProps, reset, setPosition, dragging};
}

