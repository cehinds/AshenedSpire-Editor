// Downloaded HTML has an opaque messaging origin even when location.origin is
// serialized as file://. The callers additionally verify the exact frame window.
export function footerMessageTarget(location) {
 return location.protocol==='file:'||location.origin==='null'?'*':location.origin;
}
export function footerMessageOrigin(origin,location) {
 return footerMessageTarget(location)==='*'?origin==='null':origin===location.origin;
}
