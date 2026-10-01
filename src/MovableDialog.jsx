import {DotsSix} from '@phosphor-icons/react/dist/csr/DotsSix';
import {ArrowCounterClockwise} from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import {useMovablePanel} from './useMovablePanel.js';
import './movable-panel.css';

export function MovableDialog({title, name, onClose, children}) {
    const movable = useMovablePanel({storageKey: `ashenedspire.dialog-position.${name}`, initialSize: {width: 820, height: 500},
        defaultPosition: () => ({x: (window.innerWidth - Math.min(820, window.innerWidth - 32)) / 2, y: Math.max(24, (window.innerHeight - 500) / 2)})});
    return <div className="dialog-backdrop" onClick={onClose}>
        <section ref={movable.ref} role="dialog" aria-modal="true" aria-label={title} className={`dialog movable-dialog${movable.dragging ? ' is-dragging' : ''}`} style={movable.style} onClick={event => event.stopPropagation()}>
            <div className="dialog-top">
                <div {...movable.dragHandleProps} className="dialog-drag-handle" role="button" tabIndex={0} aria-label={`Move ${title} dialog`} title="Drag to move · Arrow keys to move · Shift for larger steps · Home to reset"><DotsSix size={18}/><h2>{title}</h2></div>
                <button aria-label="Reset dialog position" title="Reset position" onClick={movable.reset}><ArrowCounterClockwise size={16}/></button>
                <button data-dialog-close onClick={onClose}>Close</button>
            </div>
            <div className="movable-dialog-body">{children}</div>
        </section>
    </div>;
}
