export function publicUrl(path) {
  const name = path.replace(/^\/+/, '');
  return globalThis.__ASHENEDSPIRE_ASSET_URL__?.(name) ?? import.meta.env.BASE_URL + name;
}

export function publicHtml(path) {
  return globalThis.__ASHENEDSPIRE_HTML__?.(path.replace(/^\/+/, ''));
}

// Opaque-origin preview frames cannot read Blob URLs owned by the editor.
export function publicFrameUrl(path) {
  return globalThis.__ASHENEDSPIRE_FRAME_URL__?.(path.replace(/^\/+/, '')) ?? publicUrl(path);
}
