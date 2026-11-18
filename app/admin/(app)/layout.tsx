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
            <small>Ticket admin</small>
          </span>
        </div>
        <Nav />
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
