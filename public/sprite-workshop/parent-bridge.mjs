export function acceptsParentMessage(event, parentWindow, origin) {
  return parentWindow !== globalThis && event.source === parentWindow && event.origin === origin && ['sprite-workshop:open','sprite-workshop:export'].includes(event.data?.type);
}
export function validateBridgeRequest(data) {
  if (data.type === 'sprite-workshop:export') return data;
  if (typeof data.requestId !== 'string' || data.requestId.length > 150 || typeof data.recoveryKey !== 'string' || !data.recoveryKey.startsWith('pack:') || data.recoveryKey.length > 300) throw Error('Invalid sprite project request.');
  if (!data.project || Object.values(data.project.assets || {}).some(asset => !/^data:image\/(png|webp|jpeg);base64,/.test(asset.src))) throw Error('Parent imports require embedded artwork.');
  return data;
}
