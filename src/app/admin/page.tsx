import type { Metadata } from "next";
import { AdminOverviewClient } from "./admin-overview-client";

export const metadata: Metadata = {
  title: "Admin Overview",
  description:
    "Overview dashboard for My Travelroad Malappuram destination curation, verification queue, and sample platform metrics.",
};

export default function AdminOverviewPage() {
  return <AdminOverviewClient />;
}
