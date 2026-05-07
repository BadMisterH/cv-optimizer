"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const services = [
  { href: "/", label: "CV" },
  { href: "/lettre", label: "Lettre" },
];

export function ServiceNav() {
  const pathname = usePathname();
  return (
    <nav className="inline-flex items-center gap-1 rounded-full border border-rule bg-card p-1">
      {services.map((s) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition ${
              active
                ? "bg-ink text-paper"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
