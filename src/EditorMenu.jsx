import {useEffect, useRef, useState} from 'react';
import {DotsSix} from '@phosphor-icons/react/dist/csr/DotsSix';
import {PushPin} from '@phosphor-icons/react/dist/csr/PushPin';
import {PushPinSlash} from '@phosphor-icons/react/dist/csr/PushPinSlash';
import {ArrowCounterClockwise} from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import {X} from '@phosphor-icons/react/dist/csr/X';
import {Check} from '@phosphor-icons/react/dist/csr/Check';
import {useMovablePanel} from './useMovablePanel.js';
import './editor-menu.css';

function MenuPopup({menu, index, trigger, pinned, setPinned, close, itemKeys})
{
    const movable = useMovablePanel({
        storageKey: `ashenedspire.menu-position.${menu.label.toLowerCase()}`,
        initialSize: {width: 310, height: Math.min(600, menu.items.length * 33 + 45)},
        defaultPosition: () => {
            const anchor = trigger?.getBoundingClientRect();
            return {x: anchor?.left ?? 10, y: (anchor?.bottom ?? 64) + 3};
        }
    });
    return <div ref={movable.ref} className={`editor-menu-popup${pinned ? ' is-pinned' : ''}${movable.dragging ? ' is-dragging' : ''}`} style={movable.style} onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented) {event.preventDefault(); event.stopPropagation(); close(true);}
    }}>
        <div className="editor-menu-popup-header">
            <div {...movable.dragHandleProps} className="editor-menu-drag-handle" tabIndex={0} role="button" aria-label={`Move ${menu.label} menu`} title="Drag to move · Arrow keys to move · Shift for larger steps · Home to reset">
                <DotsSix size={15} aria-hidden="true"/><strong>{menu.label}</strong>{pinned && <span>Pinned</span>}
            </div>
            <button type="button" className="editor-menu-header-action" aria-label={pinned ? `Unpin ${menu.label} menu` : `Pin ${menu.label} menu`} title={pinned ? 'Unpin menu' : 'Pin menu to keep it open'} aria-pressed={pinned} onClick={() => setPinned(value => !value)}>{pinned ? <PushPinSlash size={14}/> : <PushPin size={14}/>}</button>
            <button type="button" className="editor-menu-header-action" aria-label={`Reset ${menu.label} menu position`} title="Reset position" onClick={movable.reset}><ArrowCounterClockwise size={14}/></button>
            <button type="button" className="editor-menu-header-action" aria-label={`Close ${menu.label} menu`} title="Close menu (Escape)" onClick={() => close(true)}><X size={14}/></button>
        </div>
        <div className="editor-menu-items" id={'editor-menu-' + index} role="menu" aria-label={menu.label} onKeyDown={event => itemKeys(event, index)}>
            {menu.items.map((item, itemIndex) => item.separator ? <div role="separator" key={'separator-' + itemIndex}/> : <button key={item.label} role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} disabled={item.disabled} data-label={item.label} onClick={() => {if (!pinned) close(true); item.action();}}>
                <span className="editor-menu-check" aria-hidden="true">{item.checked ? <Check size={13}/> : null}</span><span>{item.label}</span>{item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
            </button>)}
        </div>
    </div>;
}

export function EditorMenu({menus})
{
    const [open, setOpen] = useState(-1);
    const [active, setActive] = useState(0);
    const [pinned, setPinned] = useState(false);
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
        if (index !== open) setPinned(false);
        setActive(index);
        setOpen(index);
    }

    useEffect(() =>
    {
        if (open < 0) return;
        const items = root.current?.querySelector('[role="menu"]')?.querySelectorAll('[role="menuitem"]:not(:disabled),[role="menuitemradio"]:not(:disabled)');
        const target = pendingFocus.current === 'last' ? items?.[items.length - 1] : items?.[0];
        target?.focus();
    }, [open]);

    useEffect(() =>
    {
        if (open < 0) return;
        const outside = event =>
        {
            if (!pinned && !root.current?.contains(event.target)) setOpen(-1);
        };
        const escape = event =>
        {
            if (event.key !== 'Escape' || event.defaultPrevented || event.target.closest?.('[role="dialog"]')) return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(-1);
            triggers.current[open]?.focus();
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('focusin', outside);
        document.addEventListener('keydown', escape);
        return () =>
        {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('focusin', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open, pinned]);

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
        else if (event.key === 'Tab' && !pinned) close();
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
        {open >= 0 ? <MenuPopup key={menus[open].label} menu={menus[open]} index={open} trigger={triggers.current[open]} pinned={pinned} setPinned={setPinned} close={close} itemKeys={itemKeys}/> : null}
    </div>;
}
