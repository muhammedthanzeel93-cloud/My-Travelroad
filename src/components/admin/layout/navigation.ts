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
        href: "/admin",
        isPlaceholder: false,
      },
      {
        id: "destinations",
        label: "Destinations",
        iconKey: "destinations",
        href: "/admin/destinations",
        isPlaceholder: false,
      },
      {
        id: "categories",
        label: "Categories",
        iconKey: "categories",
        href: "/admin/categories",
        isPlaceholder: false,
      },
      {
        id: "verification",
        label: "Destination Verification",
        iconKey: "verification",
        href: "/admin/destination-verification",
        isPlaceholder: false,
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
        href: "/admin/users",
        isPlaceholder: false,
      },
      {
        id: "reviews",
        label: "Reviews",
        iconKey: "reviews",
        href: "/admin/reviews",
        isPlaceholder: false,
      },
      {
        id: "reports",
        label: "Reports",
        iconKey: "reports",
        href: "/admin/reports",
        isPlaceholder: false,
      },
      {
        id: "settings",
        label: "Settings",
        iconKey: "settings",
        href: "/admin/settings",
        isPlaceholder: false,
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
        badgeText: "Preview",
        isPlaceholder: false,
      },
    ],
  },
];

/**
 * Checks whether an admin navigation item matches the current pathname.
 * Uses strict matching for `/admin` so Overview is not highlighted on child routes.
 */
export function isAdminNavItemActive(
  item: AdminNavItem,
  pathname: string
): boolean {
  if (!item.href) return false;
  if (item.href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Finds the active navigation item matching a given admin pathname. */
export function findActiveAdminNavItem(
  pathname: string
): AdminNavItem | undefined {
  for (const group of ADMIN_NAV_GROUPS) {
    const match = group.items.find((item) => isAdminNavItemActive(item, pathname));
    if (match) return match;
  }
  return undefined;
}
