import {useLayoutEffect, useRef, useState} from 'react';

/** Keep short choices inline; use a native keyboard-accessible menu when they overflow. */
export function ResponsiveChoices({label, choices, value, onChange, className = '', viewportBreakpoint = 0}) {
  const container = useRef(null);
  const buttons = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [choiceWidth, setChoiceWidth] = useState(140);
  const key = choices.map(choice => choice.label).join('|');
  useLayoutEffect(() => {
    const measure = () => {
      const width = buttons.current.scrollWidth;
      setChoiceWidth(width);
      setCollapsed(window.innerWidth <= viewportBreakpoint || width > container.current.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    observer.observe(buttons.current);
    return () => observer.disconnect();
  }, [key, viewportBreakpoint]);
  return <div ref={container} className={'responsive-choices '+className} style={{'--choice-width':choiceWidth+'px'}}>
    <div ref={buttons} className={'responsive-choice-buttons'+(collapsed?' choice-measure':'')} role="tablist" aria-label={label} aria-hidden={collapsed || undefined} inert={collapsed || undefined}>
      {choices.map(choice => <button key={choice.value} role="tab" aria-selected={choice.value===value} onClick={() => onChange(choice.value)}>{choice.label}</button>)}
    </div>
    {collapsed ? <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : null}
  </div>;
}
