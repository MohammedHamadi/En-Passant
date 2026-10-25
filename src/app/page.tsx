"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Users, Swords, Monitor, Clock, LayoutGrid, Flag, Scale } from "lucide-react";

/* ─── Info Cards Data ─── */
const INFO_CARDS = [
  {
    id: "date",
    icon: Calendar,
    label: "DATE",
    lines: ["November 7, 2026", "Single Day Event"],
  },
  {
    id: "category",
    icon: Users,
    label: "CATEGORY",
    lines: ["Individual Sport", "Chess"],
  },
  {
    id: "format",
    icon: Swords,
    label: "FORMAT",
    lines: ["Swiss System", "+ Knockout", "ENSIA hall"],
  },
  {
    id: "platform",
    icon: Monitor,
    label: "PLATFORM",
    lines: ["En Passant", "Player codes", "Pairings & Standings"],
  },
];

/* ─── Rules Data ─── */
const RULES = [
  {
    id: "time-control",
    icon: Clock,
    label: "TIME CONTROL",
    value: "10 minutes + 2 seconds increment per move",
  },
  {
    id: "format-rule",
    icon: LayoutGrid,
    label: "FORMAT",
    value: "Swiss System + Knockout",
  },
  {
    id: "rounds",
    icon: Flag,
    label: "ROUNDS",
    value: "To be announced",
  },
  {
    id: "tie-breaks",
    icon: Scale,
    label: "TIE-BREAKS",
    value: "Buchholz, Direct Encounter, Fewer Byes, Armageddon",
  },
];

export default function ChessLandingPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* ═══════════════════ HERO SECTION ═══════════════════ */}
      <section
        className="relative flex min-h-[calc(100svh-5rem)] w-full flex-col items-center justify-center overflow-hidden py-12"
        style={{ isolation: "isolate" }}
      >
        {/* Background image */}
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/backgrounds/background.avif"
            alt="En Passant cyber-stadium background"
            fill
            priority
            className="object-cover object-center"
          />
          {/* Dark overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(3,8,28,0.35) 0%, rgba(3,8,28,0.55) 70%, rgba(3,8,28,0.75) 100%)",
            }}
          />
          {/* Subtle dot grid */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-4">
          {/* Flame + Rings logo */}
          <div className="animate-float mb-2">
            <Image
              src="/images/brand/fire.webp"
              alt="ESCC flame"
              width={200}
              height={240}
              priority
              className="mx-auto h-auto w-36 md:w-44 lg:w-52 drop-shadow-[0_0_40px_rgba(0,229,255,0.35)]"
            />
          </div>
          <Image
            src="/images/brand/circles.webp"
            alt="ESCC rings"
            width={200}
            height={110}
            className="mx-auto mb-6 h-auto w-20 md:w-24 lg:w-28"
          />

          {/* Title */}
          <h1
            className="font-black tracking-tighter leading-none mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span
              className="block text-6xl md:text-8xl lg:text-9xl"
              style={{
                color: "white",
                textShadow: "0 0 60px rgba(0,229,255,0.25)",
              }}
            >
              EN PASSANT
            </span>
            <span
              className="block text-4xl md:text-6xl lg:text-7xl"
              style={{
                color: "#00e5ff",
                textShadow: "0 0 30px rgba(0,229,255,0.7)",
              }}
            >
              CHESS
            </span>
          </h1>

          {/* Taglines */}
          <p
            className="mt-5 text-lg md:text-xl font-semibold text-white/90"
          >
            3rd Edition · Rapid Chess Tournament
          </p>
          <p
            className="mt-1 text-sm md:text-base font-medium"
            style={{ color: "#00e5ff" }}
          >
            November 7, 2026 · ENSIA hall · 09:00
          </p>
        </div>

        {/* ─── Info Cards ─── */}
        <div className="relative z-10 mt-12 w-full max-w-5xl px-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {INFO_CARDS.map(({ id, icon: Icon, label, lines }) => (
              <div
                key={id}
                id={`info-${id}`}
                className="rounded-2xl p-4 md:p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_24px_rgba(0,229,255,0.22)]"
                style={{
                  background: "rgba(5,12,40,0.7)",
                  border: "1px solid rgba(0,229,255,0.2)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Icon
                    className="h-5 w-5 shrink-0"
                    style={{ color: "#00e5ff" }}
                  />
                  <span
                    className="text-xs font-bold tracking-[0.14em] uppercase"
                    style={{ color: "#00e5ff" }}
                  >
                    {label}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {lines.map((line, i) => (
                    <p
                      key={i}
                      className={`text-sm leading-snug ${
                        i === 0
                          ? "font-bold text-white"
                          : "text-white/60"
                      }`}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Scroll chevron */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                document.getElementById("tournament-rules")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="animate-bounce text-white/40 hover:text-white/70 transition-colors"
              aria-label="Scroll to tournament rules"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TOURNAMENT RULES ═══════════════════ */}
      <section
        id="tournament-rules"
        className="w-full px-4 py-16 md:py-20"
        style={{ background: "rgba(3,8,28,0.95)" }}
      >
        <div className="mx-auto max-w-4xl">
          {/* Section heading */}
          <h2
            className="mb-2 text-center text-3xl font-black tracking-wide text-white md:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            TOURNAMENT RULES
          </h2>
          <div
            className="mx-auto mb-10 h-1 w-16 rounded-full"
            style={{ background: "#00e5ff", boxShadow: "0 0 10px rgba(0,229,255,0.7)" }}
          />

          {/* Rules list */}
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              border: "1px solid rgba(0,229,255,0.18)",
              background: "rgba(5,12,40,0.65)",
            }}
          >
            {RULES.map(({ id, icon: Icon, label, value }, idx) => (
              <div
                key={id}
                id={`rule-${id}`}
                className="flex items-start gap-5 px-6 py-5 md:px-8 md:py-6 transition-colors duration-200 hover:bg-white/[0.03]"
                style={{
                  borderBottom:
                    idx < RULES.length - 1
                      ? "1px solid rgba(0,229,255,0.12)"
                      : "none",
                }}
              >
                {/* Icon */}
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "rgba(0,229,255,0.08)",
                    border: "1px solid rgba(0,229,255,0.2)",
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: "#00e5ff" }} />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p
                    className="mb-1 text-xs font-bold tracking-[0.16em] uppercase"
                    style={{ color: "#00e5ff" }}
                  >
                    {label}
                  </p>
                  <p className="text-sm text-white/80 md:text-base">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">

            <Link
              href="/standings"
              id="cta-leaderboard"
              className="inline-flex h-13 w-64 items-center justify-center rounded-full text-base font-bold tracking-widest transition-all duration-200 hover:scale-[1.03] hover:bg-white/10"
              style={{
                border: "1.5px solid rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              VIEW STANDINGS
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

