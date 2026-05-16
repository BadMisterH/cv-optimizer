import Image from "next/image";
import Link from "next/link";
import logo from "@/public/CV-optimize-logo.png";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  className?: string;
};

const HEIGHT = { sm: 36, md: 52, lg: 72 } as const;
const HEIGHT_CLASS = {
  sm: "h-9",
  md: "h-11 sm:h-[52px]",
  lg: "h-14 sm:h-[72px]",
} as const;

export function Logo({ size = "md", href = "/", className = "" }: LogoProps) {
  const img = (
    <Image
      src={logo}
      alt="CV Optimizer"
      priority
      height={HEIGHT[size]}
      sizes="(max-width: 640px) 160px, 220px"
      className={`${HEIGHT_CLASS[size]} w-auto select-none`}
    />
  );

  if (!href) {
    return <span className={`inline-flex shrink-0 items-center ${className}`}>{img}</span>;
  }

  return (
    <Link
      href={href}
      aria-label="CV Optimizer — accueil"
      className={`inline-flex shrink-0 items-center transition hover:opacity-80 ${className}`}
    >
      {img}
    </Link>
  );
}
