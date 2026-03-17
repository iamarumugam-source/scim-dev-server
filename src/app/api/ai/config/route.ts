import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    model: process.env.LLM_MODEL ?? null,
  });
}
