export function imagePlacement(layer, width, height) {
  let {x,y,w,h}=layer;
  if(layer.fit==='contain'||layer.fit==='cover'){
    const scale=(layer.fit==='cover'?Math.max:Math.min)(w/width,h/height);
    const iw=width*scale,ih=height*scale;
    x+=(w-iw)*(layer.cropX??.5);y+=(h-ih)*(layer.cropY??.5);w=iw;h=ih;
  }
  return {x,y,w,h};
}
