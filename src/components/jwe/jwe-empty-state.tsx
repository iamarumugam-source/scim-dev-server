import { Lock, KeyRound } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const KEY_HINTS = [
  { label: "RSA Private (JWK)",  desc: 'kty: "RSA" with d, p, q — for RSA-OAEP, RSA-OAEP-256' },
  { label: "EC Private (JWK)",   desc: 'kty: "EC" with d — for ECDH-ES, ECDH-ES+A256KW'        },
  { label: "Symmetric (JWK)",    desc: 'kty: "oct" with k — for dir+AES, HS256/384/512'          },
  { label: "JWKS",               desc: '{ "keys": [...] } — server tries each key automatically'  },
  { label: "Not needed for JWT", desc: "Plain JWTs (3 parts) are decoded without a key"           },
];

export function JweEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6">

      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Description */}
      <div>
        <p className="text-sm font-medium">Decoded output will appear here</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Paste a token on the left and click Decode. JWTs are decoded without a key. JWE tokens require a private or symmetric key.
        </p>
      </div>

      {/* Key hints card */}
      <Card className="w-full max-w-sm text-left">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Supported key types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 pt-0">
          {KEY_HINTS.map((h, i) => (
            <div key={h.label}>
              <div className="flex items-start gap-2.5 py-2">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">{h.label}</span>
                  <span className="text-sm text-muted-foreground"> — {h.desc}</span>
                </div>
              </div>
              {i < KEY_HINTS.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  );
}
