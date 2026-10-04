import PlatformDashboard from "./PlatformDashboard";
import { getPlatformDashboardData } from "./data";
import styles from "./platform.module.css";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const restaurants = await getPlatformDashboardData();

  return (
    <main className={styles.page}>
      <PlatformDashboard restaurants={restaurants} />
    </main>
  );
}