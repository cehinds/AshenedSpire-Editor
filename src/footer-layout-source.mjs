import {validate} from '../public/parts/footer-atelier/model.mjs';

export const FOOTER_SOURCE = 'content/config/ui/presentation/footerLayout.json';
export function readFooterSource(content) {
  if (typeof content !== 'string' || content.length > 2_000_000) throw Error('Footer layout must be a JSON document under 2 MB.');
  return validate(JSON.parse(content)?.components?.layout);
}
export function reviewFooterSource(content, document) {
  readFooterSource(content);
  const source = JSON.parse(content);
  source.components.layout = validate(document);
  return {before:content, after:JSON.stringify(source, null, 2)+'\n'};
}
