import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { clusterApiUrl } from '@solana/web3.js';

const nftMint = new PublicKey('BLz7awNWb5Dau3S9Ln3foWuVtV8Fr5swhyKTRbd97TQL'); // The NFT mint address
const ownerPubkey = new PublicKey('9kWpMCp4qWF3x6FABF3Top55CMeDtQCQNt6vS5NKNA8u'); // Your wallet public key

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC as string, 'confirmed');

async function checkNftOwnership() {
  const ata = await getAssociatedTokenAddress(nftMint, ownerPubkey);
  console.log('Expected ATA address:', ata.toBase58());
  
  try {
    const info = await connection.getTokenAccountBalance(ata);
    console.log('Raw getTokenAccountBalance result:', info);
    if (info && info.value && Number(info.value.amount) > 0) {
      console.log('Wallet owns the NFT! Balance:', info.value.amount);
    } else {
      console.log('Wallet does NOT own this NFT.');
    }
  } catch (e) {
    console.log('Wallet does NOT own this NFT (no ATA found).');
    console.error(e);
  }
}

checkNftOwnership();
