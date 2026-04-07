import { Lock, KeyRound } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

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
      <Lock className="h-8 w-8 text-muted-foreground/40" />

      {/* Description */}
      <div>
        <p className="text-sm font-medium">Decoded output will appear here</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Paste a token on the left and click Decode. JWTs are decoded without a key. JWE tokens require a private or symmetric key.
        </p>
      </div>

      {/* Key hints card */}
      <Card className="w-full max-w-sm text-left overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Supported key types
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          <Table>
            <TableBody>
              {KEY_HINTS.map((h) => (
                <TableRow key={h.label} className="hover:bg-muted/40">
                  <TableCell className="py-2 px-4">
                    <div className="flex items-start gap-2.5">
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-foreground">{h.label}</span>
                        <span className="text-xs text-muted-foreground"> — {h.desc}</span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
