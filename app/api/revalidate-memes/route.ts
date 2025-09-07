import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST() {
  try {
    revalidatePath("/");      // homepage
    revalidateTag("memes");   // if you later tag fetches
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return new NextResponse(e?.message || "revalidate error", { status: 500 });
  }
}
