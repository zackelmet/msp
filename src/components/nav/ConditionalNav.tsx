"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function ConditionalNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard =
    !pathname ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/admin");

  return (
    <>
      {!isDashboard && <Navbar />}
      {children}
      {!isDashboard && <Footer />}
    </>
  );
}
