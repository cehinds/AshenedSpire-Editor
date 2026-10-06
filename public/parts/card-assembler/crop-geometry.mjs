import {imagePlacement} from './image-placement.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Convert fit/cover padding into an equivalent source crop before direct editing.
// Geometry stays in card units; sourceRect always refers to the untouched image.
export function normalizedCrop(layer,width,height){
 const r=layer.sourceRect||[0,0,width,height],p=imagePlacement(layer,r[2],r[3]);
 const sx=p.w/r[2],sy=p.h/r[3];
 const x=Math.max(layer.x,p.x),y=Math.max(layer.y,p.y),right=Math.min(layer.x+layer.w,p.x+p.w),bottom=Math.min(layer.y+layer.h,p.y+p.h);
 return {...layer,x,y,w:right-x,h:bottom-y,fit:'stretch',cropX:.5,cropY:.5,sourceRect:[r[0]+(x-p.x)/sx,r[1]+(y-p.y)/sy,(right-x)/sx,(bottom-y)/sy]};
}

export function fullImageBounds(layer,width,height){
 const n=normalizedCrop(layer,width,height),r=n.sourceRect,sx=n.w/r[2],sy=n.h/r[3];
 return {x:n.x-r[0]*sx,y:n.y-r[1]*sy,w:width*sx,h:height*sy};
}

export function panCrop(layer,width,height,dx,dy){
 if(layer.locked)return {...layer};
 const n=normalizedCrop(layer,width,height),r=n.sourceRect;
 n.sourceRect=[clamp(r[0]-dx*r[2]/n.w,0,width-r[2]),clamp(r[1]-dy*r[3]/n.h,0,height-r[3]),r[2],r[3]];
 return n;
}

export function trimCrop(layer,width,height,handle,dx,dy){
 if(layer.locked)return {...layer};
 if(!['nw','n','ne','e','se','s','sw','w'].includes(handle))throw Error('Unknown crop handle');
 const n=normalizedCrop(layer,width,height),r=n.sourceRect,sx=n.w/r[2],sy=n.h/r[3],full=fullImageBounds(n,width,height);
 let left=n.x,top=n.y,right=n.x+n.w,bottom=n.y+n.h;
 const minW=Math.min(n.w,Math.max(4,sx)),minH=Math.min(n.h,Math.max(4,sy));
 if(handle.includes('w'))left=clamp(left+dx,Math.max(full.x,right-4096),right-minW);
 if(handle.includes('e'))right=clamp(right+dx,left+minW,Math.min(full.x+full.w,left+4096));
 if(handle.includes('n'))top=clamp(top+dy,Math.max(full.y,bottom-4096),bottom-minH);
 if(handle.includes('s'))bottom=clamp(bottom+dy,top+minH,Math.min(full.y+full.h,top+4096));
 // Roundoff at image boundaries must not make a valid saved crop exceed its source.
 const sourceX=clamp(r[0]+(left-n.x)/sx,0,width),sourceY=clamp(r[1]+(top-n.y)/sy,0,height);
 return {...n,x:left,y:top,w:right-left,h:bottom-top,sourceRect:[sourceX,sourceY,Math.min((right-left)/sx,width-sourceX),Math.min((bottom-top)/sy,height-sourceY)]};
}

export function resetCrop(layer,width,height){
 if(layer.locked)return {...layer};
 const n=normalizedCrop(layer,width,height),full=fullImageBounds(n,width,height);
 const result={...n,...full,fit:'stretch',cropX:.5,cropY:.5};delete result.sourceRect;return result;
}
