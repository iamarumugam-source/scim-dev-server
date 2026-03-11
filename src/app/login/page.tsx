"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Image from "next/image";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin:         "Could not start the sign-in flow. Please try again.",
  OAuthCallback:       "Something went wrong during sign-in. Please try again.",
  OAuthCreateAccount:  "Could not create your account. Contact support.",
  OAuthAccountNotLinked: "This email is linked to a different account.",
  Callback:            "An unexpected error occurred. Please try again.",
  Default:             "An error occurred. Please try again.",
};

function LoginForm() {
  const params       = useSearchParams();
  const callbackUrl  = params.get("callbackUrl") ?? "/";
  const errorCode    = params.get("error") ?? "";
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default) : null;
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("okta", { callbackUrl });
  };

  return (
    <div className="w-full max-w-[400px] px-4">
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background px-8 pt-10 pb-6 text-center border-b border-border/60">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">SCIM Admin</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Manage SCIM provisioning, users, and groups for your Okta integration.
          </p>
        </div>

        <div className="px-8 py-8 space-y-5">
          {errorMessage && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Sign in to your account</p>
            <p className="text-xs text-muted-foreground">
              Use your Okta credentials to continue.
            </p>
          </div>

          <Button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full h-11 gap-3 font-medium"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Image
                src="/okta.svg"
                alt="Okta"
                width={18}
                height={18}
                className="dark:invert"
              />
            )}
            {loading ? "Redirecting to Okta…" : "Continue with Okta"}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground/70">
            By signing in you agree to the terms of your organisation's Okta policy.
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground/60">
        Secured with Okta · SCIM 2.0
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className={cn(
      "relative flex items-center justify-center w-full h-full",
      "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]",
      "from-primary/5 via-background to-background",
    )}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
