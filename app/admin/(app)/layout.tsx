import { Suspense } from "react";
import { getRole } from "@/lib/admin-auth";
import { logout } from "../actions";
import { IconExternal, IconLogout } from "../ui/Icons";
import { Nav } from "../ui/Nav";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ad-shell">
      <aside className="ad-side">
        <div className="ad-brand">
          <span className="ad-brand-mark" aria-hidden>
            NN
          </span>
          <span>
            <b>Neon Night</b>
            <Suspense fallback={<small>Ticket admin</small>}>
              <RoleLabel />
            </Suspense>
          </span>
        </div>
        {/* The session is read per request, so the role-aware nav streams in; plain nav meanwhile. */}
        <Suspense fallback={<Nav />}>
          <RoleNav />
        </Suspense>
        <div className="ad-side-foot">
          <a href="/" target="_blank" rel="noreferrer" className="ad-nav-item">
            <IconExternal />
            <span>View site</span>
          </a>
          <form action={logout}>
            <button className="ad-nav-item">
              <IconLogout />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>
      <main className="ad-main">{children}</main>
    </div>
  );
}

async function RoleNav() {
  return <Nav owner={(await getRole()) === "owner"} />;
}

async function RoleLabel() {
  return <small>{(await getRole()) === "owner" ? "Owner" : "Ticket admin"}</small>;
}
