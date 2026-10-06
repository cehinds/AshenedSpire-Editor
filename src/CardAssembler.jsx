import {publicUrl} from './paths.js';
import './card-assembler.css';

export function CardAssembler() {
 return <div className="card-assembler-host">
  <iframe title="Card Assembler" src={publicUrl(import.meta.env.DEV ? 'parts/card-assembler/index.html' : 'card-assembler.html')} allowFullScreen/>
 </div>;
}
