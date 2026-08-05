import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ),
  title: {
    default: "DeployFleet — Mission Control for African Trucking",
    template: "%s | DeployFleet",
  },
  description:
    "DeployFleet is the operations command center built for African trucking companies — dispatch, compliance, maintenance, billing, and an AI copilot that always asks before it acts.",
  openGraph: {
    title: "DeployFleet — Mission Control for African Trucking",
    description:
      "Dispatch, compliance, maintenance, and billing in one command center — with an AI copilot that always asks before it acts.",
    images: [{ url: "/brand/hero-promo.png", width: 1376, height: 768 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DeployFleet — Mission Control for African Trucking",
    images: ["/brand/hero-promo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas text-body">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppFloatingButton />
      </body>
    </html>
  );
}
