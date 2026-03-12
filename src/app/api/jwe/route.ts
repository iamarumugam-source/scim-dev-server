import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

// ─── Base64url helpers ─────────────────────────────────────────────────────────

function b64UrlToBuffer(str: string): Buffer {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad  = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64");
}

function parseB64Part(part: string): unknown {
  try { return JSON.parse(b64UrlToBuffer(part).toString("utf8")); } catch { return null; }
}

// ─── Decode a plain JWT (JWS) without verification ────────────────────────────

function decodeJwt(token: string): { header: unknown; payload: unknown; raw: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header  = parseB64Part(parts[0]);
  const payload = parseB64Part(parts[1]);
  if (!header || !payload) return null;
  return { header, payload, raw: token };
}

// ─── Import a single JWK ──────────────────────────────────────────────────────

async function importJwk(jwk: jose.JWK): Promise<CryptoKey | Uint8Array> {
  return jose.importJWK(jwk) as Promise<CryptoKey | Uint8Array>;
}

// ─── Try to parse decrypted plaintext ────────────────────────────────────────

function parsePlaintext(text: string): { header?: unknown; payload?: unknown; isJwt: boolean } {
  // Inner content is another JWT (JWS)
  const jwt = decodeJwt(text);
  if (jwt) return { header: jwt.header, payload: jwt.payload, isJwt: true };
  // Inner content is JSON
  try { return { payload: JSON.parse(text), isJwt: false }; } catch {}
  // Plain text
  return { payload: text, isJwt: false };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { token, key } = body as { token?: string; key?: unknown };

  if (!token?.trim()) {
    return NextResponse.json({ detail: "Token is required." }, { status: 400 });
  }

  const parts = token.trim().split(".");

  // ── Plain JWT / JWS (3 parts) — decode without key ─────────────────────────
  if (parts.length === 3) {
    const decoded = decodeJwt(token.trim());
    if (!decoded) {
      return NextResponse.json({ detail: "Token has 3 parts but could not be decoded." }, { status: 400 });
    }
    return NextResponse.json({ type: "JWT", header: decoded.header, payload: decoded.payload, raw: decoded.raw });
  }

  // ── JWE (5 parts) — requires key ───────────────────────────────────────────
  if (parts.length === 5) {
    if (!key) {
      return NextResponse.json({ detail: "A private/symmetric key is required to decrypt a JWE token." }, { status: 400 });
    }

    const keyObj = key as Record<string, unknown>;

    // Decode the JWE protected header so we can surface it
    let jweHeader: unknown = null;
    try { jweHeader = parseB64Part(parts[0]); } catch {}

    const decrypt = async (k: CryptoKey | Uint8Array) => {
      const { plaintext } = await jose.compactDecrypt(token.trim(), k);
      return new TextDecoder().decode(plaintext);
    };

    // JWKS — try each key
    if (keyObj.keys && Array.isArray(keyObj.keys)) {
      for (const k of keyObj.keys as jose.JWK[]) {
        try {
          const imported   = await importJwk(k);
          const plaintext  = await decrypt(imported);
          const { header, payload, isJwt } = parsePlaintext(plaintext);
          return NextResponse.json({
            type: "JWE", jweHeader, header, payload,
            raw: plaintext, innerIsJwt: isJwt,
          });
        } catch {}
      }
      return NextResponse.json({ detail: "None of the provided keys could decrypt this token." }, { status: 400 });
    }

    // Single JWK
    try {
      const imported  = await importJwk(keyObj as jose.JWK);
      const plaintext = await decrypt(imported);
      const { header, payload, isJwt } = parsePlaintext(plaintext);
      return NextResponse.json({
        type: "JWE", jweHeader, header, payload,
        raw: plaintext, innerIsJwt: isJwt,
      });
    } catch (e: any) {
      return NextResponse.json({ detail: `Decryption failed: ${e.message}` }, { status: 400 });
    }
  }

  return NextResponse.json(
    { detail: `Unexpected token format — got ${parts.length} parts. Expected 3 (JWT) or 5 (JWE).` },
    { status: 400 },
  );
}
