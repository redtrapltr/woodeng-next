import React, { useEffect, useState } from "react";
import { AnchorProvider, Program, Idl } from "@project-serum/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import Link from "next/link";

import idl from "../../../idl/my_sound_meme_pool.json";
import { fetchSoundMemePoolsWithMetadata } from "@/lib/sound-memes";

const POOL_PROGRAM_ID = new PublicKey(
  "8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV"
);

export const WOODENG_DECIMALS = 9;
export const MEME_DECIMALS = 0;

export function SoundMemeSection() {
  const [topPools, setTopPools] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const connection = new Connection("process.env.NEXT_PUBLIC_SOLANA_RPC as string");
        const dummyWallet = { publicKey: PublicKey.default } as any; // read-only
        const provider = new AnchorProvider(connection, dummyWallet, {});
        const program = new Program(idl as Idl, POOL_PROGRAM_ID, provider);

        const pools = await fetchSoundMemePoolsWithMetadata();

        const sorted = pools
          .filter(
            (p) =>
              p.imageUrl &&
              p.imageUrl.length > 0 &&
              (p.ammReserves?.woodeng || 0) > 0
          )
          .sort(
            (a, b) =>
              (b.ammReserves?.woodeng || 0) - (a.ammReserves?.woodeng || 0)
          )
          .slice(0, 3);

        setTopPools(sorted);
      } catch (e) {
        console.error("Error fetching sound meme pools:", e);
        setTopPools([]); // show placeholders instead of a spinner forever
      }
    })();
  }, []);

  return (
    <section className="my-16">
      <h2 className="text-3xl font-bold mb-6 text-white">Sound Memes</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ───────────  Empty / loading state ─────────── */}
        {topPools.length === 0 && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-card p-6 rounded-2xl min-h-[200px] flex items-center justify-center text-muted-foreground"
              >
                No pools found
              </div>
            ))}
          </>
        )}

        {/* ───────────  Cards ─────────── */}
        {topPools.map((pool: any, i: number) => (
          <Link
            key={pool.pubkey?.toBase58?.() || i}
            href={`/sound-memes?mint=${pool.memeMint.toBase58()}`}
            className="bg-card p-6 rounded-2xl min-h-[200px] flex flex-col relative
                       hover:scale-105 transition-transform duration-200"
          >
            {/* thumbnail */}
            <div className="relative w-full aspect-square mb-4 overflow-hidden rounded-xl">
              <img
                src={pool.imageUrl || "/placeholder.jpg"}
                alt={pool.name || "No Name"}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>

            {/* text */}
            <h3 className="text-lg font-bold text-white mb-1">
              {pool.name || "Unnamed"}
            </h3>

            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {pool.description}
            </p>

            <div className="flex flex-col gap-1 mt-auto text-xs">
              <div>
                Price: <b>{pool.price?.toFixed(4) ?? "—"} WOODENG</b>
              </div>
              <div>
                Liquidity:&nbsp;
                {(pool.ammReserves?.woodeng / 10 ** WOODENG_DECIMALS).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                WOODENG&nbsp;/&nbsp;
                {(pool.ammReserves?.meme / 10 ** MEME_DECIMALS).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                MEME
              </div>
            </div>

            {i === 0 && (
              <span className="absolute top-2 right-2 bg-[#ffc371] text-black text-xs px-3 py-1 rounded-full font-bold shadow">
                MOST LIQUID
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
