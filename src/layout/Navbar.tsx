"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

const navItems = [
  { name: "Home",        href: "/" },
  { name: "My match", href: "/me" },
  { name: "Games", href: "/games" },
  { name: "Leaderboard", href: "/standings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (mobileOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [mobileOpen]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as { authenticated?: boolean };
        if (isMounted) {
          setIsAuthenticated(Boolean(payload.authenticated));
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "linear-gradient(90deg, rgba(2,22,56,0.72) 0%, rgba(0,40,92,0.78) 50%, rgba(2,22,56,0.72) 100%)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(0,229,255,0.18)",
        boxShadow: "0 2px 24px rgba(0,16,44,0.55)",
      }}
    >
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Image
              src="/images/brand/esc.webp"
              alt="ESCC Logo"
              width={48}
              height={48}
              priority
              className="h-10 w-auto drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]"
            />
          </div>
          <div className="leading-tight">
            <div
              className="text-[0.95rem] font-black tracking-[0.2em] text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              EN PASSANT
            </div>
            <div
              className="text-[0.7rem] font-bold tracking-[0.18em]"
              style={{ color: "#00e5ff" }}
            >
              CHESS
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden items-center gap-8 md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="group relative py-2 text-sm font-semibold tracking-[0.1em] transition-colors duration-300"
                style={{ color: isActive ? "#00e5ff" : "rgba(224,242,255,0.8)" }}
              >
                {item.name}
                <span
                  className="pointer-events-none absolute -bottom-1 left-0 right-0 h-0.5 rounded-full origin-left transition-transform duration-300"
                  style={{
                    background: "#00e5ff",
                    transform: isActive ? "scaleX(1)" : "scaleX(0)",
                  }}
                />
                <span
                  className="pointer-events-none absolute -bottom-1 left-0 right-0 h-0.5 rounded-full origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                  style={{ background: "rgba(0,229,255,0.5)" }}
                />
              </Link>
            );
          })}
        </nav>

        {/* Desktop Dashboard Button */}
        {isAuthenticated && (
          <Link
            href="/admin"
            className="ml-auto hidden md:inline-flex items-center rounded-xl border px-4 py-2 text-xs font-black tracking-[0.1em] uppercase transition-all"
            style={{
              borderColor: "rgba(0,229,255,0.3)",
              background: pathname.startsWith("/dashboard")
                ? "rgba(0,229,255,0.2)"
                : "rgba(0,229,255,0.08)",
              color: "#00e5ff",
            }}
          >
            Dashboard
          </Link>
        )}


        {/* Mobile menu button */}
        <div ref={menuRef} className="relative ml-auto md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
            style={{
              border: "1px solid rgba(0,229,255,0.4)",
              background: "rgba(0,229,255,0.08)",
              color: "#e0f8ff",
            }}
          >
            <span className="relative block h-4 w-5">
              <span className="absolute left-0 top-0 block h-0.5 w-5 rounded-full bg-current" />
              <span className="absolute left-0 top-1.5 block h-0.5 w-5 rounded-full bg-current" />
              <span className="absolute left-0 top-3.5 block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>

          {mobileOpen && (
            <div
              className="absolute right-0 top-[calc(100%+0.7rem)] w-56 overflow-hidden rounded-2xl"
              style={{
                border: "1px solid rgba(0,229,255,0.3)",
                background: "linear-gradient(135deg, rgba(2,22,56,0.97), rgba(0,40,92,0.94))",
                backdropFilter: "blur(20px)",
                boxShadow: "0 14px 38px rgba(0,16,44,0.55)",
              }}
            >
              <nav className="flex flex-col p-2">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-xl px-4 py-3 text-sm font-semibold tracking-[0.08em] transition-colors hover:bg-cyan-300/10"
                    style={{ color: pathname === item.href ? "#00e5ff" : "rgba(224,242,255,0.88)" }}
                  >
                    {item.name}
                  </Link>
                ))}
                {isAuthenticated && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="mt-1 block rounded-xl px-4 py-3 text-sm font-semibold tracking-[0.08em] transition-colors hover:bg-cyan-300/10"
                    style={{
                      color: pathname.startsWith("/dashboard")
                        ? "#00e5ff"
                        : "rgba(224,242,255,0.88)",
                    }}
                  >
                    Dashboard
                  </Link>
                )}
              </nav>

            </div>
          )}
        </div>
      </div>
    </header>
  );
}
