import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";

import Navbar from "@/layout/Navbar";
import Footer from "@/layout/Footer";

import "@/style/globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

/* TOMO Bossa Black — copied from Olympole via scripts/copy-assets.cjs */
const tomoBossa = localFont({
  src: "../../public/fonts/TOMO Bossa Black.ttf",
  variable: "--font-tomo-bossa",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "En Passant",
    template: "%s | En Passant",
  },
  description:
    "En Passant – 3rd Edition. Rapid 10+2 chess at ENSIA on November 7, 2026. Organised by ESCC.",
  keywords: [
    "En Passant",
    "chess tournament",
    "Swiss System",
    "Knockout",
    "online chess",
    "En Passant 2026",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "En Passant",
    title: "En Passant",
    description:
      "En Passant – 3rd Edition · November 7, 2026 · ENSIA · Rapid 10+2.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "En Passant",
    description:
      "En Passant – 3rd Edition · November 7, 2026 · ENSIA · Rapid 10+2.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${tomoBossa.variable}`}>
      <body>
        <Navbar />
        <div>{children}</div>
        <Footer />
      </body>
    </html>
  );
}
