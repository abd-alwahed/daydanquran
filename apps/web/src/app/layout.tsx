import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@daydan/core";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { display, reading, ui } from "./fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "دَيْدَن · اجعل القرآن دَيْدَنك", template: "%s · دَيْدَن" },
  description: "صفحة من القرآن كل يوم، مع التفسير الميسر والتلاوة.",
};

export const viewport: Viewport = { themeColor: "#2E6475" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${display.variable} ${reading.variable} ${ui.variable}`}>
      <body>
        <SiteHeader />
        <main className="container">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
