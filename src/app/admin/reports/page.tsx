import type { Metadata } from "next";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = {
  title: "Reports & Analytics",
  description:
    "Sample reports overview, destination growth bars, category distribution, verification breakdown, date range selector, and export placeholder.",
};

export default function AdminReportsPage() {
  return <ReportsClient />;
}
