import type { Metadata } from "next";
import "./globals.css";
import "./accessibility.css";
import { motionPreferenceBootstrap } from "./motion-preference.mjs";

export const metadata: Metadata = {
  metadataBase: new URL("https://generations.jarrettwroten.com"),
  title: "Generations Kitchen | Hawai‘i Kine Grindz in Las Vegas",
  description:
    "Hawaiian food cooked from the heart at Generations Kitchen in Las Vegas.",
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
  icons: {
    icon: "/media/generations-kitchen-icon.png",
    shortcut: "/media/generations-kitchen-icon.png",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Generations Kitchen",
    title: "The Ninth Island Eats Here | Generations Kitchen",
    description:
      "Hawaiian food cooked from the heart at Generations Kitchen in Las Vegas.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Generations Kitchen Hurricane Chicken — The Ninth Island Eats Here",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Ninth Island Eats Here | Generations Kitchen",
    description:
      "Hawaiian food cooked from the heart at Generations Kitchen in Las Vegas.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionPreferenceBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
