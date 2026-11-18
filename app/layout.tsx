import type { Metadata, Viewport } from "next";
import { Anton, Geist, Unbounded } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// Tall, heavy poster lettering for the title and lineup.
const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
// Wide caps for labels, matching "COMING SOON!!" on the poster.
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"] });

const title = "Neon Night | Brick City Rave";
const description =
  "Brick City goes green. Neon Night, a Bells University Students' Association rave on Saturday 12 December 2026 from 5pm at Professor Jeremiah O. Ojediran. Five artists to be announced.";

export const metadata: Metadata = {
  // Link previews need absolute image addresses; this is the live site they resolve against.
  metadataBase: new URL("https://brickcityevent.site"),
  title,
  description,
  // The preview picture and icons come from the image files next to this one
  // (opengraph-image, twitter-image, icon, apple-icon, favicon).
  openGraph: { title, description, url: "/", siteName: "Neon Night", type: "website", locale: "en_NG" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#020503",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${anton.variable} ${unbounded.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
