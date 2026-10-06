const smoothstep = (low, high, value) => {
  const t = Math.max(0,Math.min(1,(value-low)/(high-low)));
  return t*t*(3-2*t);
};
function rgb(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) throw Error('Recoloring requires a six-digit hexadecimal color.');
  return [1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
}

/** Blue/cyan facets are protected; neutral silver and warm metal blend smoothly. */
export function manaTrimMask(r, g, b) {
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const saturation = max ? (max-min)/max : 0;
  const neutral = 1-smoothstep(.15,.5,saturation);
  const warm = smoothstep(0,12,Math.min(r-b,g-b));
  const protectBlue = 1-smoothstep(3,15,b-r);
  return Math.max(neutral,warm)*protectBlue;
}

// The requested color is the midtone. Dark texture shades toward black and
// bright specular detail shades toward white, preserving the painted relief.
function shadedColor(color, luminance) {
  const light = luminance/255;
  return color.map(channel=>light <= .5 ? channel*light*2 : channel+(255-channel)*(light-.5)*2);
}

export function recolorPixels(source, { tintColor = '#ffffff', tintAmount = 0, trimColor = '#d5aa52', trimAmount = 0, manaTrim = false } = {}) {
  if (!(source instanceof Uint8ClampedArray) || source.length%4) throw Error('Recoloring requires an RGBA Uint8ClampedArray.');
  if (![tintAmount,trimAmount].every(value=>Number.isFinite(value)&&value>=0&&value<=1)) throw Error('Recoloring strengths must be between 0 and 1.');
  if (typeof manaTrim !== 'boolean') throw Error('Mana trim must be a boolean.');
  const tint = rgb(tintColor), trim = rgb(trimColor), output = new Uint8ClampedArray(source);
  if (!tintAmount && (!manaTrim || !trimAmount)) return output;
  for (let index=0;index<source.length;index+=4) {
    if (!source[index+3]) continue;
    const original = [source[index],source[index+1],source[index+2]];
    const luminance = original[0]*.2126+original[1]*.7152+original[2]*.0722;
    const tinted = shadedColor(tint,luminance), metallic = shadedColor(trim,luminance);
    const trimWeight = manaTrim ? trimAmount*manaTrimMask(...original) : 0;
    for (let channel=0;channel<3;channel++) {
      const globalTint = original[channel]+(tinted[channel]-original[channel])*tintAmount;
      // Trim overrides the global tint only on the metal mask. The gem still
      // receives an explicitly requested whole-component tint independently.
      output[index+channel] = Math.round(globalTint+(metallic[channel]-globalTint)*trimWeight);
    }
  }
  return output;
}
