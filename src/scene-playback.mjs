// The frame runs the vendored game renderer; this module only adapts editor data.
export function sceneFramePayload(project, selectedId, context = {}, playing = false) {
  const sequence = project?.scenes?.components?.sequence;
  if (!sequence || !Array.isArray(sequence.scenes)) throw new Error('A native scene sequence is required.');
  const classId = context.classId || sequence.presentation?.previewClass || 'reaver';
  return {
    sequence,
    selectedId,
    playing,
    settings: Object.fromEntries(Object.entries(project.gameSettings?.overrides || {}).filter(([key]) => key.startsWith('settings.')).map(([key, value]) => [key.slice(9), value])),
    run: {class: classId, customization: {name: context.name || 'Preview traveller'}, journey: {anchors: {start: context.location || 'Preview location'}}}
  };
}

export function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function sceneFrameDocument({runtime, styles, assets, payload, channel}) {
  const resolvedStyles = styles.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g, (full, quote, path) => {
    const key = path.replace(/^(\.\.\/)+/, '');
    return assets[key] ? `url("${assets[key]}")` : full;
  });
  // Escape closing tags even in game data, so draft text cannot leave its script.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${resolvedStyles.replace(/<\/style/gi, '<\\/style')}\nhtml,body{margin:0!important;width:100%;height:100%;overflow:hidden}#preview-host{width:100%;height:100%}.prologue-screen{height:100dvh;min-height:100dvh}button:focus-visible{outline:2px solid #eac16e;outline-offset:3px}</style></head><body><div id="preview-host"></div><script>${runtime.replace(/<\/script/gi, '<\\/script')}\n</script><script>
const payload=${scriptJson(payload)}, channel=${scriptJson(channel)};
const send=value=>parent.postMessage({channel,...value},'*');
const host=document.getElementById('preview-host');
try {
  Object.assign(AshenNative.ASSET_MAP,${scriptJson(assets)});
  const changes=AshenNative.prologuePresetOverrides(payload.sequence);
  const settings={...payload.settings,...changes};
  const rows=AshenNative.prologueRows();
  const rejected=Object.entries(changes).filter(([key,value])=>{const row=rows.find(row=>row.key===key);return row&&!AshenNative.prologueValueIsValid(row,value);}).map(([key])=>key);
  if(rejected.length) send({type:'warning',message:'Native validation uses defaults for invalid values: '+rejected.join(', ')});
  const config=AshenNative.prologueConfig(settings);
  const startScene=Math.max(0,config.scenes.findIndex(scene=>scene.id===payload.selectedId));
  // The full game focuses Continue on entry; a live editor refresh must keep
  // focus in the field being edited. Restore normal focus immediately after mount.
  const focus=HTMLElement.prototype.focus;
  let cleanup;
  let finished=false;
  try {
    HTMLElement.prototype.focus=function(){};
    cleanup=AshenNative.mountPrologue(host,{settings,run:payload.run,startScene,preview:true,onScene:index=>send({type:'scene',id:config.scenes[index]?.id,name:config.scenes[index]?.name}),onFinish:reason=>{finished=true;host.querySelectorAll('button').forEach(button=>button.disabled=true);send({type:'finished',reason});}});
  } finally {HTMLElement.prototype.focus=focus;}
  const pause=host.querySelector('.prologue-controls button');
  if(!payload.playing) pause?.click();
  send({type:'state',state:payload.playing?'Playing':'Ready'});
  host.addEventListener('click',event=>{
    if(finished)return;
    const button=event.target.closest('button');
    if(!button)return;
    if(button===pause)send({type:'state',state:button.textContent===config.labels.resume?'Paused':'Playing'});
    else if(button.textContent===config.labels.replay)send({type:'state',state:'Playing'});
  });
  addEventListener('message',event=>{
    if(event.source!==parent||event.data?.channel!==channel||event.data?.type!=='scene-command'||finished)return;
    const command=event.data.command;
    const paused=pause?.textContent===config.labels.resume;
    if((command==='pause'&&!paused)||(command==='resume'&&paused))pause?.click();
  });
  addEventListener('pagehide',()=>cleanup(),{once:true});
} catch(error) {
  host.textContent='Preview could not start: '+error.message;
  send({type:'error',message:error.message});
}
</script></body></html>`;
}
