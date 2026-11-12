import type { Metadata } from "next";
import { CategoriesClient } from "./categories-client";

export const metadata: Metadata = {
  title: "Category Management",
  description:
    "Browse tourism category groups, destination counts, statuses, and Add/Edit category UI placeholders across Malappuram.",
};

export default function AdminCategoriesPage() {
  return <CategoriesClient />;
}
