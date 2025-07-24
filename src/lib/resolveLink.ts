// lib/resolveLink.ts  (already suggested)
export function resolveLink(uri?: string) {
  if (!uri) return '';
  if (uri.startsWith('ipfs://'))
    return 'https://ipfs.io/ipfs/' + uri.slice(7);    // any gateway
  if (uri.startsWith('ar://'))
    return 'https://arweave.net/' + uri.slice(5);
  return uri;
}
