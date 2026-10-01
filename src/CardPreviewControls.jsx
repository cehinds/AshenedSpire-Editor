import {useLayoutEffect,useRef,useState} from 'react';
import './card-preview-controls.css';

// View controls deliberately stay outside the authored card and undo history.
export function CardPreviewControls({ctx,upgradeAvailable=!!ctx.card.upgrade}) {
  const {card,cardZoom,setCardZoom,cardUpgraded,setCardUpgraded}=ctx;
  return <div className="card-view-controls">
    {ctx.ws==='cards'?<button className="card-layout-launcher" aria-label="Layout" title="Component layout" onClick={()=>ctx.setInspectorMode('Layout')}>▤</button>:null}
    <label className="card-zoom-control">Zoom <input aria-label="Card zoom" type="range" min="50" max="250" step="5" value={cardZoom} onChange={event=>setCardZoom(Number(event.target.value))}/><output>{cardZoom}%</output></label>
    <button title="Fit card to preview" onClick={()=>{setCardZoom(100);ctx.setCardFitRevision(value=>value+1);}}>Fit</button>
    <label className="check card-upgrade-control"><input type="checkbox" checked={cardUpgraded&&upgradeAvailable} disabled={!upgradeAvailable} onChange={event=>setCardUpgraded(event.target.checked)}/>Upgraded</label>
  </div>;
}

export function CardZoomSurface({ctx,children}) {
  const host=useRef(null),content=useRef(null),[fit,setFit]=useState(1);
  useLayoutEffect(()=>{
    const region=host.current,face=content.current.firstElementChild;
    const measure=()=>setFit(Math.min(1,Math.max(.001,(region.clientWidth-24)/face.offsetWidth),Math.max(.001,(region.clientHeight-24)/face.offsetHeight)));
    const observer=new ResizeObserver(measure);observer.observe(region);observer.observe(face);measure();
    return()=>observer.disconnect();
  },[]);
  return <div ref={host} className="card-stage" aria-label="Zoomable card preview"><div ref={content} className="card-zoom-content" style={{'--card-zoom':fit*ctx.cardZoom/100}}>{children}</div></div>;
}
