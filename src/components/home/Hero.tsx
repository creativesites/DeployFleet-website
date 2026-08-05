"use client";

import Link from "next/link";
import { useEffect, useRef, type RefObject } from "react";
import { whatsappHref } from "@/lib/nav";

const LOOP_SECONDS = 8;

function useLoopCap(ref: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      if (video.currentTime >= LOOP_SECONDS) {
        video.currentTime = 0;
      }
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [ref]);
}

export default function Hero() {
  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  useLoopCap(desktopVideoRef);
  useLoopCap(mobileVideoRef);

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--df-hero-bg)" }}
    >
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[620px] w-[900px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--df-gradient-brand-wide)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: "linear-gradient(to bottom, transparent, var(--df-hero-bg))" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pb-24 lg:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span
            className="section-eyebrow justify-center"
            style={{ color: "var(--df-cyan)" }}
          >
            Mission Control for African Trucking
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            Command your <span className="text-gradient-brand">entire fleet</span> from one screen.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            DeployFleet replaces paper trip sheets and WhatsApp chaos with one
            system that dispatches smarter, catches compliance risk before it
            costs you, and shows you exactly which trucks and routes make
            money.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/demo" className="btn-primary w-full sm:w-auto">
              Book a Demo
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-df-md border border-white/20 bg-white/5 px-7 py-[0.9rem] text-center font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10 sm:w-auto"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>

        {/* Mobile: portrait hero video (below sm) */}
        <div className="relative mx-auto mt-16 max-w-xs sm:hidden">
          <div
            className="pointer-events-none absolute -inset-4 rounded-df-xl opacity-40 blur-2xl"
            style={{ background: "var(--df-gradient-brand)" }}
            aria-hidden="true"
          />
          <div
            className="relative overflow-hidden rounded-df-xl ring-1 ring-white/10"
            style={{
              aspectRatio: "720 / 1280",
              boxShadow: "0 40px 100px -20px rgba(0,0,0,0.6)",
              background: "var(--df-hero-bg)",
            }}
          >
            <video
              ref={mobileVideoRef}
              className="h-full w-full object-cover"
              src="/brand/hero-video-mobile.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            >
              <track kind="captions" />
            </video>
          </div>
        </div>

        {/* Tablet/desktop: landscape hero video (sm and up) */}
        <div className="relative mx-auto mt-16 hidden max-w-6xl sm:block">
          <div
            className="pointer-events-none absolute -inset-6 rounded-df-xl opacity-40 blur-2xl"
            style={{ background: "var(--df-gradient-brand)" }}
            aria-hidden="true"
          />
          <div
            className="relative overflow-hidden rounded-df-xl ring-1 ring-white/10"
            style={{ aspectRatio: "1280 / 720", boxShadow: "0 40px 100px -20px rgba(0,0,0,0.6)" }}
          >
            <video
              ref={desktopVideoRef}
              className="h-full w-full object-cover"
              src="/brand/hero-video.mp4"
              poster="/brand/hero-promo.png"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            >
              <track kind="captions" />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
