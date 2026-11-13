import type { Metadata } from "next";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = {
  title: "Reports & Moderation",
  description:
    "Community moderation reports, triage queues, destination growth telemetry, category distribution, verification ratios, and sample exports.",
};

export default function AdminReportsPage() {
  return <ReportsClient />;
}
