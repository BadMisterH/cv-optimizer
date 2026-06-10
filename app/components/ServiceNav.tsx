"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

const services = [
  { href: "/optimiser", label: "CV" },
  { href: "/lettre", label: "Lettre" },
  { href: "/historique", label: "Historique" },
];

export function ServiceNav() {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center gap-2 sm:gap-3">
      <nav
        aria-label="Services"
        className="inline-flex h-10 items-center gap-1 rounded-full border border-rule bg-card p-1"
      >
        {services.map((s) => {
          const active = pathname === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-8 items-center rounded-full px-4 font-mono text-xs uppercase tracking-[0.18em] transition ${
                active
                  ? "bg-ink text-paper"
                  : "text-ink-muted hover:bg-paper-deep hover:text-ink"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
      <ThemeToggle />
      <UserMenu />
    </div>
  );
}
