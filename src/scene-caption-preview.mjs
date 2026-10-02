// Existing document fields, applied by the editor preview only. The vendored
// game renderer and exported native source bytes remain untouched.
// Serialize the whole closure so production minification can rename its local
// functions without leaving broken references inside an isolated frame.
function captionPreviewRuntime() {
function resolveCaptionPreview(sequence, sceneId) {
  const scene = typeof sceneId === 'object' ? sceneId : sequence?.scenes?.find(item => item.id === sceneId);
  const result = {captionFixedHeight: false, captionHeightVh: 18, captionVerticalAlign: 'auto', captionOverflow: 'scroll'};
  for (const block of [sequence?.presentation, scene?.ownStaging ? scene.stage : null]) {
    if (typeof block?.captionFixedHeight === 'boolean') result.captionFixedHeight = block.captionFixedHeight;
    const height = block?.captionHeightVh;
    if (typeof height === 'number' && Number.isFinite(height) && height >= 1 && height <= 100) result.captionHeightVh = height;
    if (['auto', 'top', 'middle', 'bottom'].includes(block?.captionVerticalAlign)) result.captionVerticalAlign = block.captionVerticalAlign;
    if (['scroll', 'shrink', 'clip'].includes(block?.captionOverflow)) result.captionOverflow = block.captionOverflow;
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
  for (const mode of ['shrink', 'clip']) screen.classList.toggle(`editor-caption-overflow-${mode}`, value.captionFixedHeight && value.captionOverflow === mode);
  if (!host.__editorCaptionFit && typeof requestAnimationFrame === 'function') {
    const loop = () => {if (host.isConnected === false) {host.__editorCaptionFit = 0;return;}fitCaption(host);host.__editorCaptionFit = requestAnimationFrame(loop);};
    host.__editorCaptionFit = requestAnimationFrame(loop);
  }
}

// Shrink to fit scales only the caption's text, never the fixed box. The
// search reruns when the text, box height or base text size changes, which
// also covers progressive reveals.
function fitCaption(host) {
  const screen = host.querySelector('.prologue-screen');
  const caption = host.querySelector('.prologue-caption');
  if (!screen?.classList || !caption?.style) return null;
  const shrink = screen.classList.contains('editor-caption-overflow-shrink');
  if (!shrink) {
    if (caption.dataset.editorFit) {caption.style.removeProperty('--prologue-text-scale');delete caption.dataset.editorFit;delete caption.dataset.editorFitKey;}
    return {overflow: caption.scrollHeight > caption.clientHeight + 1, fit: 1};
  }
  const base = Number.parseFloat(getComputedStyle(screen).getPropertyValue('--prologue-text-scale')) || 1;
  const key = [caption.textContent.length, caption.clientHeight, caption.clientWidth, base].join(':');
  if (caption.dataset.editorFitKey !== key) {
    const fits = factor => {caption.style.setProperty('--prologue-text-scale', String(base * factor));return caption.scrollHeight <= caption.clientHeight + 1;};
    let factor = 1;
    if (!fits(1)) {
      let low = .4, high = 1;
      for (let step = 0; step < 7; step++) {const middle = (low + high) / 2;if (fits(middle)) low = middle;else high = middle;}
      factor = low;
      fits(factor);
    }
    caption.dataset.editorFit = String(Math.round(factor * 100) / 100);
    caption.dataset.editorFitKey = key;
  }
  return {overflow: caption.scrollHeight > caption.clientHeight + 1, fit: Number(caption.dataset.editorFit) || 1};
}
return {resolveCaptionPreview, applyCaptionPreview, fitCaption};
}

export const {resolveCaptionPreview, applyCaptionPreview, fitCaption} = captionPreviewRuntime();

// Self-contained functions embedded in the isolated frame, with no imports,
// parent DOM access, asset dependencies or native runtime source modification.
export const captionPreviewScript = () => `const {resolveCaptionPreview,applyCaptionPreview,fitCaption}=(${captionPreviewRuntime.toString()})();`;

export const captionPreviewStyles = `
.prologue-screen.editor-caption-fixed .prologue-caption{box-sizing:border-box;height:var(--editor-caption-height);min-height:0;max-height:var(--editor-caption-height);overflow:auto}
.prologue-screen.editor-caption-fixed.prologue-layout-caption,.prologue-screen.editor-caption-fixed.prologue-layout-letterbox{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) var(--editor-caption-height) auto}
.prologue-screen.editor-caption-fixed.prologue-layout-caption .prologue-caption,.prologue-screen.editor-caption-fixed.prologue-layout-letterbox .prologue-caption{grid-row:2;grid-column:1}
.prologue-screen.editor-caption-fixed.prologue-layout-caption .prologue-stage,.prologue-screen.editor-caption-fixed.prologue-layout-letterbox .prologue-stage{grid-row:1;grid-column:1}
.prologue-screen.editor-caption-fixed.prologue-layout-caption .prologue-bar,.prologue-screen.editor-caption-fixed.prologue-layout-letterbox .prologue-bar{grid-row:3;grid-column:1}
.prologue-screen:is(.editor-caption-valign-top,.editor-caption-valign-middle,.editor-caption-valign-bottom) .prologue-caption{display:flex;flex-direction:column;align-content:normal}
.prologue-screen.editor-caption-fixed:is(.editor-caption-overflow-shrink,.editor-caption-overflow-clip) .prologue-caption{overflow:hidden}
.prologue-screen.editor-caption-valign-top .prologue-caption{justify-content:flex-start}
.prologue-screen.editor-caption-valign-middle .prologue-caption{justify-content:safe center}
.prologue-screen.editor-caption-valign-bottom .prologue-caption{justify-content:safe flex-end}
@media(max-width:760px) and (orientation:portrait){
  .prologue-screen.editor-caption-fixed.prologue-layout-panelLeft,.prologue-screen.editor-caption-fixed.prologue-layout-panelRight,.prologue-screen.editor-caption-fixed.prologue-layout-overlay{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) var(--editor-caption-height) auto}
  .prologue-screen.editor-caption-fixed .prologue-caption{grid-row:2;grid-column:1}
  .prologue-screen.editor-caption-fixed .prologue-stage{grid-row:1;grid-column:1}
  .prologue-screen.editor-caption-fixed .prologue-bar{grid-row:3;grid-column:1}
}`.replaceAll(/\.prologue-screen(?=[.:])/g, ':is(#studio-host,#preview-host) .prologue-screen');
