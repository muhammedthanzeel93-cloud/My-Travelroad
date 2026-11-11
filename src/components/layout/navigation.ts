export interface NavLinkItem {
  label: string;
  href: string;
  matchPrefix?: boolean;
}

export const PRIMARY_NAV_LINKS: NavLinkItem[] = [
  { label: "Home", href: "/", matchPrefix: false },
  { label: "Destinations", href: "/destinations", matchPrefix: true },
  { label: "Search", href: "/search", matchPrefix: true },
  { label: "Saved", href: "/saved", matchPrefix: true },
  { label: "About", href: "/about", matchPrefix: true },
];

export const ACCOUNT_NAV_LINKS: NavLinkItem[] = [
  { label: "Profile", href: "/profile", matchPrefix: true },
  { label: "Sign In", href: "/login", matchPrefix: false },
  { label: "Register", href: "/register", matchPrefix: false },
];

export const FOOTER_DISCOVERY_LINKS: NavLinkItem[] = [
  { label: "Home", href: "/" },
  { label: "All Destinations", href: "/destinations" },
  { label: "Search Malappuram", href: "/search" },
  { label: "Saved Destinations", href: "/saved" },
];

export const FOOTER_CATEGORY_LINKS: NavLinkItem[] = [
  { label: "Nature & Forests", href: "/categories/nature-forests" },
  { label: "Beaches & Estuaries", href: "/categories/beaches-estuaries" },
  { label: "Waterfalls & Hills", href: "/categories/waterfalls-hills" },
  { label: "Heritage & Culture", href: "/categories/heritage-culture" },
];

export const FOOTER_PLATFORM_LINKS: NavLinkItem[] = [
  { label: "About My Travelroad", href: "/about" },
  { label: "User Profile", href: "/profile" },
  { label: "Sign In", href: "/login" },
  { label: "Create Account", href: "/register" },
  { label: "UI Design System", href: "/design-system" },
];
