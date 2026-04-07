import { Fragment } from "react";
import { Lock, KeyRound } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const KEY_HINTS = [
  { label: "RSA Private (JWK)",  desc: 'kty: "RSA" with d, p, q — for RSA-OAEP, RSA-OAEP-256' },
  { label: "EC Private (JWK)",   desc: 'kty: "EC" with d — for ECDH-ES, ECDH-ES+A256KW'        },
  { label: "Symmetric (JWK)",    desc: 'kty: "oct" with k — for dir+AES, HS256/384/512'          },
  { label: "JWKS",               desc: '{ "keys": [...] } — server tries each key automatically'  },
  { label: "Not needed for JWT", desc: "Plain JWTs (3 parts) are decoded without a key"           },
];

export function JweEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8 py-10">

      {/* Hero */}
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock />
        </EmptyMedia>
        <EmptyTitle className="text-base">Decoded output will appear here</EmptyTitle>
        <EmptyDescription>
          Paste a token and click Decode. JWTs decode without a key;
          JWE tokens require a private or symmetric key.
        </EmptyDescription>
      </EmptyHeader>

      <Separator className="w-full max-w-sm" />

      {/* Supported key types — always visible */}
      <div className="w-full max-w-sm space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Supported key types
        </p>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5">
          {KEY_HINTS.map((h) => (
            <Fragment key={h.label}>
              <span className="flex items-center gap-2 text-xs font-medium text-foreground whitespace-nowrap">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                {h.label}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                {h.desc}
              </span>
            </Fragment>
          ))}
        </div>
      </div>

    </div>
  );
}
