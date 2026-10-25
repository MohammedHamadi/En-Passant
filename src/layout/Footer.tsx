"use client";

import Image from "next/image";
import Link from "next/link";

const socialLinks = [
  { 
    name: "Instagram", 
    href: "https://www.instagram.com/ensia.sport.culture.club/", 
    icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
            <path d="M7.25 2h9.5A5.26 5.26 0 0 1 22 7.25v9.5A5.26 5.26 0 0 1 16.75 22h-9.5A5.26 5.26 0 0 1 2 16.75v-9.5A5.26 5.26 0 0 1 7.25 2Zm0 2.2A3.06 3.06 0 0 0 4.2 7.25v9.5a3.06 3.06 0 0 0 3.05 3.05h9.5a3.06 3.06 0 0 0 3.05-3.05v-9.5a3.06 3.06 0 0 0-3.05-3.05Zm4.75 2.15a5.65 5.65 0 1 1 0 11.3 5.65 5.65 0 0 1 0-11.3Zm0 2.2a3.45 3.45 0 1 0 0 6.9 3.45 3.45 0 0 0 0-6.9Zm5.4-.95a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z" />
        </svg>
    )
  },
  { 
    name: "LinkedIn", 
    href: "https://www.linkedin.com/company/ensia-sports-culture-club/posts/?feedView=all", 
    icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
            <path d="M3 4.6A1.6 1.6 0 0 1 4.6 3h14.8A1.6 1.6 0 0 1 21 4.6v14.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 19.4ZM7.7 10v7.1h2.35V10Zm1.2-1.03a1.37 1.37 0 1 0 0-2.74 1.37 1.37 0 0 0 0 2.74ZM12.1 10v7.1h2.35v-3.52c0-1 .2-1.98 1.44-1.98 1.22 0 1.24 1.14 1.24 2.04v3.46h2.37V13.2c0-1.91-.41-3.38-2.64-3.38a2.3 2.3 0 0 0-2.07 1.13h-.03V10Z" />
        </svg>
    )
  },
  { 
    name: "Email", 
    href: "mailto:escc@ensia.edu.dz", 
    icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
            <path d="M2 6.6 12 13l10-6.4V18a2 2 0 0 1-2 2h-4.05v-6.4L12 16.1 8.05 13.6V20H4a2 2 0 0 1-2-2Zm0-2.6A2 2 0 0 1 4 2h16a2 2 0 0 1 2 2l-10 6.4Z" />
        </svg>
    )
  },
  { 
    name: "TikTok", 
    href: "https://www.tiktok.com/@escclub", 
    icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
    )
  },
];

export default function Footer() {
  return (
    <footer
      className="relative w-full mt-auto"
      style={{
        borderTop: "1px solid rgba(0,229,255,0.15)",
        background: "linear-gradient(to bottom, rgba(2,14,42,0.85), rgba(3,8,28,0.95))",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-8">
        {/* Logo + name */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Image
              src="/images/brand/esc.webp"
              alt="ESCC Logo"
              width={28}
              height={28}
              className="h-8 w-auto drop-shadow-[0_0_6px_rgba(0,229,255,0.5)]"
            />
          </div>
          <div className="leading-tight">
            <div
              className="text-xs font-black tracking-[0.2em] text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              EN PASSANT
            </div>
            <div className="text-[0.6rem] font-bold tracking-[0.18em]" style={{ color: "#00e5ff" }}>
              CHESS
            </div>
          </div>
        </Link>

        {/* Copyright */}
        <p className="text-xs text-center hidden sm:block" style={{ color: "rgba(176,210,240,0.5)" }}>
          © 2026 ESCC. All rights reserved.
        </p>

        {/* Social links */}
        <div className="flex items-center gap-4">
          {socialLinks.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              aria-label={item.name}
              className="transition-all duration-200 hover:scale-110"
              style={{ color: "rgba(176,210,240,0.7)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#00e5ff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(176,210,240,0.7)"; }}
            >
              {item.icon}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}