import { Connection, PublicKey } from '@solana/web3.js';
import { clusterApiUrl } from '@solana/web3.js';

async function main() {
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC as string, 'confirmed');
  const pk = new PublicKey('83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5');

  const info = await connection.getParsedAccountInfo(pk);
  if (!info.value) {
    console.log('No account found on mainnet for that address.');
    return;
  }

  // @ts-ignore – parsed layout is loosely typed
  const owner = info.value.owner?.toBase58?.() || String(info.value.owner);
  // @ts-ignore
  const parsedType = info.value.data?.parsed?.type;

  console.log('owner:', owner);          // expect TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
  console.log('parsed.type:', parsedType); // expect "mint"
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
