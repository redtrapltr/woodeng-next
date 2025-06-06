import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1) Load your keypair
console.log("🔍 Loading keypair...");
const secret = JSON.parse(fs.readFileSync(__dirname + "/mykeypair.json", "utf8"));
const keypair = Keypair.fromSecretKey(new Uint8Array(secret));

// 2) Connect to mainnet-beta
console.log("🔗 Connecting to mainnet-beta...");
const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// 3) Configure Metaplex
console.log("⚙️ Initializing Metaplex...");
const metaplex = new Metaplex(connection).use(keypairIdentity(keypair));

// 4) List of your CID codes
const cids = [
  "bafkreieueyldtgfm3b3pm3dvxr6kmfsqcr5ilsjqjmxt3j5mrprfugo3pe",
  "bafkreibzqizt7hpea7usg4qwxrlg4wno3c3n2tnvqvzfv5qtp7taufs354"  
];

// Map each CID to a full URL (using the Pinata gateway)
const uris = cids.map((cid) => `https://gateway.pinata.cloud/ipfs/${cid}`);

async function main() {
  for (const uri of uris) {
    try {
      console.log(`🚀 Minting NFT for URI: ${uri}`);
      const response = await metaplex.nfts().create(
        {
          uri,
          name: "MyMusicNFT", // Optionally, customize name per NFT if needed
          symbol: "MUSC",
          sellerFeeBasisPoints: 500,
          creators: [
            {
              address: keypair.publicKey,
              share: 100,
              verified: true,
            },
          ],
        },
        { skipPreflight: true, commitment: "confirmed" }
      );
      if (response && response.nft && response.nft.address) {
        console.log("✅ Minted NFT with address:", response.nft.address.toBase58());
      } else {
        console.error("❌ Unexpected response:", response);
      }
    } catch (err) {
      console.error("❌ Error minting NFT for URI", uri, ":", err);
    }
  }
}

main().catch(console.error);
