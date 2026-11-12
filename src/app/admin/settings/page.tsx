import type { Metadata } from "next";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = {
  title: "Admin Settings",
  description:
    "Configure admin profile, workspace details, notification toggles, display preferences, and security UI placeholders.",
};

export default function AdminSettingsPage() {
  return <SettingsClient />;
}
