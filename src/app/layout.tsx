import type { Metadata } from "next";
import { Chakra_Petch } from "next/font/google";
import "./globals.css";
// ClientProviders and Navbar were temporarily disabled during prerender
// diagnostics; restore them now.
import ClientProviders from "@/lib/context/ClientProviders";
import ConditionalNav from "@/components/nav/ConditionalNav";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-chakra-petch",
  display: "swap",
});

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
      { url: "/msp pentesting logo (1) (3) (1).png" },
      { url: "/msp pentesting logo (1) (3) (1).png", sizes: "32x32" },
      { url: "/msp pentesting logo (1) (3) (1).png", sizes: "16x16" },
    ],
    shortcut: "/msp pentesting logo (1) (3) (1).png",
    apple: "/msp pentesting logo (1) (3) (1).png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={chakraPetch.variable}>
      {/* Change your theme HERE */}
      <body data-theme="cupcake">
        <ClientProviders>
          <ConditionalNav>{children}</ConditionalNav>
        </ClientProviders>
      </body>
    </html>
  );
}
