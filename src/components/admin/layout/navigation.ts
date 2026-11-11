export type AdminNavIconKey =
  | "overview"
  | "destinations"
  | "categories"
  | "verification"
  | "users"
  | "reviews"
  | "reports"
  | "settings"
  | "designSystem";

export interface AdminNavItem {
  id: string;
  label: string;
  iconKey: AdminNavIconKey;
  href?: string;
  badgeText?: string;
  isPlaceholder?: boolean;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "management",
    label: "Directory & Curation",
    items: [
      {
        id: "overview",
        label: "Overview",
        iconKey: "overview",
        badgeText: "Planned",
        isPlaceholder: true,
      },
      {
        id: "destinations",
        label: "Destinations",
        iconKey: "destinations",
        badgeText: "Planned",
        isPlaceholder: true,
      },
      {
        id: "categories",
        label: "Categories",
        iconKey: "categories",
        badgeText: "Planned",
        isPlaceholder: true,
      },
      {
        id: "verification",
        label: "Destination Verification",
        iconKey: "verification",
        badgeText: "Planned",
        isPlaceholder: true,
      },
    ],
  },
  {
    id: "operations",
    label: "Community & Platform",
    items: [
      {
        id: "users",
        label: "Users",
        iconKey: "users",
        badgeText: "Planned",
        isPlaceholder: true,
      },
      {
        id: "reviews",
        label: "Reviews",
        iconKey: "reviews",
        badgeText: "Planned",
        isPlaceholder: true,
      },
      {
        id: "reports",
        label: "Reports",
        iconKey: "reports",
        badgeText: "Planned",
        isPlaceholder: true,
      },
      {
        id: "settings",
        label: "Settings",
        iconKey: "settings",
        badgeText: "Planned",
        isPlaceholder: true,
      },
    ],
  },
  {
    id: "foundation",
    label: "UI Foundation",
    items: [
      {
        id: "design-system",
        label: "Design System",
        iconKey: "designSystem",
        href: "/admin/design-system",
        badgeText: "Active",
        isPlaceholder: false,
      },
    ],
  },
];
