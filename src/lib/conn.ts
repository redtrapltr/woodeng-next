import { Connection, clusterApiUrl } from '@solana/web3.js';

let _conn: Connection | null = null;

export function getConnection(): Connection {
  if (_conn) return _conn;

  const env = process.env.NEXT_PUBLIC_SOLANA_RPC;
  const endpoint =
    env && (env.startsWith('http://') || env.startsWith('https://'))
      ? env
      : clusterApiUrl('mainnet-beta'); // safe fallback

  _conn = new Connection(endpoint, 'confirmed');
  return _conn;
}
