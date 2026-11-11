/**
 * DEVELOPMENT-ONLY ADMIN SAMPLE DATA
 *
 * Strictly used to render structural UI previews on /admin/design-system for Task 03.
 * Represents sample placeholders only — zero real analytics, database records, or auth sessions.
 */

export type AdminStatus =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export type VerificationStatus =
  | "verified"
  | "in_review"
  | "needs_update"
  | "unverified"
  | "flagged";

export interface AdminSampleUser {
  name: string;
  email: string;
  role: string;
  initials: string;
  status: "online" | "offline" | "busy";
}

export interface AdminSampleNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
  tone: "primary" | "secondary" | "accent" | "destructive";
}

export interface AdminSampleStat {
  id: string;
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  periodLabel: string;
  iconKey: "destinations" | "pending" | "verified" | "users";
  tone: "primary" | "secondary" | "accent" | "muted";
}

export interface AdminSampleDistribution {
  id: string;
  label: string;
  countLabel: string;
  percentage: number;
  tone: "primary" | "secondary" | "accent";
}

export interface AdminSampleActivityItem {
  id: string;
  title: string;
  subtitle: string;
  actor: string;
  timestamp: string;
  status: AdminStatus;
}

export interface AdminSampleDestinationRow {
  id: string;
  name: string;
  region: string;
  category: string;
  status: AdminStatus;
  verificationStatus: VerificationStatus;
  submittedBy: string;
  updatedAt: string;
}

export const ADMIN_SAMPLE_USER: AdminSampleUser = {
  name: "Amina Rahman (Preview)",
  email: "curator-preview@mytravelroad.example",
  role: "District Curator (Sample)",
  initials: "AR",
  status: "online",
};

export const ADMIN_SAMPLE_NOTIFICATIONS: AdminSampleNotification[] = [
  {
    id: "notif-1",
    title: "Verification Queue Notice (Sample)",
    description: "3 sample Malappuram entries await structural UI review.",
    timestamp: "Sample • 10m ago",
    unread: true,
    tone: "accent",
  },
  {
    id: "notif-2",
    title: "Category Tag Alignment (Sample)",
    description: "Beaches & Estuaries sample labels updated for Task 03 demo.",
    timestamp: "Sample • 1h ago",
    unread: true,
    tone: "secondary",
  },
  {
    id: "notif-3",
    title: "Design Foundation Active",
    description: "Task 03 preview route is running with development sample records.",
    timestamp: "Sample • Today",
    unread: false,
    tone: "primary",
  },
];

export const ADMIN_SAMPLE_STATS: AdminSampleStat[] = [
  {
    id: "stat-listings",
    title: "Sample Destinations",
    value: "24",
    delta: "+4",
    trend: "up",
    periodLabel: "sample batch total",
    iconKey: "destinations",
    tone: "primary",
  },
  {
    id: "stat-pending",
    title: "Pending Verification",
    value: "6",
    delta: "-2",
    trend: "down",
    periodLabel: "vs prior preview",
    iconKey: "pending",
    tone: "accent",
  },
  {
    id: "stat-verified",
    title: "Verified Sample Spots",
    value: "18",
    delta: "+12%",
    trend: "up",
    periodLabel: "coverage ratio",
    iconKey: "verified",
    tone: "secondary",
  },
  {
    id: "stat-contributors",
    title: "Curator Drafts",
    value: "9",
    delta: "0%",
    trend: "neutral",
    periodLabel: "unchanged preview",
    iconKey: "users",
    tone: "muted",
  },
];

export const ADMIN_SAMPLE_DISTRIBUTION: AdminSampleDistribution[] = [
  {
    id: "dist-forest",
    label: "Nature & Forests",
    countLabel: "8 sample items",
    percentage: 34,
    tone: "primary",
  },
  {
    id: "dist-coast",
    label: "Beaches & Estuaries",
    countLabel: "6 sample items",
    percentage: 26,
    tone: "secondary",
  },
  {
    id: "dist-hills",
    label: "Waterfalls & Hills",
    countLabel: "5 sample items",
    percentage: 22,
    tone: "primary",
  },
  {
    id: "dist-heritage",
    label: "Heritage & Culture",
    countLabel: "4 sample items",
    percentage: 18,
    tone: "accent",
  },
];

export const ADMIN_SAMPLE_ACTIVITY: AdminSampleActivityItem[] = [
  {
    id: "act-1",
    title: "Nilambur Teak Precinct (Sample Row)",
    subtitle: "Destination metadata checklist preview",
    actor: "Curator A (Sample)",
    timestamp: "Today, 10:15",
    status: "approved",
  },
  {
    id: "act-2",
    title: "Ponnani Harbour Promenade (Sample Row)",
    subtitle: "Verification state inspection entry",
    actor: "Reviewer B (Sample)",
    timestamp: "Today, 09:40",
    status: "pending",
  },
  {
    id: "act-3",
    title: "Kodikuthimala Trail Draft (Sample Row)",
    subtitle: "Seasonal notice update preview",
    actor: "Curator A (Sample)",
    timestamp: "Yesterday",
    status: "active",
  },
  {
    id: "act-4",
    title: "Duplicate Sample Entry Flag",
    subtitle: "Held during taxonomy cleanup demo",
    actor: "Moderation (Sample)",
    timestamp: "2 days ago",
    status: "rejected",
  },
];

export const ADMIN_SAMPLE_ROWS: AdminSampleDestinationRow[] = [
  {
    id: "dest-01",
    name: "Nilambur Teak Reserve (Sample)",
    region: "Nilambur, Eastern Malappuram",
    category: "Nature & Forests",
    status: "active",
    verificationStatus: "verified",
    submittedBy: "Amina R.",
    updatedAt: "Sample • Nov 10",
  },
  {
    id: "dest-02",
    name: "Kadalundi Estuary Viewpoint (Sample)",
    region: "Kadalundi, Coastal Zone",
    category: "Beaches & Estuaries",
    status: "approved",
    verificationStatus: "verified",
    submittedBy: "Karthik M.",
    updatedAt: "Sample • Nov 09",
  },
  {
    id: "dest-03",
    name: "Adyanpara Cascades (Sample)",
    region: "Kurumbalangode, Nilambur",
    category: "Waterfalls & Hills",
    status: "pending",
    verificationStatus: "in_review",
    submittedBy: "Fathima N.",
    updatedAt: "Sample • Nov 09",
  },
  {
    id: "dest-04",
    name: "Kottakkal Heritage Precinct (Sample)",
    region: "Kottakkal, Central Corridor",
    category: "Heritage & Culture",
    status: "active",
    verificationStatus: "verified",
    submittedBy: "Haris P.",
    updatedAt: "Sample • Nov 08",
  },
  {
    id: "dest-05",
    name: "Kodikuthimala Ridge Trail (Sample)",
    region: "Perinthalmanna Uplands",
    category: "Waterfalls & Hills",
    status: "inactive",
    verificationStatus: "needs_update",
    submittedBy: "Meera S.",
    updatedAt: "Sample • Nov 07",
  },
  {
    id: "dest-06",
    name: "Ponnani Lighthouse Coast (Sample)",
    region: "Ponnani Estuary, West",
    category: "Beaches & Estuaries",
    status: "pending",
    verificationStatus: "unverified",
    submittedBy: "Jaseem K.",
    updatedAt: "Sample • Nov 06",
  },
  {
    id: "dest-07",
    name: "Unverified Roadside Marker (Sample)",
    region: "Tirur Taluk",
    category: "Heritage & Culture",
    status: "rejected",
    verificationStatus: "flagged",
    submittedBy: "Test Draft",
    updatedAt: "Sample • Nov 05",
  },
  {
    id: "dest-08",
    name: "Seasonal Eco Trail Listing (Sample)",
    region: "Karuvarakundu Hills",
    category: "Nature & Forests",
    status: "suspended",
    verificationStatus: "needs_update",
    submittedBy: "Review Queue",
    updatedAt: "Sample • Nov 04",
  },
];
