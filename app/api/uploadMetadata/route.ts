import { NextResponse } from "next/server";
import { WebBundlr } from "@bundlr-network/client";
import {
  Keypair,
  Transaction,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";
import nacl from "tweetnacl";

// ─── Custom wallet wrapper ─────────────────────────────────
class CustomSolanaWallet {
  keypair: Keypair;
  constructor(keypair: Keypair) {
    this.keypair = keypair;
  }

  get publicKey() {
    return this.keypair.publicKey;
  }

  // Used by Bundlr to sign Arweave transactions (signMessage)
  async signMessage(msg: Uint8Array): Promise<Uint8Array> {
    return nacl.sign.detached(msg, this.keypair.secretKey);
  }

  // Used by Bundlr’s Solana provider to sign SPL transfers
  async signTransaction(tx: Transaction): Promise<Transaction> {
    tx.partialSign(this.keypair);
    return tx;
  }

  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return txs.map((tx) => {
      tx.partialSign(this.keypair);
      return tx;
    });
  }

  // THIS is what was missing: Bundlr calls wallet.sendTransaction(...)
  // We implement it by serializing and sending via the standard web3 Connection
  async sendTransaction(
    tx: Transaction,
    connection: Connection,
    opts?: any
  ): Promise<string> {
    // ensure fee-payer + blockhash
    tx.feePayer = this.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    // sign & serialize
    tx.partialSign(this.keypair);
    const raw = tx.serialize();

    // dispatch
    const sig = await connection.sendRawTransaction(raw);
    await connection.confirmTransaction(sig);
    return sig;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // ─── Metadata fields ────────────────────────────────────
    const name        = formData.get("songName")    as string;
    const symbol      = "MUSIC";
    const description = formData.get("description") as string;
    const artist      = formData.get("artist")      as string;
    const album       = formData.get("albumName")   as string;
    const trackNumber = formData.get("trackNumber") as string;

    // ─── Required files ─────────────────────────────────────
    const coverImageFile = formData.get("coverImage") as File | null;
    const videoFile      = formData.get("videoFile")  as File | null;
    if (!coverImageFile) throw new Error("Cover image required");
    if (!videoFile)      throw new Error("Video required");

    // ─── Buffers ────────────────────────────────────────────
    const coverBuffer = Buffer.from(await coverImageFile.arrayBuffer());
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());

    // ─── Optional audio ─────────────────────────────────────
    const mp3File  = formData.get("mp3File")  as File | null;
    const wavFile  = formData.get("wavFile")  as File | null;
    const flacFile = formData.get("flacFile") as File | null;
    const aiffFile = formData.get("aiffFile") as File | null;

    // ─── Load your on-disk keypair ──────────────────────────
    const keypairPath  = path.join(process.cwd(), "scripts", "mykeypair.json");
    const raw          = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
    const keypair      = Keypair.fromSecretKey(new Uint8Array(raw));
    const walletSigner = new CustomSolanaWallet(keypair);

    // ─── Init Bundlr ────────────────────────────────────────
    const bundlr = new WebBundlr(
      "https://devnet.bundlr.network",
      "solana",
      walletSigner,
      { providerUrl: clusterApiUrl("devnet") }
    );
    await bundlr.ready();

    // ─── Top-up 1 SOL so you never run low on lamports ───────
    
// 1️⃣  figure out how many bytes you’re about to upload
const totalBytes =
  coverBuffer.length +
  videoBuffer.length +
  (mp3File  ? mp3File.size  : 0) +
  (wavFile  ? wavFile.size  : 0) +
  (flacFile ? flacFile.size : 0) +
  (aiffFile ? aiffFile.size : 0) ;
  

// 2️⃣  ask Bundlr “how much dev-SOL is that?”
const basePrice = await bundlr.getPrice(totalBytes);   // BN (lamports)

// 3️⃣  add a 50 % tip so miners pick it up quickly
const fundAmount = basePrice.multipliedBy(1.5).integerValue();

// 4️⃣  fund once, with the calculated amount
await bundlr.fund(fundAmount);
  

    // ─── Upload the cover ───────────────────────────────────
    const coverTx = await bundlr.upload(coverBuffer, {
      tags: [{ name: "Content-Type", value: coverImageFile.type }],
    });
    const coverUrl = `https://arweave.net/${coverTx.id}`;

    // ─── Upload the video ───────────────────────────────────
    const videoTx = await bundlr.upload(videoBuffer, {
      tags: [{ name: "Content-Type", value: videoFile.type }],
    });
    const videoUrl = `https://arweave.net/${videoTx.id}`;

    // ─── Upload optional audio ──────────────────────────────
    let mp3Url  = "";
    if (mp3File) {
      const buf = Buffer.from(await mp3File.arrayBuffer());
      const tx  = await bundlr.upload(buf, {
        tags: [{ name: "Content-Type", value: mp3File.type }],
      });
      mp3Url = `https://arweave.net/${tx.id}`;
    }
    let wavUrl  = "";
    if (wavFile) {
      const buf = Buffer.from(await wavFile.arrayBuffer());
      const tx  = await bundlr.upload(buf, {
        tags: [{ name: "Content-Type", value: wavFile.type }],
      });
      wavUrl = `https://arweave.net/${tx.id}`;
    }
    let flacUrl = "";
    if (flacFile) {
      const buf = Buffer.from(await flacFile.arrayBuffer());
      const tx  = await bundlr.upload(buf, {
        tags: [{ name: "Content-Type", value: flacFile.type }],
      });
      flacUrl = `https://arweave.net/${tx.id}`;
    }
    let aiffUrl = "";
    if (aiffFile) {
      const buf = Buffer.from(await aiffFile.arrayBuffer());
      const tx  = await bundlr.upload(buf, {
        tags: [{ name: "Content-Type", value: aiffFile.type }],
      });
      aiffUrl = `https://arweave.net/${tx.id}`;
    }

    // ─── Build the `files` array for your JSON ───────────────
    const filesArray = [
      { uri: videoUrl, type: videoFile.type },
      ...(mp3Url  ? [{ uri: mp3Url,  type: mp3File!.type  }] : []),
      ...(wavUrl  ? [{ uri: wavUrl,  type: wavFile!.type  }] : []),
      ...(flacUrl ? [{ uri: flacUrl, type: flacFile!.type }] : []),
      ...(aiffUrl? [{ uri: aiffUrl, type: aiffFile!.type}] : []),
    ];

    // ─── Construct metadata JSON ─────────────────────────────
    const metadata = {
      name,
      symbol,
      description,
      seller_fee_basis_points: 1000,
      image: coverUrl,
      animation_url: videoUrl,
      attributes: [
        { trait_type: "Collection", value: "Woodeng CryptoEggz" },
        { trait_type: "Artist",     value: artist },
        { trait_type: "Album",      value: album },
        { trait_type: "TrackName",  value: name },
        { trait_type: "TrackNumber", value: trackNumber },
      ],
      collection: {
        name:   "Woodeng CryptoEggz",
        family: "Woodeng CryptoEggz",
      },
      properties: {
        files:    filesArray,
        category: "video",
      },
    };
    const metadataJson = Buffer.from(JSON.stringify(metadata));

    // ─── Upload metadata JSON ────────────────────────────────
    const metadataTx  = await bundlr.upload(metadataJson, {
      tags: [{ name: "Content-Type", value: "application/json" }],
    });
    const metadataUri = `https://arweave.net/${metadataTx.id}`;

    return NextResponse.json({ success: true, metadataUri });
  } catch (err: any) {
    console.error("uploadMetadata error:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
