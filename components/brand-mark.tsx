import Link from "next/link";
import { cn } from "@/src/core/utils";

export type LogoDisplay = "none" | "logo" | "logo_name";

export type BrandMarkProps = {
  name: string;
  logoUrl?: string | null;
  logoDisplay?: LogoDisplay | string | null;
  href?: string;
  className?: string;
  /** Visual size for different placements */
  size?: "sm" | "md" | "lg" | "hero";
  /** When true, render without wrapping Link */
  asSpan?: boolean;
};

function resolveDisplay(
  logoUrl: string | null | undefined,
  logoDisplay: LogoDisplay | string | null | undefined,
): { showLogo: boolean; showName: boolean } {
  const url = String(logoUrl ?? "").trim();
  const mode = (logoDisplay || "logo_name") as LogoDisplay;
  if (!url || mode === "none") {
    return { showLogo: false, showName: true };
  }
  if (mode === "logo") {
    return { showLogo: true, showName: false };
  }
  return { showLogo: true, showName: true };
}

const sizeClasses = {
  sm: {
    img: "h-7 w-auto max-w-[140px]",
    text: "text-base font-semibold tracking-tight",
    gap: "gap-2",
  },
  md: {
    img: "h-8 w-auto max-w-[160px]",
    text: "text-lg font-semibold tracking-tight",
    gap: "gap-2.5",
  },
  lg: {
    img: "h-10 w-auto max-w-[200px]",
    text: "text-xl font-semibold tracking-tight",
    gap: "gap-3",
  },
  hero: {
    img: "h-16 w-auto max-w-[280px] md:h-20 md:max-w-[360px]",
    text: "text-5xl font-semibold tracking-tight md:text-7xl",
    gap: "gap-4",
  },
} as const;

export function BrandMark({
  name,
  logoUrl,
  logoDisplay = "logo_name",
  href = "/",
  className,
  size = "md",
  asSpan = false,
}: BrandMarkProps) {
  const { showLogo, showName } = resolveDisplay(logoUrl, logoDisplay);
  const sizes = sizeClasses[size];

  const content = (
    <span className={cn("inline-flex items-center", sizes.gap, className)}>
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={String(logoUrl).trim()}
          alt={showName ? "" : name}
          className={cn(sizes.img, "object-contain")}
        />
      ) : null}
      {showName ? <span className={sizes.text}>{name}</span> : null}
    </span>
  );

  if (asSpan) return content;

  return (
    <Link href={href} className="inline-flex items-center hover:opacity-90">
      {content}
    </Link>
  );
}
