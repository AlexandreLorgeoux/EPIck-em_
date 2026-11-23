import type { Metadata } from "next";
import { Archivo, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-provider";

// The two fonts of the charter, served by the site itself (next/font):
// Archivo with its width axis for the 125 % titles, Atkinson Hyperlegible
// for text
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Oracup", template: "%s · Oracup" },
  description: "Tournois et pronostics en direct",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${archivo.variable} ${atkinson.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
