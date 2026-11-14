import type { Metadata, Viewport } from "next";
import { Anton, Geist, Unbounded } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// Tall, heavy poster lettering for the title and genre names.
const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
// Wide caps for labels, matching "COMING SOON!!" on the poster.
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Neon Night | Brick City Rave",
  description:
    "Brick City goes green. Neon Night, a Bells University Students' Association rave: hip hop, rave, R&B, afrobeat and more. Coming soon.",
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
