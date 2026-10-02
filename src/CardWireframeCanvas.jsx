import {GameCardPreview} from './LazyNative.jsx';

// Visual authoring and In game share the exact native face and presentation adapter.
export function CardWireframeCanvas({ctx}) {
  return <GameCardPreview ctx={ctx} editable/>;
}
