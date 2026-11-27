/** True for same-origin public paths, excluding protocol-relative remote URLs. */
export function isLocalImageSource(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//');
}
