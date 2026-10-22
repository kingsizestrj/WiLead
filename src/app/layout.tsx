import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "WiLead" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#07060d" };

// Applies the saved panel theme before painting (the captive portal always uses its own colors).
const THEME_SCRIPT = `try{if(!location.pathname.startsWith('/p')&&localStorage.getItem('wilead_theme')==='light')document.documentElement.classList.add('light')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
