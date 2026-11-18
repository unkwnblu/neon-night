import type { Metadata } from "next";
import "./tickets.css";

export const metadata: Metadata = {
  title: "Get tickets | Neon Night",
  description: "Buy tickets for Neon Night, the Brick City Rave.",
};

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <div className="tk">{children}</div>;
}
