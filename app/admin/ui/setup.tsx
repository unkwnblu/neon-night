import { isAdminConfigured, requireAdmin } from "@/lib/admin-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Card } from "./PageHeader";

/** Signs the visitor in (or redirects), then returns a notice if something isn't configured yet. */
export async function checkSetup(): Promise<React.ReactNode | null> {
  if (!isAdminConfigured()) return <Notice missing="ADMIN_PASSWORD and ADMIN_SESSION_SECRET" />;
  await requireAdmin();
  if (!isSupabaseConfigured()) return <Notice missing="NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" />;
  return null;
}

function Notice({ missing }: { missing: string }) {
  return (
    <Card title="Almost there">
      <p className="ad-muted">
        Set <code>{missing}</code> in <code>.env.local</code> (and in your hosting provider&apos;s environment
        settings), then restart the server. See <code>.env.example</code> for what each one is.
      </p>
    </Card>
  );
}
