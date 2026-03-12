"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export function usePageTracking() {
  const { data: session } = useSession();
  const userId  = session?.user?.id;
  const pathname = usePathname();

  useEffect(() => {
    if (!userId || !pathname) return;
    fetch(`/api/${userId}/analytics`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [userId, pathname]);
}
