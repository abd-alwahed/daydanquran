import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "دَيْدَن",
    short_name: "دَيْدَن",
    description: "صفحة من القرآن كل يوم",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F3EC",
    theme_color: "#2E6475",
    icons: [
      { src: "/daydan-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/daydan-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
