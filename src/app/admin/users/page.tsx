import type { Metadata } from "next";
import { UsersClient } from "./users-client";

export const metadata: Metadata = {
  title: "User Management",
  description:
    "View sample user accounts, role filters, status filters, profile summaries, and non-functional moderation placeholders.",
};

export default function AdminUsersPage() {
  return <UsersClient />;
}
