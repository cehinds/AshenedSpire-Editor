// Used verbatim inside both script-only preview sandboxes.
export function applyCardPresentation(face,sidecar={},applyLayout) {
  applyLayout(face,undefined);
  if(sidecar.theme==='paper'){
    face.style.background='#ede6d6';face.style.color='#26313a';face.style.borderColor='#b18438';
    for(const key of ['--gold','--text','--muted','--line','--line-soft'])face.style.setProperty(key,key==='--gold'?'#85632f':key==='--text'?'#26313a':key==='--muted'?'#716754':'#b6aa91');
    for(const part of face.querySelectorAll('.cname,.ctext,.ctype,.card-metadata')){part.style.color='#26313a';part.style.background='transparent';}
    const body=face.querySelector('.cd-body');if(body)body.style.background='transparent';
  }
  if(sidecar.ratioWidth!==undefined||sidecar.ratioHeight!==undefined){
    const width=sidecar.ratioWidth??5,height=sidecar.ratioHeight??7;
    if(Number.isFinite(width)&&width>=1&&width<=20&&Number.isFinite(height)&&height>=1&&height<=20){
      face.style.setProperty('--card-ratio',String(width/height));
      face.style.height=`${face.offsetWidth*height/width}px`;
    }
  }
  if(Number.isFinite(sidecar.fontSize))face.querySelector('.ctext')?.style.setProperty('font-size',`${Math.max(12,Math.min(24,sidecar.fontSize))}px`);
  if(/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(sidecar.art||'')){
    const well=face.querySelector('.art');
    if(well){
      let art=well.querySelector('.editor-art');
      if(!art){art=document.createElement('img');art.className='editor-art';art.alt='Draft card artwork';art.style.cssText='position:absolute;inset:0;width:100%;height:100%;';well.querySelector('.card-art-glyph')?.remove();well.prepend(art);}
      art.src=sidecar.art;art.style.objectFit=sidecar.fit==='contain'?'contain':'cover';
    }
  }
  applyLayout(face,sidecar.layout);
}
