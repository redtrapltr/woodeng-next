// app/api/pinata-token/route.ts
import { NextResponse } from 'next/server'

// runs on the server-only, so it’s safe to read a JWT from env
export async function GET() {
  return NextResponse.json({
    jwt: process.env.PINATA_JWT!,  // short-lived, pinFileToIPFS+pinJSONToIPFS only
  })
}
