// app/uploadYourMusic/page.tsx
'use client'

import React, { useState } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet }       from '@solana/wallet-adapter-react'
import { Metaplex, walletAdapterIdentity, token } from '@metaplex-foundation/js'
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  clusterApiUrl,
  Transaction,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { AnchorProvider, Program, BN } from '@project-serum/anchor'
import idl from '../../idl/idl.json'
import { CheckCircle2 as CheckIcon } from 'lucide-react'

const PROGRAM_ID   = new PublicKey('FU6vmNrLCqS5ewMhyW17ydwwY81RX6Tfn8bmbVDya1bS')
const WOODENG_MINT = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad')

/** 
 * Direct‐to‐Pinata upload helper.
 * Fetches a scoped JWT from /api/pinata-token then posts straight to Pinata.
 */
async function pinFile(file: File): Promise<string> {
  // 1) get your short‐lived JWT
  const { jwt } = await fetch('/api/pinata-token')
    .then(r => {
      if (!r.ok) throw new Error('Could not fetch Pinata token')
      return r.json() as Promise<{ jwt: string }>
    })

  // 2) build form
  const form = new FormData()
  form.append('file', file, file.name)

  // 3) post to Pinata
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method:  'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body:    form,
  })

  // ——— DEBUG LOGGING ———
  const text = await res.text()
  console.log('🔴 Pinata returned status', res.status, 'and body:', text)

  // try JSON.parse so we can see parse errors clearly
  let body
  try {
    body = JSON.parse(text)
  } catch (err) {
    throw new Error(`Pinata JSON parse error—raw body:\n${text}`)
  }
  // ————— end debug —————

  if (!res.ok) {
    // Pinata will sometimes return a JSON error object
    throw new Error(body.error || body.message || 'Pinata upload failed')
  }

  return body.IpfsHash as string
}


/** make sure an ATA exists (creates it if missing) */
async function ensureAta(
  conn:   Connection,
  owner:  PublicKey,
  mint:   PublicKey,
  wallet: ReturnType<typeof useWallet>
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner)
  if (!(await conn.getAccountInfo(ata))) {
    const ix = createAssociatedTokenAccountInstruction(owner, ata, owner, mint)
    const tx = new Transaction().add(ix)
    tx.feePayer        = owner
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
    const signed = await wallet.signTransaction!(tx)
    const sig    = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false })
    await conn.confirmTransaction(sig, 'confirmed')
  }
  return ata
}

export default function UploadYourMusic() {
  const wallet                   = useWallet()
  const { publicKey, connected } = wallet

  // wizard state
  const [step, setStep] = useState(1)
  const next = () => setStep(s => Math.min(s+1, 4))
  const prev = () => setStep(s => Math.max(s-1, 1))

  const [isBundle, setIsBundle]   = useState(false)
  const [numTracks, setNumTracks] = useState(1)

  type Track = {
    cover: File | null
    video: File | null
    audio: { mp3: File | null }
    metadata: {
      artist: string
      songName: string
      albumName: string
      style: string
      year: string
      trackNumber: string
      description: string
      collection: string
    }
  }
  const blankTrack: Track = {
    cover: null,
    video: null,
    audio: { mp3: null },
    metadata: {
      artist: '',
      songName: '',
      albumName: '',
      style: '',
      year: '',
      trackNumber: '',
      description: '',
      collection: '',
    },
  }
  const [tracks, setTracks] = useState<Track[]>([{ ...blankTrack }])
  const [skipDeposit, setSkipDeposit]       = useState(false)
  const [depositWoodeng, setDepositWoodeng] = useState('0')
  const [copies, setCopies]                 = useState('1')

  const [minting, setMinting]         = useState(false)
  const [mintedAddrs, setMintedAddrs] = useState<string[]>([])
  const [poolAddr, setPoolAddr]       = useState<string | null>(null)

  const updateTrack = (i: number, data: Partial<Track>) =>
    setTracks(ts => {
      const copy = [...ts]
      copy[i] = { ...copy[i], ...data }
      return copy
    })
  const updateMeta = (i: number, k: keyof Track['metadata'], v: string) =>
    updateTrack(i, { metadata: { ...tracks[i].metadata, [k]: v } })

  async function mintNFT() {
    if (!connected || !publicKey) {
      alert('Please connect your wallet')
      return
    }
    if (tracks.some(t => !t.cover || !t.video)) {
      alert('Each track needs a cover & video')
      return
    }

    setMinting(true)
    setMintedAddrs([])
    setPoolAddr(null)

    try {
      // ─── 1) Pin raw assets & metadata ─────────────────────────
      const uris: string[] = []
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i]

        const coverCid     = await pinFile(t.cover!)
        const imageURI     = `ipfs://${coverCid}`
        const videoCid     = await pinFile(t.video!)
        const animationURI = `ipfs://${videoCid}`
        let audioURI = ''
        if (t.audio.mp3) {
          const audioCid = await pinFile(t.audio.mp3)
          audioURI = `ipfs://${audioCid}`
        }

        const meta = {
          name:          t.metadata.songName,
          symbol:        'MUSIC',
          description:   t.metadata.description,
          image:         imageURI,
          animation_url: animationURI,
          properties:    { audio: audioURI, ...t.metadata },
        }
        const blob     = new Blob([JSON.stringify(meta)], { type: 'application/json' })
        const fileJson = new File([blob], `meta-${i}.json`, { type: 'application/json' })
        const metaCid  = await pinFile(fileJson)
        uris.push(`ipfs://${metaCid}`)
      }

      // ─── 2) Mint via Metaplex ─────────────────────────────────
      const mx      = Metaplex
                        .make(new Connection(clusterApiUrl('devnet'), 'finalized'))
                        .use(walletAdapterIdentity(wallet))
      const nCopies = Math.max(1, parseInt(copies, 10))
      const minted: PublicKey[] = []

      if (isBundle) {
        for (let c = 0; c < nCopies; c++) {
          for (let i = 0; i < uris.length; i++) {
            const { nft } = await mx.nfts().create({
              uri:                  uris[i],
              name:                 `${tracks[i].metadata.songName} #${c+1}`,
              symbol:               'MUSIC',
              sellerFeeBasisPoints: 0,
              creators:             [{ address: publicKey, share: 100 }],
              tokenOwner:           publicKey,
            })
            minted.push(nft.address)
          }
        }
      } else {
        const { sft } = await mx.nfts().createSft({
          uri:                  uris[0],
          name:                 tracks[0].metadata.songName,
          symbol:               'MUSIC',
          sellerFeeBasisPoints: 0,
          creators:             [{ address: publicKey, share: 100 }],
          decimals:             0,
          tokenOwner:           publicKey,
          tokenAmount:          token(1, 0),
        })
        minted.push(sft.address)

        // mint extra copies into your ATA
        const extra = Math.max(0, nCopies - 1)
        if (extra > 0) {
          const ata = await ensureAta(mx.connection, publicKey, sft.address, wallet)
          await mx.tokens().mint({
            mintAddress: sft.address,
            amount:      token(extra, 0),
            toToken:     ata,
          })
        }
      }

      setMintedAddrs(minted.map(pk => pk.toBase58()))

      // 3️⃣ create & seed AMM pool on-chain via Anchor
      if (!skipDeposit) {
        const conn2     = new Connection(clusterApiUrl('devnet'), 'confirmed')
        const provider2 = new AnchorProvider(conn2, wallet as any, {})
        const prog2     = new Program(idl as any, PROGRAM_ID, provider2)

        const userWoodAta = await ensureAta(conn2, publicKey!, WOODENG_MINT, wallet)
        const depLam      = new BN(Math.floor(parseFloat(depositWoodeng)*1e9))

        if (isBundle) {
          // bundle pool logic...
          const bundleIdBn  = new BN(Date.now())
          const idBuf       = Buffer.from(bundleIdBn.toArray('le',8))
          const [bundlePda, bundleBump] = PublicKey.findProgramAddressSync(
            [Buffer.from('bundle_config'), publicKey!.toBuffer(), idBuf],
            PROGRAM_ID
          )
          const [bundleSigner] = PublicKey.findProgramAddressSync(
            [Buffer.from('bundle_signer'), bundlePda.toBuffer()],
            PROGRAM_ID
          )
          const tokenVaultPda = PublicKey.findProgramAddressSync(
            [Buffer.from('bundle_token_vault'), bundlePda.toBuffer()],
            PROGRAM_ID
          )[0]

          // init
          await prog2.methods
            .initializeBundle(bundleIdBn, new BN(1), new BN(1_000_000_000), depLam)
            .accounts({
              bundle: bundlePda,
              bundleSigner,
              tokenVault:    tokenVaultPda,
              payerTokenAta: userWoodAta,
              tokenMint:     WOODENG_MINT,
              payer:         publicKey!,
              systemProgram: SystemProgram.programId,
              tokenProgram:  TOKEN_PROGRAM_ID,
              rent:          SYSVAR_RENT_PUBKEY,
            })
            .rpc()

          // whitelist
          for (let i = 0; i < minted.length && i < uris.length; i++){
            const mint = minted[i]
            const [vaultPda] = PublicKey.findProgramAddressSync(
              [Buffer.from('nft_vault'), bundlePda.toBuffer(), mint.toBuffer()],
              PROGRAM_ID
            )
            await prog2.methods.addToBundle()
              .accounts({
                bundle:       bundlePda,
                authority:    publicKey!,
                bundleSigner,
                vault:        vaultPda,
                mint,
                payer:        publicKey!,
                systemProgram: SystemProgram.programId,
                tokenProgram:  TOKEN_PROGRAM_ID,
                rent:          SYSVAR_RENT_PUBKEY,
              })
              .rpc()
          }

          setPoolAddr(bundlePda.toBase58())
        } else {
          // single-mint pool
          const poolKP     = Keypair.generate()
          const [poolSigner] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault'), poolKP.publicKey.toBuffer()],
            PROGRAM_ID
          )
          const [nftVault] = PublicKey.findProgramAddressSync(
            [Buffer.from('nft_vault'), poolKP.publicKey.toBuffer(), Uint8Array.of(0)],
            PROGRAM_ID
          )
          const [tokenVault] = PublicKey.findProgramAddressSync(
            [Buffer.from('token_vault'), poolKP.publicKey.toBuffer()],
            PROGRAM_ID
          )

          await prog2.methods
            .createPool(new BN(1), new BN(1_000_000_000), depLam)
            .accounts({
              pool:           poolKP.publicKey,
              poolSigner,
              nftVault,
              tokenVault,
              payerTokenAta:  userWoodAta,
              nftMint:        minted[0],
              tokenMint:      WOODENG_MINT,
              payer:          publicKey!,
              systemProgram:  SystemProgram.programId,
              tokenProgram:   TOKEN_PROGRAM_ID,
              rent:           SYSVAR_RENT_PUBKEY,
            })
            .signers([poolKP])
            .rpc()

          setPoolAddr(poolKP.publicKey.toBase58())
        }
      }

    } catch (err: any) {
      console.error('❌ mintNFT error:', err)
      const msg = err instanceof Error ? err.message : JSON.stringify(err, null,2)
      alert('Mint failed: ' + msg)
    } finally {
      setMinting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Create Your Music NFT</h1>
          <WalletMultiButton />
        </header>

        {/* bundle toggle & #tracks */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isBundle}
              onChange={()=>{
                const nxt = !isBundle
                setIsBundle(nxt)
                setNumTracks(nxt?2:1)
                setTracks(Array(nxt?2:1).fill(null).map(()=>({...blankTrack})))
              }}
            />
            <span>Bundle (album)</span>
          </label>
          {isBundle && (
            <label>
              #Tracks:
              <input
                type="number"
                min={1} max={5}
                value={numTracks}
                onChange={e=>{
                  const n = Math.min(5,Math.max(1,+e.target.value))
                  setNumTracks(n)
                  setTracks(t=>{
                    const c=[...t]
                    while(c.length<n) c.push({...blankTrack})
                    return c.slice(0,n)
                  })
                }}
                className="ml-2 w-16 text-black"
              />
            </label>
          )}
        </div>

        {/* steps */}
        <div className="bg-gray-800 p-6 rounded space-y-6">
          {step===1 && <>
            <h2 className="text-xl font-semibold">Step 1: Upload Files</h2>
            {tracks.map((t,i)=>(
              <div key={i} className="border p-4 rounded space-y-4">
                <h3 className="font-medium">Track #{i+1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label>Cover Image *</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e=>updateTrack(i,{cover:e.target.files?.[0]||null})}
                      className="file:bg-purple-600 file:text-white file:rounded-full"
                    />
                  </div>
                  <div>
                    <label>Animation (Video) *</label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={e=>updateTrack(i,{video:e.target.files?.[0]||null})}
                      className="file:bg-purple-600 file:text-white file:rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <label>Audio (MP3)</label>
                  <input
                    type="file"
                    accept="audio/mp3"
                    onChange={e=>updateTrack(i,{audio:{mp3:e.target.files?.[0]||null}})}
                    className="file:bg-purple-600 file:text-white file:rounded-full"
                  />
                </div>
              </div>
            ))}
          </>}
          {step===2 && <>
            <h2 className="text-xl font-semibold">Step 2: NFT Details</h2>
            {tracks.map((t,i)=>(
              <div key={i} className="border p-4 rounded">
                <h3 className="font-medium">Track #{i+1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(t.metadata).map(([k,v])=>(
                    <div key={k}>
                      <label>{k}</label>
                      {k==='description'
                        ? <textarea
                            value={v}
                            onChange={e=>updateMeta(i,k as any,e.target.value)}
                            className="w-full bg-gray-700 rounded p-2"
                          />
                        : <input
                            type="text"
                            value={v}
                            onChange={e=>updateMeta(i,k as any,e.target.value)}
                            className="w-full bg-gray-700 rounded p-2"
                          />
                      }
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>}
          {step===3 && <>
            <h2 className="text-xl font-semibold">Step 3: Seed & Copies</h2>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={skipDeposit}
                onChange={e=>setSkipDeposit(e.target.checked)}
              />
              <span>Skip deposit</span>
            </label>
            {!skipDeposit && (
              <div>
                <label>Initial WOODENG deposit</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositWoodeng}
                  onChange={e=>setDepositWoodeng(e.target.value)}
                  className="w-24 bg-gray-700 rounded p-1"
                />
              </div>
            )}
            <div>
              <label>Copies per track</label>
              <input
                type="number"
                min="1"
                value={copies}
                onChange={e=>setCopies(e.target.value)}
                className="w-24 bg-gray-700 rounded p-1"
              />
            </div>
          </>}
          {step===4 && <>
            <h2 className="text-xl font-semibold">Step 4: Preview & Mint</h2>
            <button
              onClick={mintNFT}
              disabled={minting}
              className="w-full py-2 bg-purple-600 rounded hover:bg-purple-500 disabled:opacity-50"
            >
              {minting ? 'Minting…' : 'Create & Seed Pool'}
            </button>
            {mintedAddrs.length>0 && (
              <div className="bg-gray-700 p-4 rounded">
                <CheckIcon className="inline-block mr-2 text-green-400" />
                <span>Successfully minted:</span>
                <ul className="text-sm break-all">
                  {mintedAddrs.map(a=><li key={a}>{a}</li>)}
                </ul>
              </div>
            )}
            {poolAddr && (
              <p className="text-green-400">
                New AMM pool: <code>{poolAddr}</code>
              </p>
            )}
          </>}
          <div className="flex justify-between mt-4">
            {step>1
              ? <button onClick={prev} className="px-4 py-2 bg-gray-700 rounded">Previous</button>
              : <div/>
            }
            {step<4 && (
              <button onClick={next} className="px-4 py-2 bg-purple-600 rounded">Next</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
