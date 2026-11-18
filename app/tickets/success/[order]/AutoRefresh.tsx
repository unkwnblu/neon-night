"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-checks the order every few seconds for up to five minutes while payment confirms. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries > 60) clearInterval(timer);
      else router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
