import {useEffect, useRef, useState} from 'react';
import './editor-menu.css';

export function EditorMenu({menus})
{
    const [open, setOpen] = useState(-1);
    const [active, setActive] = useState(0);
    const root = useRef(null);
    const triggers = useRef([]);
    const pendingFocus = useRef('first');

    function close(restoreFocus = false)
    {
        setOpen(-1);
        if (restoreFocus) triggers.current[open]?.focus();
    }

    function show(index, position = 'first')
    {
        pendingFocus.current = position;
        setActive(index);
        setOpen(index);
    }

    useEffect(() =>
    {
        if (open < 0) return;
        const items = root.current?.querySelector('[role="menu"]')?.querySelectorAll('[role="menuitem"]:not(:disabled),[role="menuitemradio"]:not(:disabled)');
        const target = pendingFocus.current === 'last' ? items?.[items.length - 1] : items?.[0];
        target?.focus();
        const outside = event =>
        {
            if (!root.current?.contains(event.target)) setOpen(-1);
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('focusin', outside);
        return () =>
        {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('focusin', outside);
        };
    }, [open]);

    function adjacent(index, step, expand)
    {
        const next = (index + step + menus.length) % menus.length;
        setActive(next);
        if (expand) show(next);
        else triggers.current[next]?.focus();
    }

    function triggerKeys(event, index)
    {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp')
        {
            event.preventDefault();
            show(index, event.key === 'ArrowUp' ? 'last' : 'first');
        }
        else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
        {
            event.preventDefault();
            adjacent(index, event.key === 'ArrowRight' ? 1 : -1, open >= 0);
        }
        else if (event.key === 'Escape') close(true);
        else if (event.key === 'Home' || event.key === 'End')
        {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : menus.length - 1;
            setActive(next);
            triggers.current[next]?.focus();
        }
    }

    function itemKeys(event, index)
    {
        const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled),[role="menuitemradio"]:not(:disabled)')];
        const current = items.indexOf(document.activeElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
        {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
        }
        else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
        {
            event.preventDefault();
            adjacent(index, event.key === 'ArrowRight' ? 1 : -1, true);
        }
        else if (event.key === 'Escape')
        {
            event.preventDefault();
            event.stopPropagation();
            close(true);
        }
        else if (event.key === 'Tab') close();
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)
        {
            const ordered = [...items.slice(current + 1), ...items.slice(0, current + 1)];
            const match = ordered.find(item => item.dataset.label?.toLowerCase().startsWith(event.key.toLowerCase()));
            if (match)
            {
                event.preventDefault();
                match.focus();
            }
        }
    }

    return <div className="editor-menu" ref={root}>
        <div className="editor-menu-triggers" role="menubar" aria-label="Editor menu">
            {menus.map((menu, index) => <button key={menu.label} ref={element => {triggers.current[index] = element;}} role="menuitem" aria-haspopup="menu" aria-expanded={open === index} aria-controls={'editor-menu-' + index} tabIndex={active === index ? 0 : -1} onFocus={() => setActive(index)} onKeyDown={event => triggerKeys(event, index)} onClick={() => open === index ? close(true) : show(index)}>{menu.label}</button>)}
        </div>
        {open >= 0 ? <div className="editor-menu-popup" style={{left: Math.max(10, Math.min(triggers.current[open]?.offsetLeft || 10, (root.current?.clientWidth || 320) - 300))}} id={'editor-menu-' + open} role="menu" aria-label={menus[open].label} onKeyDown={event => itemKeys(event, open)}>
            {menus[open].items.map((item, index) => item.separator ? <div role="separator" key={'separator-' + index}/> : <button key={item.label} role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} disabled={item.disabled} data-label={item.label} onClick={() => {close(true); item.action();}}>
                <span className="editor-menu-check" aria-hidden="true">{item.checked ? '✓' : ''}</span><span>{item.label}</span>{item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
            </button>)}
        </div> : null}
    </div>;
}
