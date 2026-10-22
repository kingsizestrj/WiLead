import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Voltec Hotspot" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
