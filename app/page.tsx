import Experience from "@/components/Experience";
import { getPublicTiers } from "@/lib/tickets";

export default async function Home() {
  // Cached; refreshed as soon as an admin saves a tier.
  const tiers = await getPublicTiers();
  return <Experience tiers={tiers} />;
}
