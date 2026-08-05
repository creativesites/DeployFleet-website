import Link from "next/link";
import Image from "next/image";
import { footerNav } from "@/lib/nav";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <Image
              src="/brand/logo-lockup-light.png"
              alt="DeployFleet — Mission Control for African Trucking"
              width={198}
              height={84}
              className="h-9 w-auto"
            />
            <p className="mt-4 max-w-xs text-sm text-muted">
              Mission control for African trucking. Dispatch, compliance, and
              profitability in one system built for how logistics companies
              actually run.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-navy">Product</p>
            <ul className="mt-4 space-y-3">
              {footerNav.product.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-muted hover:text-teal">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-navy">Company</p>
            <ul className="mt-4 space-y-3">
              {footerNav.company.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-muted hover:text-teal">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-navy">Get started</p>
            <ul className="mt-4 space-y-3">
              {footerNav.get.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-muted hover:text-teal">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} DeployFleet. All rights reserved.
          </p>
          <p className="text-xs text-muted">
            From the team behind{" "}
            <span className="font-medium text-teal">DeployGuard</span>.
          </p>
        </div>
      </div>
    </footer>
  );
}
