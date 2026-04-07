"use client";

import { Lock, KeyRound } from "lucide-react";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FloatIcon } from "@/components/motion/float-icon";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";

const KEY_HINTS = [
  { label: "RSA Private (JWK)",  desc: 'kty: "RSA" with d, p, q — for RSA-OAEP, RSA-OAEP-256' },
  { label: "EC Private (JWK)",   desc: 'kty: "EC" with d — for ECDH-ES, ECDH-ES+A256KW'        },
  { label: "Symmetric (JWK)",    desc: 'kty: "oct" with k — for dir+AES, HS256/384/512'          },
  { label: "JWKS",               desc: '{ "keys": [...] } — server tries each key automatically'  },
  { label: "Not needed for JWT", desc: "Plain JWTs (3 parts) are decoded without a key"           },
];

export function JweEmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-5 text-center px-6"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 18, mass: 0.8 }}
    >
      {/* Floating lock icon */}
      <FloatIcon amplitude={7} speed={3}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground/70" />
        </div>
      </FloatIcon>

      {/* Description */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.08 }}
      >
        <p className="text-sm font-medium">Decoded output will appear here</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Paste a token on the left and click Decode. JWTs are decoded without a key.
          JWE tokens require a private or symmetric key.
        </p>
      </motion.div>

      {/* Key hints — staggered spring entrance */}
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.15 }}
      >
        <Card className="text-left overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Supported key types
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            <StaggerList>
              {KEY_HINTS.map((h, i) => (
                <StaggerItem key={h.label}>
                  <div className="flex items-start gap-2.5 py-2">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">{h.label}</span>
                      <span className="text-sm text-muted-foreground"> — {h.desc}</span>
                    </div>
                  </div>
                  {i < KEY_HINTS.length - 1 && <Separator />}
                </StaggerItem>
              ))}
            </StaggerList>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
