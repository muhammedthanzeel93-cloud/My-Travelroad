import type { Metadata } from "next";
import { DestinationsClient } from "./destinations-client";

export const metadata: Metadata = {
  title: "Destination Management",
  description:
    "Manage Malappuram tourism destinations, search, category and status filters, pagination, and sample action menus.",
};

export default function AdminDestinationsPage() {
  return <DestinationsClient />;
}
