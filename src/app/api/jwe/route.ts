import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

export async function POST(req: NextRequest) {
  // const { keys, token } = await params;

  const { keys, token } = await req.json();

  try {
    const { plaintext } = await jose.compactDecrypt(token, keys);

    const id_token = new TextDecoder().decode(plaintext);
    return NextResponse.json({ id_token });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
