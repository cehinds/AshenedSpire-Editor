// Existing document fields, applied by the editor preview only. The vendored
// game renderer and exported native source bytes remain untouched.
// Serialize the whole closure so production minification can rename its local
// functions without leaving broken references inside an isolated frame.
function captionPreviewRuntime() {
function resolveCaptionPreview(sequence, sceneId) {
  const scene = typeof sceneId === 'object' ? sceneId : sequence?.scenes?.find(item => item.id === sceneId);
  const result = {captionFixedHeight: false, captionHeightVh: 18, captionVerticalAlign: 'auto'};
  for (const block of [sequence?.presentation, scene?.ownStaging ? scene.stage : null]) {
    if (typeof block?.captionFixedHeight === 'boolean') result.captionFixedHeight = block.captionFixedHeight;
    const height = block?.captionHeightVh;
    if (typeof height === 'number' && Number.isFinite(height) && height >= 1 && height <= 100) result.captionHeightVh = height;
    if (['auto', 'top', 'middle', 'bottom'].includes(block?.captionVerticalAlign)) result.captionVerticalAlign = block.captionVerticalAlign;
  }
  return result;
}

function applyCaptionPreview(host, sequence, sceneId) {
  const screen = host.querySelector('.prologue-screen');
  if (!screen?.classList || !screen.style) return;
  const value = resolveCaptionPreview(sequence, sceneId);
  screen.classList.toggle('editor-caption-fixed', value.captionFixedHeight);
  if (value.captionFixedHeight) screen.style.setProperty('--editor-caption-height', `${value.captionHeightVh}vh`);
  else screen.style.removeProperty('--editor-caption-height');
  for (const align of ['top', 'middle', 'bottom']) screen.classList.toggle(`editor-caption-valign-${align}`, value.captionVerticalAlign === align);
}
return {resolveCaptionPreview, applyCaptionPreview};
}

export const {resolveCaptionPreview, applyCaptionPreview} = captionPreviewRuntime();

// Self-contained functions embedded in the isolated frame, with no imports,
// parent DOM access, asset dependencies or native runtime source modification.
export const captionPreviewScript = () => `const {resolveCaptionPreview,applyCaptionPreview}=(${captionPreviewRuntime.toString()})();`;

export const captionPreviewStyles = `
.prologue-screen.editor-caption-fixed .prologue-caption{box-sizing:border-box;height:var(--editor-caption-height);min-height:0;max-height:var(--editor-caption-height);overflow:auto}
.prologue-screen.editor-caption-fixed.prologue-layout-caption,.prologue-screen.editor-caption-fixed.prologue-layout-letterbox{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) var(--editor-caption-height) auto}
.prologue-screen.editor-caption-fixed.prologue-layout-caption .prologue-caption,.prologue-screen.editor-caption-fixed.prologue-layout-letterbox .prologue-caption{grid-row:2;grid-column:1}
.prologue-screen.editor-caption-fixed.prologue-layout-caption .prologue-stage,.prologue-screen.editor-caption-fixed.prologue-layout-letterbox .prologue-stage{grid-row:1;grid-column:1}
.prologue-screen.editor-caption-fixed.prologue-layout-caption .prologue-bar,.prologue-screen.editor-caption-fixed.prologue-layout-letterbox .prologue-bar{grid-row:3;grid-column:1}
.prologue-screen:is(.editor-caption-valign-top,.editor-caption-valign-middle,.editor-caption-valign-bottom) .prologue-caption{display:flex;flex-direction:column;align-content:normal}
.prologue-screen.editor-caption-valign-top .prologue-caption{justify-content:flex-start}
.prologue-screen.editor-caption-valign-middle .prologue-caption{justify-content:safe center}
.prologue-screen.editor-caption-valign-bottom .prologue-caption{justify-content:safe flex-end}
@media(max-width:760px) and (orientation:portrait){
  .prologue-screen.editor-caption-fixed.prologue-layout-panelLeft,.prologue-screen.editor-caption-fixed.prologue-layout-panelRight,.prologue-screen.editor-caption-fixed.prologue-layout-overlay{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) var(--editor-caption-height) auto}
  .prologue-screen.editor-caption-fixed .prologue-caption{grid-row:2;grid-column:1}
  .prologue-screen.editor-caption-fixed .prologue-stage{grid-row:1;grid-column:1}
  .prologue-screen.editor-caption-fixed .prologue-bar{grid-row:3;grid-column:1}
}`.replaceAll(/\.prologue-screen(?=[.:])/g, ':is(#studio-host,#preview-host) .prologue-screen');
