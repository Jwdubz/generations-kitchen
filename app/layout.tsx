import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <head>
        <script type="text/javascript" dangerouslySetInnerHTML={{ __html: `(function(w,d){w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};var done=0,ev=["scroll","pointerdown","keydown"],o={passive:true,capture:true};function go(){if(done)return;done=1;ev.forEach(function(e){w.removeEventListener(e,go,o)});var t=d.createElement("script");t.async=1;t.src="https://www.clarity.ms/tag/yvve5xueah";var y=d.getElementsByTagName("script")[0];y.parentNode.insertBefore(t,y)}ev.forEach(function(e){w.addEventListener(e,go,o)});function idle(){w.requestIdleCallback?w.requestIdleCallback(go,{timeout:2500}):setTimeout(go,2500)}d.readyState==="complete"?idle():w.addEventListener("load",idle,{once:true})})(window,document);clarity("set","site","generations");` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
