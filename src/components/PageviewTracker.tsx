"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logPageview } from "@/lib/pageviews";

/**
 * Mounted once in the root layout — logs one Firestore doc per
 * client-side navigation for the admin dashboard's visitor-stats tab.
 * Renders nothing.
 */
export default function PageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    logPageview(pathname);
  }, [pathname]);

  return null;
}
