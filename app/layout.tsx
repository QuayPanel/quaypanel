import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { ThemeCss } from "@/components/theme-css";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuayPanel",
  description:
    "Open-source, self-hosted billing panel for modern hosting providers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeCss />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
