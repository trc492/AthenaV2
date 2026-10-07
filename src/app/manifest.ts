import { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from "@/lib/app-config";

const screenshots = [
  {
    id: "overview",
    label: "Overview with the next match assignment and scouting coverage",
  },
  { id: "scheduling", label: "Match-by-match scouting assignments" },
  { id: "pit-scouting", label: "Pit scouting robot profile" },
  { id: "match-scouting", label: "Match scouting during teleop" },
  { id: "analytics", label: "EPA analysis comparing teams" },
];

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    lang: "en",
    dir: "ltr",
    categories: ["productivity", "utilities"],
    prefer_related_applications: false,
    related_applications: [],
    display_override: ["window-controls-overlay", "standalone"],
    launch_handler: {
      client_mode: "focus-existing",
    },
    shortcuts: [
      {
        name: "Match Scouting",
        short_name: "Match Scout",
        description: "Start match scouting",
        url: "/scout/matchscout",
        icons: [{ src: "/assets/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Pit Scouting",
        short_name: "Pit Scout",
        description: "Start pit scouting",
        url: "/scout/pitscout",
        icons: [{ src: "/assets/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "View scouting dashboard",
        url: "/dashboard",
        icons: [{ src: "/assets/icon-192.png", sizes: "192x192" }],
      },
    ],
    screenshots: (["wide", "narrow"] as const).flatMap((form_factor) =>
      screenshots.map(({ id, label }) => ({
        src: `/screenshots/${id}-${form_factor}.png`,
        sizes: form_factor === "wide" ? "1920x1080" : "1080x1920",
        type: "image/png",
        form_factor,
        label,
      })),
    ),
    icons: [
      {
        src: "/assets/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/assets/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
