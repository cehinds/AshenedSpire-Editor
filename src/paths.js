export function publicUrl(path) {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
