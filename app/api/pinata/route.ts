// app/api/pinata/route.ts
import { NextRequest, NextResponse } from 'next/server'
import PinataClient from '@pinata/sdk'        // <- default import
import { PassThrough } from 'stream'

// Tell Next.js this runs in Node so we can use Buffer & streams:
export const runtime = 'nodejs'

// Instantiate the Pinata client with your V3 key/secret (Files:Write must be enabled):
const pinata = new PinataClient({
  pinataApiKey:       process.env.PINATA_API_KEY!,
  pinataSecretApiKey: process.env.PINATA_SECRET_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ pull the browser File out of the multipart form
    const formData = await req.formData()
    const webFile  = formData.get('file') as File | null
    if (!webFile) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // 2️⃣ convert it to a Buffer
    const arrayBuffer = await webFile.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    // 3️⃣ Pipe that Buffer into a PassThrough so pinata sees a Readable stream
    const stream = new PassThrough()
    stream.end(buffer)

    // 4️⃣ Pin to IPFS
    const { IpfsHash } = await pinata.pinFileToIPFS(stream, {
      pinataMetadata: { name: webFile.name },
      pinataOptions:  { cidVersion: 1 },
    })

    return NextResponse.json({ success: true, cid: IpfsHash })
  } catch (e: any) {
  // include the full Pinata error in the JSON
  console.error('Pinata error', e)
  return NextResponse.json(
    { success: false, 
      error: typeof e === 'string' ? e : JSON.stringify(e, null, 2) 
    },
    { status: 500 }
  )
}}
