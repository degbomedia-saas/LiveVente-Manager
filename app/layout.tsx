import type { Metadata, Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile, type ThemePalette } from "@/lib/supabase/ensure-profile";
import { BrandConfigProvider } from "@/lib/config/brand";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#242424",
};

async function getActiveBranding(): Promise<{
  storeName: string;
  logoUrl: string | null;
  themePalette: ThemePalette;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        storeName: "Kaba Kaba",
        logoUrl: null,
        themePalette: "emerald",
      };
    }

    const profile = await getOrCreateProfile(supabase, user);
    const storeName = profile.companies?.name?.trim() || "Kaba Kaba";
    const logoUrl = profile.companies?.logo_url ?? null;
    const rawPalette = profile.companies?.theme_palette;
    const themePalette: ThemePalette =
      rawPalette === "emerald" ||
      rawPalette === "sky" ||
      rawPalette === "coral" ||
      rawPalette === "violet" ||
      rawPalette === "indigo" ||
      rawPalette === "terracotta"
        ? rawPalette
        : "emerald";

    return { storeName, logoUrl, themePalette };
  } catch {
    return {
      storeName: "Kaba Kaba",
      logoUrl: null,
      themePalette: "emerald",
    };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { storeName } = await getActiveBranding();
  return {
    title: `${storeName} — Commandes & Livraisons TikTok, WhatsApp, Instagram`,
    description: `Suivi de colis, étiquettes QR et caisse T-Money / Flooz / Espèces — ${storeName}`,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/kaba-icon.svg",
      apple: "/kaba-icon.svg",
    },
    appleWebApp: {
      capable: true,
      title: "Kaba Kaba",
      statusBarStyle: "black-translucent",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { themePalette, logoUrl } = await getActiveBranding();

  return (
    <html
      lang="fr"
      data-theme={themePalette}
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-[#0F172A]">
        <BrandConfigProvider initialConfig={{ name: "Kaba Kaba", logoUrl }}>
          {children}
        </BrandConfigProvider>
      </body>
    </html>
  );
}
