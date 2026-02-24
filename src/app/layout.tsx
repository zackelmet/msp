import type { Metadata } from "next";
import "./globals.css";
// ClientProviders and Navbar were temporarily disabled during prerender
// diagnostics; restore them now.
import ClientProviders from "@/lib/context/ClientProviders";
import ConditionalNav from "@/components/nav/ConditionalNav";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

export const metadata: Metadata = {
  title: "MSP Pentesting - Penetration Testing as a Service",
  description:
    "AI-powered automated pentests and expert-led manual penetration testing. Get comprehensive security assessments from certified professionals.",
  metadataBase: new URL("https://msppentesting.vercel.app"),
  openGraph: {
    title: "MSP Pentesting - Penetration Testing as a Service",
    description:
      "AI-powered automated pentests and expert-led manual penetration testing.",
    url: "https://msppentesting.vercel.app",
    siteName: "MSP Pentesting",
  },
  twitter: {
    card: "summary_large_image",
    title: "MSP Pentesting - Penetration Testing as a Service",
    description:
      "AI-powered automated pentests and expert-led manual penetration testing.",
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16" },
    ],
    shortcut: "/favicon/favicon-32x32.png",
    apple: "/favicon/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Change your theme HERE */}
      <body data-theme="cupcake">
        <ClientProviders>
          <ConditionalNav>{children}</ConditionalNav>
        </ClientProviders>
      </body>
    </html>
  );
}
