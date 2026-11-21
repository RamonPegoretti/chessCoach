import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess Coach · your chess story",
  description:
    "Free game reviews, your chess legend, your costliest mistake and a personal course built from all your Lichess and Chess.com games.",
};

export const viewport: Viewport = {
  themeColor: "#14110f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-ink text-cream">{children}</body>
    </html>
  );
}
