import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/layout/admin-shell";

export const metadata: Metadata = {
  title: {
    default: "Admin Console",
    template: "%s | Admin — My Travelroad",
  },
  description:
    "My Travelroad administration UI foundation for Malappuram tourism curation.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}
