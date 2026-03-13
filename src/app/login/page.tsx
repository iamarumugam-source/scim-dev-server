"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Could not start the sign-in flow. Please try again.",
  OAuthCallback: "Something went wrong during sign-in. Please try again.",
  OAuthCreateAccount: "Could not create your account. Contact support.",
  OAuthAccountNotLinked: "This email is already linked to a different account.",
  Callback: "An unexpected error occurred. Please try again.",
  Default: "An error occurred. Please try again.",
};

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const errorCode = params.get("error") ?? "";
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default)
    : null;
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("okta", { callbackUrl });
  };

  return (
    <div className="w-full max-w-sm px-4">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-8 pt-8 pb-6 text-center border-b border-border/60">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Image
              src="/okta.svg"
              alt="Okta"
              width={20}
              height={20}
              className="dark:invert"
            />
            <span className="text-lg font-semibold">Okta internal tools</span>
          </div>
        </div>

        <div className="px-8 py-6 space-y-4">
          {errorMessage && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <Button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full gap-2 font-medium"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Image
                src="/okta.svg"
                alt=""
                width={16}
                height={16}
                className="dark:invert"
              />
            )}
            {loading ? "Redirecting…" : "Sign in with Okta"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Need access?{" "}
            <a
              href="slack://channel?team=E017NDYFGQL&id=C0AKWV1GCHM"
              className="text-foreground font-medium hover:underline"
            >
              #dse-internal-tooling
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
