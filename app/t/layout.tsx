import type { Metadata } from "next";
import "../tickets/tickets.css";

export const metadata: Metadata = {
  title: "Your ticket | Neon Night",
  robots: { index: false, follow: false },
};

export default function TicketLayout({ children }: { children: React.ReactNode }) {
  return <div className="tk">{children}</div>;
}
