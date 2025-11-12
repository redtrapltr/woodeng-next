import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import inquirer from "inquirer";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Setup __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1) Load your keypair from file
console.log("🔍 Loading keypair...");
const secret = JSON.parse(fs.readFileSync(__dirname + "/mykeypair.json", "utf8"));
const keypair = Keypair.fromSecretKey(new Uint8Array(secret));

// 2) Connect to Solana mainnet-beta
console.log("🔗 Connecting to Solana mainnet-beta...");
const connection = new Connection("process.env.NEXT_PUBLIC_SOLANA_RPC as string", "confirmed");

// 3) Initialize Metaplex
console.log("⚙️ Initializing Metaplex...");
const metaplex = new Metaplex(connection).use(keypairIdentity(keypair));

async function main() {
  // Gather creator input via CLI
  const answers = await inquirer.prompt([
    { type: "input", name: "name", message: "Enter song name:" },
    { type: "input", name: "symbol", message: "Enter NFT symbol:" },
    { type: "input", name: "description", message: "Enter song description:" },
    { type: "input", name: "imageUrl", message: "Enter image URL (Arweave):" },
    { type: "input", name: "animationUrl", message: "Enter animation URL (Arweave):" },
    { type: "input", name: "externalUrl", message: "Enter external URL:" },
    { type: "input", name: "genre", message: "Enter genre:" },
    { type: "input", name: "artist", message: "Enter artist name:" },
    { type: "input", name: "album", message: "Enter album name:" },
    { type: "input", name: "releaseDate", message: "Enter release date:" },
    { type: "input", name: "trackNumber", message: "Enter track number:" },
    { 
      type: "list", 
      name: "rarity", 
      message: "Select rarity (mint supply determines rarity):",
      choices: ["Common", "Uncommon", "Rare", "Epic", "Legendary"]
    },
    { type: "input", name: "price", message: "Enter price in Woodeng token:" },
    { type: "input", name: "mintQuantity", message: "Enter total quantity to mint:" },
    { type: "input", name: "creatorShare", message: "Enter creator percentage (of remaining revenue after platform fee):" },
    { 
      type: "input", 
      name: "poolShare", 
      message: "Enter trading pool percentage (minimum 20%):",
      validate: (value) => parseInt(value) >= 20 ? true : "Trading pool must be at least 20%"
    }
  ]);

  // Build metadata JSON object (for reference or upload)
  const metadata = {
    name: answers.name,
    symbol: answers.symbol,
    description: answers.description,
    seller_fee_basis_points: 1000,
    image: answers.imageUrl,
    animation_url: answers.animationUrl,
    external_url: answers.externalUrl,
    attributes: [
      { trait_type: "Collection", value: "Woodeng CryptoEggz" },
      { trait_type: "Genre", value: answers.genre },
      { trait_type: "Artist", value: answers.artist },
      { trait_type: "Album", value: answers.album },
      { trait_type: "ReleaseDate", value: answers.releaseDate },
      { trait_type: "TrackName", value: answers.name },
      { trait_type: "TrackNumber", value: answers.trackNumber },
      { trait_type: "Rarity", value: answers.rarity }
    ],
    collection: {
      name: "Woodeng CryptoEggz",
      family: "Woodeng CryptoEggz"
    },
    properties: {
      files: [
        {
          uri: answers.animationUrl,
          type: "video/mp4"
        }
      ],
      category: "video"
    }
  };

  console.log("Generated metadata JSON:");
  console.log(JSON.stringify(metadata, null, 2));

  // The next step is to upload the metadata JSON to a decentralized storage service
  // (like Arweave or IPFS) and get its URI. For this example, we’ll ask you to enter the final metadata URI.
  const metaAnswer = await inquirer.prompt([
    { type: "input", name: "metadataUri", message: "Enter the final metadata URI (after upload to Arweave/IPFS):" }
  ]);

  // Mint the NFT using the provided metadata URI.
  try {
    console.log("🚀 Minting NFT...");
    const response = await metaplex.nfts().create(
      {
        uri: metaAnswer.metadataUri,
        name: answers.name,
        symbol: answers.symbol,
        sellerFeeBasisPoints: 1000,
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
      console.log("✅ NFT minted successfully!");
      console.log("Mint address:", response.nft.address.toBase58());
    } else {
      console.error("❌ Unexpected response:", response);
    }
  } catch (err) {
    console.error("❌ Error minting NFT:", err);
  }

  // Additional logic (price setting, revenue split, trading pool setup) would need to be
  // implemented in your smart contract(s) and backend. This script focuses on minting the NFT.
}

main().catch(console.error);
