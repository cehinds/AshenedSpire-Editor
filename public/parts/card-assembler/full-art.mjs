import {validate} from './model.mjs';

// Original layered card authored at 360 x 540. Image masters retain exact PNG bytes.
export const FULL_ART_HASHES = {
  "1fe4ba7f330c67fca0a61c65eabdf40a18e1aab50145843bbb33ce5b3da31de9": "as.card.full-art.frame.v1",
  "44646e73c749cce0fd78b71ea0f38155c77faeb6791c22e74cb274230abc7b95": "as.card.full-art.knight-scene.v1",
  "0949257201425783d7c83bde417ebd4657c9d53a8fea28a2ca1c4400a251041c": "as.card.full-art.parchment.v1",
  "95887e9c269a4996cf95a5c2df960461682ec6387d82b5875a84b43fefdad87b": "as.card.full-art.pennant.v1",
  "3b925ecf7406691069271ad2fc719e1e6018ae28ce20ca1564d53daebe0ddc04": "as.card.full-art.action-diamond.v1",
  "36cda4cba048ed38b0c9cd88e6ec4ec9657336c2c5c4320577eb51caf1361e26": "as.card.full-art.mana-diamond.v1",
  "f31ac0a1985194c9aa76a4fda7a2b9a1c23f96f7958cb8e5af48e4af251fe991": "as.card.full-art.stamina-orb.v1"
};
export const FULL_ART_ROLES = {
  "base": [
    "frame",
    "outer-frame"
  ],
  "art": [
    "knight-scene",
    "artwork"
  ],
  "panel": [
    "parchment",
    "rules-container"
  ],
  "flag": [
    "pennant",
    "cost-banner"
  ],
  "energy-icon": [
    "action-diamond",
    "action-icon"
  ],
  "energy-value": [
    null,
    "action-value"
  ],
  "mana-icon": [
    "mana-diamond",
    "mana-icon"
  ],
  "mana-value": [
    null,
    "mana-value"
  ],
  "stamina-icon": [
    "stamina-orb",
    "stamina-icon"
  ],
  "stamina-value": [
    null,
    "stamina-value"
  ],
  "title": [
    null,
    "title"
  ],
  "rules": [
    null,
    "rules"
  ],
  "tags": [
    null,
    "type"
  ]
};
export const CARD_CLIP_POLYGON = [[.12,.04],[.88,.04],[.95,.11],[.95,.90],[.88,.966],[.12,.966],[.052,.90],[.052,.11]];
export function cardClipPath(width, height) { return CARD_CLIP_POLYGON.map(([x,y],i)=>(i?'L':'M')+(x*width)+' '+(y*height)).join(' ')+' Z'; }
export const FULL_ART_LEGACY_LAYERS = [
  {
    "id": "base",
    "name": "Base card",
    "type": "image",
    "trim": [
      69,
      102,
      887,
      1327
    ],
    "x": 0,
    "y": 0,
    "w": 360,
    "h": 540,
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": true
  },
  {
    "id": "art",
    "name": "Card artwork",
    "type": "image",
    "x": -75,
    "y": 15,
    "w": 510,
    "h": 510,
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false,
    "clip": true,
    "artScale": 100
  },
  {
    "id": "panel",
    "name": "Text box",
    "type": "image",
    "trim": [
      36,
      208,
      1703,
      474
    ],
    "x": 24,
    "y": 346,
    "w": 312,
    "h": 147,
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false
  },
  {
    "id": "flag",
    "name": "Hanging flag",
    "type": "image",
    "trim": [
      268,
      71,
      497,
      1402
    ],
    "x": 12,
    "y": 20,
    "w": 58,
    "h": 140,
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false
  },
  {
    "id": "title",
    "name": "Title",
    "type": "text",
    "text": "Gorefire Slash",
    "x": 55,
    "y": 29,
    "w": 269,
    "h": 44,
    "font": "Georgia",
    "fontSize": 27,
    "fontWeight": "normal",
    "align": "center",
    "color": "#f3e8c9",
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false
  },
  {
    "id": "rules",
    "name": "Rules",
    "type": "text",
    "text": "Deal 5 damage.\nApply 2 Bleed.",
    "x": 43,
    "y": 370,
    "w": 274,
    "h": 89,
    "font": "Georgia",
    "fontSize": 21,
    "fontWeight": "normal",
    "align": "center",
    "color": "#291f16",
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false
  },
  {
    "id": "energy-icon",
    "name": "Action symbol",
    "type": "image",
    "trim": [
      25,
      71,
      1209,
      1183
    ],
    "x": 14.249999999999998,
    "y": 136.65717502152177,
    "w": 53.5,
    "h": 46.68564995695649,
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false,
    "groupId": "group-1791054704203"
  },
  {
    "id": "energy-value",
    "name": "Action value",
    "type": "text",
    "text": "1",
    "x": 23.88,
    "y": 144.44977153830874,
    "w": 34.24,
    "h": 18.20740348321303,
    "font": "Georgia",
    "fontSize": 20,
    "fontWeight": "bold",
    "align": "center",
    "color": "#fff5d2",
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false,
    "groupId": "group-1791054704203",
    "outline": "#101508"
  },
  {
    "id": "mana-icon",
    "name": "Mana symbol",
    "type": "image",
    "trim": [
      73,
      21,
      1137,
      1161
    ],
    "x": 13.250000000000002,
    "y": 66.62545526786305,
    "w": 53.5,
    "h": 46.68564995695649,
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false,
    "groupId": "cost-mana"
  },
  {
    "id": "mana-value",
    "name": "Mana value",
    "type": "text",
    "text": "0",
    "x": 21.87999999999998,
    "y": 78.56486325408912,
    "w": 34.24,
    "h": 18.20740348321303,
    "font": "Georgia",
    "fontSize": 20,
    "fontWeight": "bold",
    "align": "center",
    "color": "#fff5d2",
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false,
    "groupId": "cost-mana",
    "outline": "#101508"
  },
  {
    "id": "stamina-icon",
    "name": "Stamina symbol",
    "type": "image",
    "trim": [
      78,
      2,
      1152,
      1226
    ],
    "x": 23.345,
    "y": 32.79259651678697,
    "w": 35.31,
    "h": 30.812528971591288,
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false,
    "groupId": "group-1791054694852"
  },
  {
    "id": "stamina-value",
    "name": "Stamina value",
    "type": "text",
    "text": "2",
    "x": 21.879999999999995,
    "y": 34.095159260976104,
    "w": 34.24,
    "h": 18.20740348321303,
    "font": "Georgia",
    "fontSize": 20,
    "fontWeight": "bold",
    "align": "center",
    "color": "#fff5d2",
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false,
    "groupId": "group-1791054694852",
    "outline": "#101508"
  },
  {
    "id": "tags",
    "name": "Tags",
    "type": "text",
    "text": "ATTACK · FIRE",
    "x": 26,
    "y": 500,
    "w": 308,
    "h": 22,
    "font": "Georgia",
    "fontSize": 12,
    "fontWeight": "bold",
    "align": "center",
    "color": "#dec78f",
    "rotation": 0,
    "opacity": 1,
    "visible": true,
    "locked": false
  }
];

export function normalizeLegacyLayer(n, width, height, asset) {
 const sx=1024/width,sy=1536/height,role=FULL_ART_ROLES[n.id]?.[1] || n.id;
 const cost=/^(action|mana|stamina)-(icon|value)$/.exec(role);
 const item={id:'layer.'+role,asset:n.type==='text'?'text':asset,name:n.name||n.id,role,x:n.x*sx,y:n.y*sy,w:n.w*sx,h:n.h*sy,visible:n.visible!==false,locked:!!n.locked,opacity:n.opacity??1,fit:n.fit||'stretch',group:cost?'cost-'+cost[1]:n.groupId||''};
 if(n.trim)item.sourceRect=[...n.trim];
 if(n.clip)item.clipToCard=true;
 if(n.type==='text')Object.assign(item,{text:n.text,fontSize:n.fontSize*sx,fontFamily:n.font||'Georgia',fontWeight:n.fontWeight||'normal',align:({left:'start',center:'middle',right:'end'})[n.align]||'middle',color:n.color||'#f3e8c9',italic:!!n.italic,stroke:n.outline||'#000000',strokeWidth:n.outline?sx:0});
 return item;
}

export function fullArtPreset() {
 return validate({schema:'ashenspire.card-assembler',version:1,width:1024,height:1536,clipShape:'card',name:'Gorefire Slash · original full art',presetId:'as.card.preset.full-art.v1',items:FULL_ART_LEGACY_LAYERS.map(n=>normalizeLegacyLayer(n,360,540,n.type==='image'?'as.card.full-art.'+FULL_ART_ROLES[n.id][0]+'.v1':undefined))});
}
