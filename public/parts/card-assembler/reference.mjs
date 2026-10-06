import {preset,validate} from './model.mjs';
// Composition derived from the user's October 5 reference. Resource badges
// intentionally overhang the frame; viewport and exports retain the overflow.
export function referencePreset(){
 const doc=preset('as.card.preset.09.v1');
 doc.name='Gorefire · reference layout';doc.presetId='as.card.preset.reference.v1';
 const patch=(role,values)=>Object.assign(doc.items.find(n=>n.role===role),values);
 patch('background',{asset:'as.card.background.charcoal.v1'});
 patch('rules-background',{asset:'as.card.background.charcoal.v1'});
 patch('title-container',{asset:'as.card.header.plain.v1'});
 patch('title',{x:180,y:95,w:720,h:130,fontSize:76,fontWeight:'bold'});
 patch('rules-container',{asset:'as.card.rules-panel.rounded.v1'});
 patch('flavor-divider',{asset:'as.card.divider.line.v1'});
 patch('rules',{fontWeight:'bold'});
 patch('flavor',{fontSize:49});
 patch('action-rim',{x:-50,y:8,w:204,h:204});
 patch('action-icon',{x:-43,y:15,w:190,h:190});
 patch('action-value',{x:-22,y:35,w:148,h:145,fontSize:106});
 patch('mana-icon',{x:-65,y:200,w:260,h:310});
 patch('mana-value',{x:6,y:301,w:118,h:110,fontSize:87});
 patch('mana-mount',{x:-50,y:215,w:230,h:280,visible:false});
 return validate(doc);
}
