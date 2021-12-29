export function cstr(str: string) {
  const buf = new Uint8Array(str.length + 1);
  new TextEncoder().encodeInto(str, buf);
  return buf;
}
