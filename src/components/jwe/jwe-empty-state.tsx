import { Lock, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const KEY_HINTS = [
  { label: "RSA Private (JWK)",   desc: 'kty: "RSA" with d, p, q — for RSA-OAEP, RSA-OAEP-256' },
  { label: "EC Private (JWK)",    desc: 'kty: "EC" with d — for ECDH-ES, ECDH-ES+A256KW' },
  { label: "Symmetric (JWK)",     desc: 'kty: "oct" with k — for dir+AES, HS256/384/512' },
  { label: "JWKS",                desc: '{ "keys": [...] } — server tries each key automatically' },
  { label: "Not needed for JWT",  desc: "Plain JWTs (3 parts) are decoded without a key" },
];

export function JweEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">Decoded output will appear here</p>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
          Paste a token on the left and click Decode. JWTs are decoded without a key. JWE tokens require a private or symmetric key.
        </p>
      </div>
      <Card className="w-full max-w-sm">
        <CardContent className="p-3 text-left space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Supported key types
          </p>
          {KEY_HINTS.map((h) => (
            <div key={h.label} className="flex items-start gap-2">
              <KeyRound className="h-3 w-3 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-foreground">{h.label}</span>
                <span className="text-[11px] text-muted-foreground"> — {h.desc}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
