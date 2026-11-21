import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile, type ThemePalette } from "@/lib/supabase/ensure-profile";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

async function getActiveBranding(): Promise<{
  storeName: string;
  themePalette: ThemePalette;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { storeName: "kaba kaba — Plateforme de ventes & livraisons express", themePalette: "indigo" };
    }

    const profile = await getOrCreateProfile(supabase, user);
    const storeName = profile.companies?.name?.trim() || "kaba kaba — Plateforme de ventes & livraisons express";
    const rawPalette = profile.companies?.theme_palette;
    const themePalette: ThemePalette =
      rawPalette === "emerald" || rawPalette === "terracotta" ? rawPalette : "indigo";

    return { storeName, themePalette };
  } catch {
    return { storeName: "kaba kaba — Plateforme de ventes & livraisons express", themePalette: "indigo" };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { storeName } = await getActiveBranding();
  return {
    title: storeName,
    description: `Gestion des ventes et livraisons — ${storeName}`,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { themePalette } = await getActiveBranding();

  return (
    <html
      lang="fr"
      data-theme={themePalette}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
