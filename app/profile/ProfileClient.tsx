'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, BN } from '@project-serum/anchor'
import type { Idl } from '@project-serum/anchor'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import poolIdlV2Json from '../../idl/my_sound_meme_pool_v2.json'
import lockerIdlV2Json from '../../idl/hybrid_meme_coin_nft_locker_v2.json'
import type { WalletContextState } from '@solana/wallet-adapter-react'
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet'

// ── Network constants ─────────────────────────────────────────────────────────
const MAINNET_RPC = (() => {
  const env = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SOLANA_RPC : undefined
  return env?.startsWith('http') ? env : 'https://mainnet.helius-rpc.com/?api-key=6b56ae36-a263-4599-a807-43a5289701dc'
})()

// V2 pool program (placeholder until mainnet deploy)
const POOL_PROGRAM_ID_V2 = new PublicKey('C1pGixxtxw1z8x7eGcG2kzs4ZWBkXKVLwPJsDjxWTsin')
// V1 mainnet pool program — older pools still live here; some holder
// profiles were created before pools migrated to V2, so lookups must
// check this program too.
const POOL_PROGRAM_ID_V1 = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV')
const LOCKER_PROGRAM_ID  = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS')
const HOLDER_SEED = Buffer.from('holder')

const poolV2Idl  = poolIdlV2Json  as Idl
const lockerV2Idl = lockerIdlV2Json as Idl

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

function parseMetaplexMetadata(data: Buffer): { name: string; symbol: string; uri: string } | null {
  try {
    let offset = 1 + 32 + 32 // key(1) + update_authority(32) + mint(32)
    const nameLen = data.readUInt32LE(offset); offset += 4
    const name = data.slice(offset, offset + nameLen).toString('utf8').replace(/\0/g, '').trim()
    offset += nameLen
    const symLen = data.readUInt32LE(offset); offset += 4
    const symbol = data.slice(offset, offset + symLen).toString('utf8').replace(/\0/g, '').trim()
    offset += symLen
    const uriLen = data.readUInt32LE(offset); offset += 4
    const uri = data.slice(offset, offset + uriLen).toString('utf8').replace(/\0/g, '').trim()
    return { name, symbol, uri }
  } catch { return null }
}

// ── Types ─────────────────────────────────────────────────────────────────────
type HolderProfile = {
  cumulativeTokenSecs: BN
  currentBalance: BN
  lastUpdateTs: BN
  totalSold: BN
  firstBuyTs: BN
}
type LockerStateAcc = {
  memeMint: PublicKey
  nftMint: PublicKey
  threshold: BN
  memeName: string
  memeSymbol: string
  memeUri: string
  lockerOwner: PublicKey
  lockId: BN
}
type PoolConfigAcc = {
  memeMint: PublicKey
  version: number
}
type TokenBalance = {
  mint: string
  amount: number
  decimals: number
  poolName?: string
  poolSymbol?: string
  poolImageUrl?: string
  imageUrl?: string
}
type LeaderEntry = {
  pda: string
  avgDays: number
  currentBalance: BN
  totalSold: BN
  isMe: boolean
  rank: number
}

// ── Tier definitions ──────────────────────────────────────────────────────────
const TIERS = [
  { label: 'Paper Hand',     emoji: '🧻', minDays: 0,   maxDays: 1,    color: '#8a8fa3', glow: 'rgba(138,143,163,0.3)' },
  { label: 'Jeet',           emoji: '🐀', minDays: 1,   maxDays: 3,    color: '#a3a38a', glow: 'rgba(163,163,138,0.3)' },
  { label: 'Poor Fag',       emoji: '💩', minDays: 3,   maxDays: 7,    color: '#b5a07a', glow: 'rgba(181,160,122,0.3)' },
  { label: 'Stinky Swinger', emoji: '🌀', minDays: 7,   maxDays: 14,   color: '#5bc4d4', glow: 'rgba(91,196,212,0.35)' },
  { label: 'Normie',         emoji: '💎', minDays: 14,  maxDays: 30,   color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  { label: 'Ascender',       emoji: '🚀', minDays: 30,  maxDays: 90,   color: '#a78bfa', glow: 'rgba(167,139,250,0.4)' },
  { label: 'Chad',           emoji: '👑', minDays: 90,  maxDays: 180,  color: '#fb923c', glow: 'rgba(251,146,60,0.4)' },
  { label: 'PSL God',        emoji: '🌌', minDays: 180, maxDays: 360,  color: '#f472b6', glow: 'rgba(244,114,182,0.45)' },
  { label: '444',            emoji: '⚡', minDays: 360, maxDays: null, color: '#fbbf24', glow: 'rgba(251,191,36,0.55)' },
] as const

function getTier(avgDays: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (avgDays >= TIERS[i].minDays) return TIERS[i]
  }
  return TIERS[0]
}

function getTierProgress(avgDays: number): number {
  const tier = getTier(avgDays)
  if (tier.maxDays === null) return 100
  return Math.min(100, ((avgDays - tier.minDays) / (tier.maxDays - tier.minDays)) * 100)
}

function getNextTier(avgDays: number) {
  const idx = TIERS.findIndex(t => t === getTier(avgDays))
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null
}

// ── Math helpers ──────────────────────────────────────────────────────────────
const calcAvgDays = (hp: any): number => {
  try {
    const totalSold = BigInt(hp.totalSold?.toString() ?? '0')
    const firstBuyTs = BigInt(hp.firstBuyTs?.toString() ?? '0')
    const nowSecs = BigInt(Math.floor(Date.now() / 1000))

    if (totalSold === 0n) {
      // Never sold → time since first buy until NOW (simulated)
      if (firstBuyTs === 0n) return 0
      return Number(nowSecs - firstBuyTs) / 86400
    }
    // Has sold → classic weighted average + elapsed since last trade
    const cumul = BigInt(hp.cumulativeTokenSecs?.toString() ?? '0')
    const balance = BigInt(hp.currentBalance?.toString() ?? '0')
    const total = balance + totalSold
    if (total === 0n) return 0
    const lastTs = BigInt(hp.lastUpdateTs?.toString() ?? '0')
    const elapsed = lastTs > 0n && balance > 0n ? (nowSecs - lastTs) * balance : 0n
    return Number((cumul + elapsed) / total) / 86400
  } catch { return 0 }
}

const fmtHoldTime = (days: number): string => {
  if (days <= 0) return '0h'
  const totalMinutes = Math.floor(days * 24 * 60)
  const d = Math.floor(totalMinutes / 1440)
  const h = Math.floor((totalMinutes % 1440) / 60)
  const m = totalMinutes % 60
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

function fmtBN(n: BN, decimals = 0): string {
  try {
    const val = n.toNumber() / Math.pow(10, decimals)
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M'
    if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K'
    return val.toLocaleString(undefined, { maximumFractionDigits: decimals > 0 ? 2 : 0 })
  } catch { return '…' }
}

const shortAddr = (s: string, n = 4) => s ? `${s.slice(0, n)}…${s.slice(-n)}` : ''

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ target, duration = 1200, fmt = fmtHoldTime }: { target: number; duration?: number; fmt?: (n: number) => string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (target === 0) { setDisplay(0); return }
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(target * eased)
      if (progress < 1) requestAnimationFrame(tick)
      else setDisplay(target)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return <>{fmt(display)}</>
}

// ── Wallet adapter shim for read-only calls ───────────────────────────────────
function readonlyProvider(conn: Connection): AnchorProvider {
  return new AnchorProvider(conn, { publicKey: PublicKey.default } as any, { commitment: 'processed' })
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProfileClient() {
  const wallet = useWallet()
  const { publicKey: unifiedPublicKey, connected: unifiedConnected, walletType } = useUnifiedWallet()
  const effectivePublicKey = (wallet.connected && wallet.publicKey) ? wallet.publicKey : unifiedPublicKey
  const effectiveConnected = wallet.connected || unifiedConnected

  const conn = useMemo(
    () => new Connection(MAINNET_RPC, { commitment: 'processed' }),
    []
  )
  const poolProgramId   = POOL_PROGRAM_ID_V2
  const lockerProgramId = LOCKER_PROGRAM_ID
  const [tierModalOpen, setTierModalOpen] = useState(false)

  // ── My HolderProfile ────────────────────────────────────────────────────────
  // Check both the Privy/unified wallet and any connected external wallet —
  // a user may have bought under one address and be viewing under the other.
  const [myHp, setMyHp] = useState<HolderProfile | null>(null)
  const [myHpWallet, setMyHpWallet] = useState<PublicKey | null>(null)
  const [hpLoading, setHpLoading] = useState(false)

  useEffect(() => {
    const candidates: PublicKey[] = []
    if (unifiedPublicKey) candidates.push(unifiedPublicKey)
    if (wallet.publicKey && !(unifiedPublicKey && wallet.publicKey.equals(unifiedPublicKey))) {
      candidates.push(wallet.publicKey)
    }

    if (candidates.length === 0) { setMyHp(null); setMyHpWallet(null); return }
    setHpLoading(true)
    ;(async () => {
      try {
        // Only V2's IDL defines the HolderProfile struct layout, so it's used
        // as the decoder for both programs — the on-chain byte layout is the
        // same regardless of which program's PDA the account lives under.
        const coderProgram = new Program(poolV2Idl, poolProgramId, readonlyProvider(conn))
        let found: HolderProfile | null = null
        let foundWallet: PublicKey | null = null
        search:
        for (const pk of candidates) {
          for (const progId of [poolProgramId, POOL_PROGRAM_ID_V1]) {
            const [holderPda] = PublicKey.findProgramAddressSync([HOLDER_SEED, pk.toBuffer()], progId)
            try {
              const info = await conn.getAccountInfo(holderPda)
              if (info?.data && info.data.length >= 8 + 48) {
                found = coderProgram.coder.accounts.decode('HolderProfile', info.data) as HolderProfile
                foundWallet = pk
                break search
              }
            } catch {}
          }
        }
        setMyHp(found)
        setMyHpWallet(foundWallet)
      } catch (e) {
        console.error('[Profile] holderProfile', e)
        setMyHp(null)
        setMyHpWallet(null)
      } finally {
        setHpLoading(false)
      }
    })()
  }, [unifiedPublicKey?.toBase58(), wallet.publicKey?.toBase58()])

  // Wallet whose activity we display for balances/lockers — prefer the wallet
  // that actually has a HolderProfile so a connected-but-empty external
  // wallet doesn't shadow the one the user actually bought/locked tokens with.
  const displayWallet = myHpWallet ?? effectivePublicKey

  // ── Leaderboard ──────────────────────────────────────────────────────────────
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([])
  const [lbLoading, setLbLoading] = useState(false)

  // Derive my PDA so we can highlight it in the leaderboard — use whichever
  // wallet the HolderProfile lookup above actually found a profile for.
  const myHolderPda = useMemo(() => {
    if (!myHpWallet) return null
    return PublicKey.findProgramAddressSync([HOLDER_SEED, myHpWallet.toBuffer()], poolProgramId)[0].toBase58()
  }, [myHpWallet?.toBase58()])

  useEffect(() => {
    setLbLoading(true)
    setLeaderboard([])
    ;(async () => {
      try {
        const program = new Program(poolV2Idl, poolProgramId, readonlyProvider(conn))
        const allAccounts = await (program.account as any).holderProfile.all() as Array<{ publicKey: PublicKey; account: HolderProfile }>
        const sorted = allAccounts
          .map(({ publicKey, account }) => ({
            pda: publicKey.toBase58(),
            avgDays: calcAvgDays(account),
            currentBalance: account.currentBalance,
            totalSold: account.totalSold,
            isMe: publicKey.toBase58() === myHolderPda,
            rank: 0,
          }))
          .sort((a, b) => b.avgDays - a.avgDays)
          .slice(0, 20)
          .map((e, i) => ({ ...e, rank: i + 1 }))
        setLeaderboard(sorted)
      } catch (e) {
        console.error('[Profile] leaderboard', e)
      } finally {
        setLbLoading(false)
      }
    })()
  }, [myHolderPda])

  // ── NFT Lockers ──────────────────────────────────────────────────────────────
  const [lockers, setLockers] = useState<Array<{ pubkey: string; account: LockerStateAcc }>>([])
  const [lockersLoading, setLockersLoading] = useState(false)

  useEffect(() => {
    if (!displayWallet) { setLockers([]); return }
    setLockersLoading(true)
    ;(async () => {
      try {
        const program = new Program(lockerV2Idl, lockerProgramId, readonlyProvider(conn))
        const all = await (program.account as any).lockerState.all() as Array<{ publicKey: PublicKey; account: LockerStateAcc }>
        const mine = all.filter(({ account }) => account.lockerOwner.toBase58() === displayWallet!.toBase58())
        setLockers(mine.map(({ publicKey, account }) => ({ pubkey: publicKey.toBase58(), account })))
      } catch (e) {
        console.error('[Profile] lockers', e)
        setLockers([])
      } finally {
        setLockersLoading(false)
      }
    })()
  }, [displayWallet?.toBase58()])

  // ── Meme Balances ────────────────────────────────────────────────────────────
  const [memeBalances, setMemeBalances] = useState<TokenBalance[]>([])
  const [balancesLoading, setBalancesLoading] = useState(false)

  useEffect(() => {
    if (!displayWallet) { setMemeBalances([]); return }
    setBalancesLoading(true)
    ;(async () => {
      try {
        // Fetch all token accounts for the wallet
        const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
          displayWallet!,
          { programId: TOKEN_PROGRAM_ID }
        )
        // Fetch known meme mints from pool program
        const poolProgram = new Program(poolV2Idl, poolProgramId, readonlyProvider(conn))
        const poolConfigs = await (poolProgram.account as any).soundMemeConfig.all()
        const mintToPool = new Map(poolConfigs.map(({ account }: any) => [account.memeMint.toBase58(), account]))

        // Build initial balances filtered to known meme mints
        const rawBalances: TokenBalance[] = tokenAccounts.value
          .map(({ account }: any) => {
            const parsed = (account.data as any).parsed?.info
            if (!parsed) return null
            const mint = parsed.mint as string
            const amount = Number(parsed.tokenAmount?.uiAmount ?? 0)
            const decimals = Number(parsed.tokenAmount?.decimals ?? 0)
            if (amount === 0) return null
            if (!mintToPool.has(mint)) return null
            return { mint, amount, decimals } as TokenBalance
          })
          .filter((b): b is TokenBalance => b !== null)
          .sort((a, b) => b.amount - a.amount)

        setMemeBalances(rawBalances)

        // Fetch Metaplex on-chain metadata for each mint to get name/symbol/image
        await Promise.all(rawBalances.map(async (b) => {
          try {
            const mintPubkey = new PublicKey(b.mint)
            const [metadataPda] = PublicKey.findProgramAddressSync(
              [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
              METADATA_PROGRAM_ID
            )
            const metadataInfo = await conn.getAccountInfo(metadataPda)
            if (!metadataInfo) return
            const meta = parseMetaplexMetadata(Buffer.from(metadataInfo.data))
            if (!meta) return

            // Apply name/symbol immediately
            if (meta.name || meta.symbol) {
              setMemeBalances(prev => prev.map(p =>
                p.mint === b.mint
                  ? { ...p, poolName: meta.name || p.poolName, poolSymbol: meta.symbol || p.poolSymbol }
                  : p
              ))
            }

            // Fetch off-chain JSON for image
            if (meta.uri) {
              const resolvedUri = meta.uri.startsWith('ipfs://')
                ? meta.uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
                : meta.uri
              const res = await fetch(resolvedUri)
              const json = await res.json()
              const rawImage: string | undefined = json?.image
              if (rawImage) {
                const imageUrl = rawImage.startsWith('ipfs://')
                  ? rawImage.replace('ipfs://', 'https://ipfs.io/ipfs/')
                  : rawImage
                console.log('[TokenImage]', b.mint, resolvedUri, imageUrl)
                setMemeBalances(prev => prev.map(p =>
                  p.mint === b.mint ? { ...p, imageUrl } : p
                ))
              }
            }
          } catch {}
        }))
      } catch (e) {
        console.error('[Profile] balances', e)
      } finally {
        setBalancesLoading(false)
      }
    })()
  }, [displayWallet?.toBase58()])

  // ── Derived stats ─────────────────────────────────────────────────────────────
  const avgDays = myHp ? calcAvgDays(myHp) : 0
  const tier    = getTier(avgDays)
  const nextTier = getNextTier(avgDays)
  const progress = getTierProgress(avgDays)

  const myRankEntry = leaderboard.find(e => e.isMe)
  const myRankValue = lbLoading ? '—' : myRankEntry ? `#${myRankEntry.rank}` : 'Unranked'

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#0c0d12', color: '#d6daf6' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">

        {/* ── Page header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-widest uppercase"
                style={{ background: 'linear-gradient(135deg, #a78bfa, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Diamond Profile
            </h1>
            {effectivePublicKey && (
              <p className="text-xs font-mono mt-1" style={{ color: '#6b7084' }}>
                {effectivePublicKey.toBase58()}
              </p>
            )}
            {walletType === 'privy' && (
              <p className="text-[10px] mt-1 max-w-md" style={{ color: '#6b7084' }}>
                Showing profile for wallet: {shortAddr((myHpWallet ?? effectivePublicKey)?.toBase58() ?? '', 6)}.
                If you previously traded with a different wallet (e.g. Phantom), connect that wallet to see its profile.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <WalletMultiButton style={{
              background: 'linear-gradient(135deg, #6d28d9, #0891b2)',
              fontSize: 13,
              padding: '8px 16px',
              height: 'auto',
              borderRadius: 10,
            }} />
          </div>
        </div>

        {!effectivePublicKey ? (
          /* ── Not connected ─────────────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="text-6xl">💎</div>
            <p className="text-lg font-bold" style={{ color: '#a78bfa' }}>Connect wallet to view your diamond stats</p>
            <WalletMultiButton />
          </div>
        ) : (
          <>
            {/* ── SECTION 1: Diamond Hand Score ─────────────────────────────── */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💎</span>
                <span className="text-sm font-bold uppercase tracking-wider" style={{ color: '#d6daf6' }}>Diamond Hand Score</span>
                <button
                  onClick={() => setTierModalOpen(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, rgba(144,122,255,0.18), rgba(167,139,250,0.08))',
                    color: '#907aff',
                    border: '1px solid rgba(144,122,255,0.35)',
                    boxShadow: '0 0 12px rgba(144,122,255,0.15)',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span style={{ fontSize: 9 }}>⚡</span>
                  <span>TIERS</span>
                </button>
                <div className="flex-1 h-px ml-1" style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.3), transparent)' }} />
              </div>
              <div className="rounded-2xl p-6 relative overflow-hidden"
                   style={{ background: 'linear-gradient(135deg, #1a1b25, #0f1018)', border: `1px solid ${tier.color}40` }}>
                {/* Glow effect */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${tier.glow} 0%, transparent 70%)`,
                }} />
                {hpLoading ? (
                  <div className="text-center py-8 text-[#6b7084] text-sm">Loading profile…</div>
                ) : !myHp ? (
                  <div className="text-center py-8">
                    <p className="text-[#6b7084] text-sm mb-1">No HolderProfile found on {'mainnet'}</p>
                    <p className="text-[10px] max-w-xs mx-auto" style={{ color: '#4a4f63' }}>
                      Your HolderProfile is created automatically when you buy any SWL-444 token through the platform.
                      Simply receiving tokens via transfer doesn't create a profile — you need to make at least one
                      purchase through the bonding curve or AMM.
                    </p>
                    {!balancesLoading && memeBalances.length > 0 && (
                      <p className="text-[10px] mt-2 max-w-xs mx-auto" style={{ color: '#ffc371' }}>
                        You hold SWL-444 tokens but haven't purchased through the platform yet. Buy any token
                        (even a small amount) to create your Diamond Hand profile.
                      </p>
                    )}
                    {walletType === 'privy' && !wallet.publicKey && (
                      <p className="text-[10px] mt-2 max-w-xs mx-auto" style={{ color: '#4a4f63' }}>
                        Traded with a different wallet before (e.g. Phantom)? Connect it above to check for its profile.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    {/* Big animated number */}
                    <div className="text-center mb-4">
                      <div className="text-[72px] font-black leading-none tabular-nums"
                           style={{ color: tier.color, textShadow: `0 0 30px ${tier.glow}` }}>
                        <AnimatedNumber target={avgDays} />
                      </div>
                      <div className="text-xs uppercase tracking-widest mt-1" style={{ color: '#6b7084' }}>avg hold time</div>
                    </div>

                    {/* Tier badge */}
                    <div className="flex justify-center mb-5">
                      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold"
                           style={{ background: `${tier.color}20`, border: `1px solid ${tier.color}60`, color: tier.color }}>
                        <span>{tier.emoji}</span>
                        <span>{tier.label}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {nextTier && (
                      <div className="mb-5">
                        <div className="flex justify-between text-[10px] mb-1.5" style={{ color: '#6b7084' }}>
                          <span>{tier.label} ({tier.minDays}d)</span>
                          <span>{nextTier.emoji} {nextTier.label} ({nextTier.minDays}d)</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1e1f2e' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                               style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})` }} />
                        </div>
                        <div className="text-[10px] text-center mt-1" style={{ color: '#4a4f63' }}>
                          {fmtHoldTime(nextTier.minDays - avgDays)} to next tier
                        </div>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <StatBox label="Current Balance" value={fmtBN(myHp.currentBalance)} />
                      <StatBox label="Total Sold" value={fmtBN(myHp.totalSold)} />
                      <StatBox label="Global Rank" value={myRankValue} />
                    </div>

                    {/* Token breakdown */}
                    {memeBalances.length > 0 && (
                      <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #1e1f2e' }}>
                        {memeBalances.map((b, i) => (
                          <div key={b.mint}
                               className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.03]"
                               style={{ borderBottom: i < memeBalances.length - 1 ? '1px solid #1a1b28' : undefined, background: '#0a0b10' }}>
                            <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden flex items-center justify-center text-xs"
                                 style={{ background: 'linear-gradient(135deg, #3b1d8a, #0e4f6e)' }}>
                              {b.imageUrl
                                ? <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
                                : <div className="w-8 h-8 rounded-full bg-[#2a2b3a] flex items-center justify-center text-xs">🔊</div>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold truncate" style={{ color: '#d6daf6' }}>
                                {b.poolSymbol || shortAddr(b.mint, 4)}
                              </span>
                            </div>
                            <span className="text-[11px] font-black tabular-nums shrink-0" style={{ color: '#907aff' }}>
                              {b.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ── SECTION 2: Global Leaderboard ────────────────────────────── */}
            <section className="mb-8">
              <SectionLabel emoji="🏆" text="Global Leaderboard" subtitle="Top 20 by avg hold days" />
              <div className="rounded-2xl overflow-hidden" style={{ background: '#12131b', border: '1px solid #2a2b3a' }}>
                {lbLoading ? (
                  <div className="py-8 text-center text-sm" style={{ color: '#6b7084' }}>Fetching leaderboard…</div>
                ) : leaderboard.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: '#6b7084' }}>No HolderProfile accounts found on {'mainnet'}</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #2a2b3a', color: '#4a4f63' }}>
                        <th className="py-2.5 px-4 text-left font-semibold uppercase tracking-wider w-12">Rank</th>
                        <th className="py-2.5 px-4 text-left font-semibold uppercase tracking-wider">Holder ID</th>
                        <th className="py-2.5 px-4 text-right font-semibold uppercase tracking-wider">Avg Hold</th>
                        <th className="py-2.5 px-4 text-right font-semibold uppercase tracking-wider">Balance</th>
                        <th className="py-2.5 px-4 text-right font-semibold uppercase tracking-wider">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry) => {
                        const t = getTier(entry.avgDays)
                        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null
                        return (
                          <tr key={entry.pda}
                              style={{
                                borderBottom: '1px solid #1e1f2e',
                                background: entry.isMe ? 'rgba(167,139,250,0.07)' : undefined,
                              }}>
                            <td className="py-2.5 px-4 font-mono" style={{ color: '#6b7084' }}>
                              {medal ?? `#${entry.rank}`}
                              {entry.isMe && <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: '#a78bfa30', color: '#a78bfa' }}>YOU</span>}
                            </td>
                            <td className="py-2.5 px-4 font-mono" style={{ color: '#8a8fa3' }}>{shortAddr(entry.pda, 5)}</td>
                            <td className="py-2.5 px-4 text-right font-black tabular-nums" style={{ color: t.color }}>{fmtHoldTime(entry.avgDays)}</td>
                            <td className="py-2.5 px-4 text-right font-mono" style={{ color: '#8a8fa3' }}>{fmtBN(entry.currentBalance)}</td>
                            <td className="py-2.5 px-4 text-right">
                              <span className="text-sm">{t.emoji}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* ── SECTION 3: NFT Lockers ───────────────────────────────────── */}
            <section className="mb-8">
              <SectionLabel emoji="🔒" text="NFT Lockers Owned" />
              {lockersLoading ? (
                <div className="text-sm py-4 text-center" style={{ color: '#6b7084' }}>Loading lockers…</div>
              ) : lockers.length === 0 ? (
                <div className="rounded-2xl p-6 text-center text-sm" style={{ background: '#12131b', border: '1px solid #2a2b3a', color: '#4a4f63' }}>
                  No NFT lockers found on {'mainnet'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lockers.map(({ pubkey, account }) => (
                    <LockerCard key={pubkey} account={account} />
                  ))}
                </div>
              )}
            </section>

          </>
        )}
      </div>

      {/* ── Tier Rankings Modal ──────────────────────────────────────────── */}
      {tierModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
          onClick={() => setTierModalOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #0f1020 0%, #0c0d12 100%)',
              border: '1px solid rgba(144,122,255,0.25)',
              boxShadow: '0 0 0 1px rgba(144,122,255,0.08), 0 0 80px rgba(144,122,255,0.12), 0 32px 80px rgba(0,0,0,0.9)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Glow top bar */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(144,122,255,0.6), transparent)' }} />

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-base">⚡</span>
                  <span className="text-sm font-black uppercase tracking-widest" style={{ color: '#d6daf6' }}>Diamond Tier Ladder</span>
                </div>
                <p className="text-[10px] pl-6" style={{ color: '#4a4f63' }}>Hold longer · Rise higher · Earn more</p>
              </div>
              <button
                onClick={() => setTierModalOpen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-full transition-all hover:bg-white/10"
                style={{ color: '#4a4f63', fontSize: 18, lineHeight: 1 }}
              >×</button>
            </div>

            {/* Current tier hero (if connected) */}
            {myHp && (
              <div className="mx-4 mt-4 mb-2 rounded-2xl px-4 py-3 flex items-center gap-3"
                   style={{ background: `linear-gradient(135deg, ${tier.color}15, ${tier.color}06)`, border: `1px solid ${tier.color}30` }}>
                <span className="text-2xl">{tier.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black" style={{ color: tier.color }}>{tier.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: '#6b7084' }}>Your current tier · {fmtHoldTime(avgDays)} avg hold</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black tabular-nums" style={{ color: tier.color }}>{fmtHoldTime(avgDays)}</div>
                  {nextTier && <div className="text-[9px] mt-0.5" style={{ color: '#4a4f63' }}>{fmtHoldTime(nextTier.minDays - avgDays)} to next</div>}
                </div>
              </div>
            )}

            {/* Tier list */}
            <div className="overflow-y-auto px-2 pb-3 mt-2" style={{ maxHeight: '55vh' }}>
              {TIERS.map((t, i) => {
                const isActive = myHp && getTier(avgDays) === t
                const isNext   = myHp && getNextTier(avgDays) === t
                return (
                  <div key={t.label}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 relative transition-colors"
                    style={{ background: isActive ? `${t.color}12` : isNext ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                           style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }} />
                    )}
                    {/* Tier badge */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0 text-base"
                         style={{ background: `${t.color}18`, border: `1px solid ${t.color}30` }}>
                      {t.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold" style={{ color: isActive ? t.color : '#c4c8e0' }}>
                          {t.label}
                        </span>
                        {isActive && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                                style={{ background: `${t.color}25`, color: t.color }}>YOU</span>
                        )}
                        {isNext && (
                          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                                style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7084' }}>NEXT</span>
                        )}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#3d4052' }}>
                        {t.minDays}d{t.maxDays !== null ? ` – ${t.maxDays}d` : ' and beyond'}
                      </div>
                    </div>
                    {/* Threshold pill */}
                    <div className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                         style={{ background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}25` }}>
                      {t.minDays === 0 ? '0d' : `${t.minDays}d`}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="pb-4" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ emoji, text, subtitle }: { emoji: string; text: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{emoji}</span>
      <span className="text-sm font-bold uppercase tracking-wider" style={{ color: '#d6daf6' }}>{text}</span>
      {subtitle && <span className="text-[10px] ml-1" style={{ color: '#4a4f63' }}>{subtitle}</span>}
      <div className="flex-1 h-px ml-2" style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.3), transparent)' }} />
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: '#0f1018', border: '1px solid #2a2b3a' }}>
      <div className="text-xs font-black tabular-nums" style={{ color: '#a78bfa' }}>{value}</div>
      <div className="text-[9px] mt-0.5 uppercase tracking-wider" style={{ color: '#4a4f63' }}>{label}</div>
    </div>
  )
}

function LockerCard({ account }: { account: LockerStateAcc }) {
  const hasNft = !account.nftMint.equals(PublicKey.default)
  const [coverImg, setCoverImg] = useState<string | null>(null)

  useEffect(() => {
    const uri = account.memeUri
    if (!uri) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(uri)
        const json = await res.json()
        if (!cancelled && json?.image) setCoverImg(json.image as string)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [account.memeUri])

  return (
    <div className="rounded-2xl p-4 flex gap-3 items-start"
         style={{ background: '#12131b', border: '1px solid #2a2b3a' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 overflow-hidden"
           style={{ background: hasNft ? 'linear-gradient(135deg, #6d28d9, #0891b2)' : '#1e1f2e' }}>
        {coverImg
          ? <img src={coverImg} alt="" className="w-full h-full object-cover" />
          : (hasNft ? '🔒' : '🔓')
        }
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold truncate" style={{ color: '#d6daf6' }}>
            {account.memeName || shortAddr(account.memeMint.toBase58())}
          </span>
          {account.memeSymbol && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#a78bfa20', color: '#a78bfa' }}>
              {account.memeSymbol}
            </span>
          )}
        </div>
        <div className="text-[10px] font-mono" style={{ color: '#4a4f63' }}>
          Threshold: {fmtBN(account.threshold)} tokens
        </div>
        <div className="text-[10px] font-mono mt-0.5" style={{ color: '#4a4f63' }}>
          NFT: {shortAddr(account.nftMint.toBase58())}
        </div>
        <div className="text-[10px] font-mono" style={{ color: '#4a4f63' }}>
          Lock #{account.lockId.toNumber()}
        </div>
      </div>
      <div className="shrink-0">
        <span className="text-[9px] font-bold px-2 py-1 rounded-full"
              style={{ background: hasNft ? '#10b98120' : '#6b708420', color: hasNft ? '#10b981' : '#6b7084' }}>
          {hasNft ? 'LOCKED' : 'UNLOCKED'}
        </span>
      </div>
    </div>
  )
}
