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

/* ============================================================================
 * TASK 04 — ADMIN PAGE STRUCTURE DEVELOPMENT SAMPLE DATASETS
 * Clearly separated sample datasets for routes under /admin/*.
 * All entries represent non-persistent structural UI previews only.
 * ========================================================================== */

export interface AdminSampleCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  destinationCount: number;
  status: AdminStatus;
  updatedAt: string;
}

export interface AdminSampleVerificationItem {
  id: string;
  destinationName: string;
  region: string;
  category: string;
  verificationStatus: VerificationStatus;
  reviewerName: string;
  reviewerRole: string;
  submittedAt: string;
  submittedBy: string;
  reviewNote: string;
}

export interface AdminSampleUserAccount {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "Explorer" | "Contributor" | "District Curator" | "Moderator";
  region: string;
  status: AdminStatus;
  savedCount: number;
  submissionsCount: number;
  registeredAt: string;
}

export interface AdminSampleReview {
  id: string;
  destinationName: string;
  region: string;
  reviewerName: string;
  reviewerInitials: string;
  rating: 1 | 2 | 3 | 4 | 5;
  excerpt: string;
  status: AdminStatus;
  submittedAt: string;
}

export interface AdminReportMetricPoint {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number;
  valueLabel?: string;
}

export interface AdminSampleReportPeriod {
  id: "7d" | "30d" | "90d";
  label: string;
  summaryStats: AdminSampleStat[];
  growthSeries: AdminReportMetricPoint[];
  categoryDistribution: AdminSampleDistribution[];
  verificationBreakdown: AdminSampleDistribution[];
  userActivityFeed: AdminSampleActivityItem[];
}

export interface AdminSampleSettingsState {
  profileName: string;
  profileEmail: string;
  profileBio: string;
  workspaceName: string;
  launchRegion: string;
  supportEmail: string;
  moderationNote: string;
  notifyNewSubmissions: boolean;
  notifyVerificationQueue: boolean;
  notifyFlaggedReviews: boolean;
  weeklyReportDigest: boolean;
  defaultPageSize: string;
  tableDensity: "comfortable" | "compact";
  showSampleBadges: boolean;
}

export const ADMIN_OVERVIEW_STATS: AdminSampleStat[] = [
  {
    id: "ov-total-dest",
    title: "Total Destinations",
    value: "42",
    delta: "+6",
    trend: "up",
    periodLabel: "sample directory total",
    iconKey: "destinations",
    tone: "primary",
  },
  {
    id: "ov-pending-ver",
    title: "Pending Verifications",
    value: "8",
    delta: "-3",
    trend: "down",
    periodLabel: "sample queue count",
    iconKey: "pending",
    tone: "accent",
  },
  {
    id: "ov-verified-dest",
    title: "Verified Destinations",
    value: "31",
    delta: "+14%",
    trend: "up",
    periodLabel: "verified ratio (sample)",
    iconKey: "verified",
    tone: "secondary",
  },
  {
    id: "ov-registered-users",
    title: "Total Registered Users",
    value: "184",
    delta: "+19",
    trend: "up",
    periodLabel: "sample accounts",
    iconKey: "users",
    tone: "muted",
  },
];

export const ADMIN_RECENT_SUBMISSIONS: AdminSampleDestinationRow[] = [
  {
    id: "sub-01",
    name: "Nilambur Teak Museum & Reserve (Sample)",
    region: "Nilambur, Eastern Malappuram",
    category: "Nature & Forests",
    status: "active",
    verificationStatus: "verified",
    submittedBy: "Amina R.",
    updatedAt: "Sample • Today",
  },
  {
    id: "sub-02",
    name: "Kadalundi Bird Sanctuary Coast (Sample)",
    region: "Vallikkunnu, Coastal Zone",
    category: "Beaches & Estuaries",
    status: "pending",
    verificationStatus: "in_review",
    submittedBy: "Karthik M.",
    updatedAt: "Sample • Today",
  },
  {
    id: "sub-03",
    name: "Adyanpara Waterfalls Trail (Sample)",
    region: "Kurumbalangode, Nilambur",
    category: "Waterfalls & Hills",
    status: "approved",
    verificationStatus: "verified",
    submittedBy: "Fathima N.",
    updatedAt: "Sample • Yesterday",
  },
  {
    id: "sub-04",
    name: "Thirunavaya Navamukunda Coast (Sample)",
    region: "Thirunavaya, Bharathapuzha Basin",
    category: "Heritage & Culture",
    status: "pending",
    verificationStatus: "needs_update",
    submittedBy: "Haris P.",
    updatedAt: "Sample • Nov 10",
  },
];

export const ADMIN_DESTINATION_RECORDS: AdminSampleDestinationRow[] = [
  ...ADMIN_SAMPLE_ROWS,
  {
    id: "dest-09",
    name: "Nedumkayam Rainforest Station (Sample)",
    region: "Karulai Range, Nilambur",
    category: "Nature & Forests",
    status: "active",
    verificationStatus: "verified",
    submittedBy: "Amina R.",
    updatedAt: "Sample • Nov 03",
  },
  {
    id: "dest-10",
    name: "Padinharekara Sunset Point (Sample)",
    region: "Tirur Coastal Belt",
    category: "Beaches & Estuaries",
    status: "approved",
    verificationStatus: "verified",
    submittedBy: "Nikhil V.",
    updatedAt: "Sample • Nov 02",
  },
  {
    id: "dest-11",
    name: "Biyyam Kayal Waterfront Park (Sample)",
    region: "Ponnani Backwaters",
    category: "Beaches & Estuaries",
    status: "pending",
    verificationStatus: "in_review",
    submittedBy: "Safna T.",
    updatedAt: "Sample • Nov 01",
  },
  {
    id: "dest-12",
    name: "Thunchan Parambu Literary Shrine (Sample)",
    region: "Tirur Central",
    category: "Heritage & Culture",
    status: "active",
    verificationStatus: "verified",
    submittedBy: "Haris P.",
    updatedAt: "Sample • Oct 30",
  },
];

export const ADMIN_CATEGORY_RECORDS: AdminSampleCategory[] = [
  {
    id: "cat-01",
    name: "Nature & Forests",
    slug: "nature-forests",
    description:
      "Western Ghats teak reserves, eco-trails, and wildlife buffer corridors across Eastern Malappuram.",
    destinationCount: 14,
    status: "active",
    updatedAt: "Sample • Nov 11",
  },
  {
    id: "cat-02",
    name: "Beaches & Estuaries",
    slug: "beaches-estuaries",
    description:
      "Arabian Sea shorelines, river mouths, and backwater promenades from Kadalundi to Ponnani.",
    destinationCount: 11,
    status: "active",
    updatedAt: "Sample • Nov 10",
  },
  {
    id: "cat-03",
    name: "Waterfalls & Hills",
    slug: "waterfalls-hills",
    description:
      "Highland viewpoints, seasonal cascades, and misty ridge routes near Perinthalmanna and Nilambur.",
    destinationCount: 9,
    status: "active",
    updatedAt: "Sample • Nov 09",
  },
  {
    id: "cat-04",
    name: "Heritage & Culture",
    slug: "heritage-culture",
    description:
      "Historic literary landmarks, traditional architecture, and regional cultural centers.",
    destinationCount: 8,
    status: "active",
    updatedAt: "Sample • Nov 08",
  },
  {
    id: "cat-05",
    name: "Culinary & Craft Hubs",
    slug: "culinary-craft-hubs",
    description:
      "Local Malappuram food trails and artisan markets staged as an inactive category draft.",
    destinationCount: 3,
    status: "inactive",
    updatedAt: "Sample • Nov 05",
  },
  {
    id: "cat-06",
    name: "Seasonal Monsoon Trails",
    slug: "seasonal-monsoon-trails",
    description:
      "Curated weather-dependent itineraries currently held offline pending safety sign-off.",
    destinationCount: 2,
    status: "pending",
    updatedAt: "Sample • Nov 02",
  },
];

export const ADMIN_VERIFICATION_RECORDS: AdminSampleVerificationItem[] = [
  {
    id: "ver-01",
    destinationName: "Adyanpara Cascades (Sample)",
    region: "Kurumbalangode, Nilambur",
    category: "Waterfalls & Hills",
    verificationStatus: "in_review",
    reviewerName: "Amina Rahman",
    reviewerRole: "District Curator",
    submittedAt: "Sample • Nov 11",
    submittedBy: "Fathima N.",
    reviewNote: "Cross-checking seasonal safety access & trail distance tags.",
  },
  {
    id: "ver-02",
    destinationName: "Kadalundi Estuary Viewpoint (Sample)",
    region: "Kadalundi, Coastal Zone",
    category: "Beaches & Estuaries",
    verificationStatus: "verified",
    reviewerName: "Haris Pullara",
    reviewerRole: "Verification Moderator",
    submittedAt: "Sample • Nov 10",
    submittedBy: "Karthik M.",
    reviewNote: "Coordinates, parking marker, and tide guidance verified.",
  },
  {
    id: "ver-03",
    destinationName: "Biyyam Kayal Waterfront Park (Sample)",
    region: "Ponnani Backwaters",
    category: "Beaches & Estuaries",
    verificationStatus: "in_review",
    reviewerName: "Amina Rahman",
    reviewerRole: "District Curator",
    submittedAt: "Sample • Nov 09",
    submittedBy: "Safna T.",
    reviewNote: "Pending updated photography slot verification.",
  },
  {
    id: "ver-04",
    destinationName: "Kodikuthimala Ridge Trail (Sample)",
    region: "Perinthalmanna Uplands",
    category: "Waterfalls & Hills",
    verificationStatus: "needs_update",
    reviewerName: "Nikhil Varma",
    reviewerRole: "Field Reviewer",
    submittedAt: "Sample • Nov 08",
    submittedBy: "Meera S.",
    reviewNote: "Requested clearer morning opening hours from submitter.",
  },
  {
    id: "ver-05",
    destinationName: "Nilambur Teak Reserve (Sample)",
    region: "Nilambur, Eastern Malappuram",
    category: "Nature & Forests",
    verificationStatus: "verified",
    reviewerName: "Haris Pullara",
    reviewerRole: "Verification Moderator",
    submittedAt: "Sample • Nov 07",
    submittedBy: "Amina R.",
    reviewNote: "Official entry gate location and accessibility details approved.",
  },
  {
    id: "ver-06",
    destinationName: "Unverified Roadside Marker (Sample)",
    region: "Tirur Taluk",
    category: "Heritage & Culture",
    verificationStatus: "flagged",
    reviewerName: "Nikhil Varma",
    reviewerRole: "Field Reviewer",
    submittedAt: "Sample • Nov 06",
    submittedBy: "Test Draft",
    reviewNote: "Flagged as duplicate pin lacking valid public landmark reference.",
  },
  {
    id: "ver-07",
    destinationName: "Ponnani Lighthouse Coast (Sample)",
    region: "Ponnani Estuary, West",
    category: "Beaches & Estuaries",
    verificationStatus: "unverified",
    reviewerName: "Unassigned (Queue)",
    reviewerRole: "Pending Assignment",
    submittedAt: "Sample • Nov 05",
    submittedBy: "Jaseem K.",
    reviewNote: "Awaiting initial curator assignment in preview queue.",
  },
  {
    id: "ver-08",
    destinationName: "Kottakkal Heritage Precinct (Sample)",
    region: "Kottakkal, Central Corridor",
    category: "Heritage & Culture",
    verificationStatus: "verified",
    reviewerName: "Amina Rahman",
    reviewerRole: "District Curator",
    submittedAt: "Sample • Nov 04",
    submittedBy: "Haris P.",
    reviewNote: "Public courtyard hours & cultural summary approved.",
  },
];

export const ADMIN_USER_RECORDS: AdminSampleUserAccount[] = [
  {
    id: "usr-01",
    name: "Amina Rahman (Sample)",
    initials: "AR",
    email: "amina.curator@mytravelroad.example",
    role: "District Curator",
    region: "Malappuram Central",
    status: "active",
    savedCount: 19,
    submissionsCount: 14,
    registeredAt: "Sample • Jan 14, 2026",
  },
  {
    id: "usr-02",
    name: "Haris Pullara (Sample)",
    initials: "HP",
    email: "haris.mod@mytravelroad.example",
    role: "Moderator",
    region: "Kottakkal",
    status: "active",
    savedCount: 11,
    submissionsCount: 9,
    registeredAt: "Sample • Feb 03, 2026",
  },
  {
    id: "usr-03",
    name: "Fathima Nasrin (Sample)",
    initials: "FN",
    email: "fathima.trail@mytravelroad.example",
    role: "Contributor",
    region: "Nilambur",
    status: "active",
    savedCount: 24,
    submissionsCount: 7,
    registeredAt: "Sample • Apr 18, 2026",
  },
  {
    id: "usr-04",
    name: "Karthik Menon (Sample)",
    initials: "KM",
    email: "karthik.explorer@mytravelroad.example",
    role: "Explorer",
    region: "Tirur",
    status: "active",
    savedCount: 15,
    submissionsCount: 2,
    registeredAt: "Sample • May 29, 2026",
  },
  {
    id: "usr-05",
    name: "Safna Thasni (Sample)",
    initials: "ST",
    email: "safna.coast@mytravelroad.example",
    role: "Contributor",
    region: "Ponnani",
    status: "pending",
    savedCount: 6,
    submissionsCount: 3,
    registeredAt: "Sample • Aug 12, 2026",
  },
  {
    id: "usr-06",
    name: "Nikhil Varma (Sample)",
    initials: "NV",
    email: "nikhil.field@mytravelroad.example",
    role: "District Curator",
    region: "Perinthalmanna",
    status: "active",
    savedCount: 12,
    submissionsCount: 10,
    registeredAt: "Sample • Jun 21, 2026",
  },
  {
    id: "usr-07",
    name: "Meera Sreekumar (Sample)",
    initials: "MS",
    email: "meera.dormant@mytravelroad.example",
    role: "Explorer",
    region: "Manjeri",
    status: "inactive",
    savedCount: 4,
    submissionsCount: 1,
    registeredAt: "Sample • Mar 07, 2026",
  },
  {
    id: "usr-08",
    name: "Demo Test Account (Sample)",
    initials: "DT",
    email: "flagged.demo@mytravelroad.example",
    role: "Explorer",
    region: "Tirur Taluk",
    status: "suspended",
    savedCount: 0,
    submissionsCount: 2,
    registeredAt: "Sample • Oct 02, 2026",
  },
];

export const ADMIN_REVIEW_RECORDS: AdminSampleReview[] = [
  {
    id: "rev-01",
    destinationName: "Nilambur Teak Reserve (Sample)",
    region: "Nilambur",
    reviewerName: "Karthik Menon",
    reviewerInitials: "KM",
    rating: 5,
    excerpt:
      "Clear canopy walkways, informative forestry museum signage, and calm early-morning air.",
    status: "approved",
    submittedAt: "Sample • Nov 11",
  },
  {
    id: "rev-02",
    destinationName: "Adyanpara Cascades (Sample)",
    region: "Kurumbalangode",
    reviewerName: "Fathima Nasrin",
    reviewerInitials: "FN",
    rating: 4,
    excerpt:
      "Refreshing post-monsoon cascade; rocky steps near the lower pool require footwear caution.",
    status: "pending",
    submittedAt: "Sample • Nov 10",
  },
  {
    id: "rev-03",
    destinationName: "Kadalundi Estuary Viewpoint (Sample)",
    region: "Kadalundi",
    reviewerName: "Safna Thasni",
    reviewerInitials: "ST",
    rating: 5,
    excerpt:
      "Peaceful sunrise view along the mangrove mouth with migratory birds spotted around low tide.",
    status: "approved",
    submittedAt: "Sample • Nov 09",
  },
  {
    id: "rev-04",
    destinationName: "Kodikuthimala Ridge Trail (Sample)",
    region: "Perinthalmanna",
    reviewerName: "Ramees Ali",
    reviewerInitials: "RA",
    rating: 4,
    excerpt:
      "Great panoramic hilltop breeze, though afternoon fog limited valley visibility around 4 PM.",
    status: "approved",
    submittedAt: "Sample • Nov 08",
  },
  {
    id: "rev-05",
    destinationName: "Ponnani Lighthouse Coast (Sample)",
    region: "Ponnani",
    reviewerName: "Meera Sreekumar",
    reviewerInitials: "MS",
    rating: 3,
    excerpt:
      "Scenic coastal walk at sunset; visitor gate timings need clearer signboard notes.",
    status: "pending",
    submittedAt: "Sample • Nov 07",
  },
  {
    id: "rev-06",
    destinationName: "Unverified Roadside Marker (Sample)",
    region: "Tirur Taluk",
    reviewerName: "Demo Test Account",
    reviewerInitials: "DT",
    rating: 1,
    excerpt:
      "Automated test review flagged by moderation checklist preview for duplicate link text.",
    status: "rejected",
    submittedAt: "Sample • Nov 05",
  },
  {
    id: "rev-07",
    destinationName: "Kottakkal Heritage Precinct (Sample)",
    region: "Kottakkal",
    reviewerName: "Amina Rahman",
    reviewerInitials: "AR",
    rating: 5,
    excerpt:
      "Quiet heritage courtyard and well-maintained surroundings worth pairing with evening walks.",
    status: "approved",
    submittedAt: "Sample • Nov 04",
  },
];

export const ADMIN_REPORT_PERIODS: Record<
  "7d" | "30d" | "90d",
  AdminSampleReportPeriod
> = {
  "7d": {
    id: "7d",
    label: "Last 7 Days (Sample)",
    summaryStats: [
      {
        id: "rep-7d-views",
        title: "Sample Discovery Sessions",
        value: "1,420",
        delta: "+9%",
        trend: "up",
        periodLabel: "prior 7d preview",
        iconKey: "destinations",
        tone: "primary",
      },
      {
        id: "rep-7d-sub",
        title: "Destination Submissions",
        value: "6",
        delta: "+2",
        trend: "up",
        periodLabel: "sample intake",
        iconKey: "pending",
        tone: "accent",
      },
      {
        id: "rep-7d-ver",
        title: "Verification Completions",
        value: "5",
        delta: "83%",
        trend: "up",
        periodLabel: "approval ratio",
        iconKey: "verified",
        tone: "secondary",
      },
      {
        id: "rep-7d-users",
        title: "New Sample Signups",
        value: "24",
        delta: "+4",
        trend: "up",
        periodLabel: "prior 7d preview",
        iconKey: "users",
        tone: "muted",
      },
    ],
    growthSeries: [
      { id: "d1", label: "Mon", value: 3, secondaryValue: 2 },
      { id: "d2", label: "Tue", value: 4, secondaryValue: 3 },
      { id: "d3", label: "Wed", value: 2, secondaryValue: 2 },
      { id: "d4", label: "Thu", value: 5, secondaryValue: 4 },
      { id: "d5", label: "Fri", value: 6, secondaryValue: 4 },
      { id: "d6", label: "Sat", value: 4, secondaryValue: 3 },
      { id: "d7", label: "Sun", value: 5, secondaryValue: 4 },
    ],
    categoryDistribution: ADMIN_SAMPLE_DISTRIBUTION,
    verificationBreakdown: [
      {
        id: "ver-7-1",
        label: "Verified Entries",
        countLabel: "18 spots",
        percentage: 62,
        tone: "primary",
      },
      {
        id: "ver-7-2",
        label: "In Review Queue",
        countLabel: "6 spots",
        percentage: 21,
        tone: "secondary",
      },
      {
        id: "ver-7-3",
        label: "Needs Update / Flagged",
        countLabel: "5 spots",
        percentage: 17,
        tone: "accent",
      },
    ],
    userActivityFeed: ADMIN_SAMPLE_ACTIVITY,
  },
  "30d": {
    id: "30d",
    label: "Last 30 Days (Sample)",
    summaryStats: [
      {
        id: "rep-30d-views",
        title: "Sample Discovery Sessions",
        value: "5,840",
        delta: "+16%",
        trend: "up",
        periodLabel: "prior 30d preview",
        iconKey: "destinations",
        tone: "primary",
      },
      {
        id: "rep-30d-sub",
        title: "Destination Submissions",
        value: "24",
        delta: "+6",
        trend: "up",
        periodLabel: "sample intake",
        iconKey: "pending",
        tone: "accent",
      },
      {
        id: "rep-30d-ver",
        title: "Verification Completions",
        value: "19",
        delta: "79%",
        trend: "up",
        periodLabel: "approval ratio",
        iconKey: "verified",
        tone: "secondary",
      },
      {
        id: "rep-30d-users",
        title: "New Sample Signups",
        value: "96",
        delta: "+18%",
        trend: "up",
        periodLabel: "prior 30d preview",
        iconKey: "users",
        tone: "muted",
      },
    ],
    growthSeries: [
      { id: "w1", label: "Week 1", value: 11, secondaryValue: 8 },
      { id: "w2", label: "Week 2", value: 14, secondaryValue: 11 },
      { id: "w3", label: "Week 3", value: 18, secondaryValue: 14 },
      { id: "w4", label: "Week 4", value: 24, secondaryValue: 19 },
    ],
    categoryDistribution: [
      {
        id: "dist30-1",
        label: "Nature & Forests",
        countLabel: "14 sample items",
        percentage: 33,
        tone: "primary",
      },
      {
        id: "dist30-2",
        label: "Beaches & Estuaries",
        countLabel: "11 sample items",
        percentage: 26,
        tone: "secondary",
      },
      {
        id: "dist30-3",
        label: "Waterfalls & Hills",
        countLabel: "9 sample items",
        percentage: 22,
        tone: "primary",
      },
      {
        id: "dist30-4",
        label: "Heritage & Culture",
        countLabel: "8 sample items",
        percentage: 19,
        tone: "accent",
      },
    ],
    verificationBreakdown: [
      {
        id: "ver-30-1",
        label: "Verified Entries",
        countLabel: "31 spots",
        percentage: 74,
        tone: "primary",
      },
      {
        id: "ver-30-2",
        label: "In Review / Pending",
        countLabel: "7 spots",
        percentage: 17,
        tone: "secondary",
      },
      {
        id: "ver-30-3",
        label: "Rejected / Needs Update",
        countLabel: "4 spots",
        percentage: 9,
        tone: "accent",
      },
    ],
    userActivityFeed: ADMIN_SAMPLE_ACTIVITY,
  },
  "90d": {
    id: "90d",
    label: "Last 90 Days (Sample)",
    summaryStats: [
      {
        id: "rep-90d-views",
        title: "Sample Discovery Sessions",
        value: "16,290",
        delta: "+24%",
        trend: "up",
        periodLabel: "quarter preview",
        iconKey: "destinations",
        tone: "primary",
      },
      {
        id: "rep-90d-sub",
        title: "Destination Submissions",
        value: "42",
        delta: "+14",
        trend: "up",
        periodLabel: "sample intake",
        iconKey: "pending",
        tone: "accent",
      },
      {
        id: "rep-90d-ver",
        title: "Verification Completions",
        value: "35",
        delta: "83%",
        trend: "up",
        periodLabel: "approval ratio",
        iconKey: "verified",
        tone: "secondary",
      },
      {
        id: "rep-90d-users",
        title: "New Sample Signups",
        value: "184",
        delta: "+31%",
        trend: "up",
        periodLabel: "quarter preview",
        iconKey: "users",
        tone: "muted",
      },
    ],
    growthSeries: [
      { id: "m1", label: "Sep", value: 18, secondaryValue: 13 },
      { id: "m2", label: "Oct", value: 29, secondaryValue: 24 },
      { id: "m3", label: "Nov", value: 42, secondaryValue: 35 },
    ],
    categoryDistribution: [
      {
        id: "dist90-1",
        label: "Nature & Forests",
        countLabel: "14 sample items",
        percentage: 33,
        tone: "primary",
      },
      {
        id: "dist90-2",
        label: "Beaches & Estuaries",
        countLabel: "11 sample items",
        percentage: 26,
        tone: "secondary",
      },
      {
        id: "dist90-3",
        label: "Waterfalls & Hills",
        countLabel: "9 sample items",
        percentage: 22,
        tone: "primary",
      },
      {
        id: "dist90-4",
        label: "Heritage & Culture",
        countLabel: "8 sample items",
        percentage: 19,
        tone: "accent",
      },
    ],
    verificationBreakdown: [
      {
        id: "ver-90-1",
        label: "Verified Entries",
        countLabel: "35 spots",
        percentage: 83,
        tone: "primary",
      },
      {
        id: "ver-90-2",
        label: "In Review / Pending",
        countLabel: "4 spots",
        percentage: 10,
        tone: "secondary",
      },
      {
        id: "ver-90-3",
        label: "Rejected / Flagged",
        countLabel: "3 spots",
        percentage: 7,
        tone: "accent",
      },
    ],
    userActivityFeed: ADMIN_SAMPLE_ACTIVITY,
  },
};

export const ADMIN_SETTINGS_DEFAULTS: AdminSampleSettingsState = {
  profileName: "Amina Rahman",
  profileEmail: "curator-preview@mytravelroad.example",
  profileBio:
    "Lead Malappuram district curator overseeing nature reserves, coastal estuary markers, and heritage trail verification notes.",
  workspaceName: "My Travelroad",
  launchRegion: "malappuram",
  supportEmail: "curation-desk@mytravelroad.example",
  moderationNote:
    "Verify trail access hours, taluk coordinates, and public safety notes before marking any regional spot Verified.",
  notifyNewSubmissions: true,
  notifyVerificationQueue: true,
  notifyFlaggedReviews: true,
  weeklyReportDigest: false,
  defaultPageSize: "5",
  tableDensity: "comfortable",
  showSampleBadges: true,
};
