import type { Metadata } from "next";
import { AdminDesignSystemClient } from "./admin-design-system-client";

export const metadata: Metadata = {
  title: "Admin Design System (Preview)",
  description:
    "Development-only preview of My Travelroad's admin layout shell, tokens, tables, forms, badges, and confirmation patterns.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminDesignSystemPage() {
  return <AdminDesignSystemClient />;
}
