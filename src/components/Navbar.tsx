"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { primaryNav, productLinks, whatsappHref } from "@/lib/nav";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-canvas/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <Image
            src="/brand/logo-lockup-light.png"
            alt="DeployFleet — Mission Control for African Trucking"
            width={198}
            height={84}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {primaryNav.map((item) =>
            item.label === "Product" ? (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setProductOpen(true)}
                onMouseLeave={() => setProductOpen(false)}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-1 rounded-df-md px-3 py-2 text-sm font-medium text-navy hover:text-teal"
                >
                  Product
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                {productOpen && (
                  <div className="absolute left-1/2 top-full w-[560px] -translate-x-1/2 pt-3">
                    <div className="card-surface grid grid-cols-2 gap-1 p-3">
                      {productLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="rounded-df-md p-3 hover:bg-canvas"
                        >
                          <p className="text-sm font-semibold text-navy">{link.label}</p>
                          <p className="mt-1 text-xs text-muted">{link.description}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-df-md px-3 py-2 text-sm font-medium text-navy hover:text-teal"
              >
                {item.label}
              </Link>
            )
          )}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
            Chat on WhatsApp
          </a>
          <Link href="/demo" className="btn-primary text-sm">
            Book a Demo
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-df-md border border-border p-2 text-navy lg:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-border bg-card px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-df-md px-3 py-3 text-base font-medium text-navy hover:bg-canvas"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">
              Chat on WhatsApp
            </a>
            <Link href="/demo" className="btn-primary w-full" onClick={() => setMobileOpen(false)}>
              Book a Demo
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
