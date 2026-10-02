import {publicUrl} from './paths.js';

// Fetches a build-emitted native text asset (see scripts/vite-native-assets.mjs).
// publicUrl() maps it to the embedded copy in the consolidated Pages HTML.
export async function loadNativeText(name) {
  const response = await fetch(publicUrl(name));
  if (!response.ok) throw new Error(`Native renderer source download failed (${response.status}).`);
  return response.text();
}
