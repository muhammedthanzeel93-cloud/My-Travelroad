/**
 * DEVELOPMENT-ONLY SAMPLE DATA
 *
 * Used strictly for Task 02 structural page previews and dynamic route testing.
 * Do not treat placeholder timings, coordinates, or operational metrics as verified
 * real-world tourism facts. Verified dataset integration belongs to later tasks.
 */

export type CategoryIconKey = "forest" | "coast" | "hills" | "heritage";

export interface SampleCategory {
  slug: string;
  name: string;
  shortLabel: string;
  description: string;
  iconKey: CategoryIconKey;
  accentVariant: "subtle" | "secondarySubtle" | "accentSubtle" | "muted";
}

export interface SampleDestination {
  slug: string;
  title: string;
  location: string;
  region: string;
  categorySlug: string;
  shortDescription: string;
  fullDescription: string;
  isFeatured: boolean;
  isPopular: boolean;
  isSampleSaved: boolean;
  popularityRank: number;
  iconKey: CategoryIconKey;
  importantInfoPlaceholder: {
    visitingHours: string;
    accessNote: string;
    entryReference: string;
    advisoryNote: string;
  };
  mapPlaceholder: {
    coordinatesLabel: string;
    nearestTownLabel: string;
  };
  gallerySlots: string[];
  highlightsPlaceholder: string[];
}

export interface SampleProfilePreview {
  displayName: string;
  handle: string;
  initials: string;
  homeRegion: string;
  bioPlaceholder: string;
  memberStatusLabel: string;
  statsPlaceholders: {
    label: string;
    value: string;
    note: string;
  }[];
  activityPlaceholders: {
    id: string;
    title: string;
    subtitle: string;
    timestampLabel: string;
    targetHref: string;
  }[];
}

export const DEV_SAMPLE_CATEGORIES: SampleCategory[] = [
  {
    slug: "nature-forests",
    name: "Nature & Forests",
    shortLabel: "Forests",
    description:
      "Structural category preview for forest reserves, teak groves, and shaded eco-trails across eastern Malappuram.",
    iconKey: "forest",
    accentVariant: "subtle",
  },
  {
    slug: "beaches-estuaries",
    name: "Beaches & Estuaries",
    shortLabel: "Coast & Estuaries",
    description:
      "Structural category preview for coastal promenades, river-sea confluences, and wetland viewpoints along western Malappuram.",
    iconKey: "coast",
    accentVariant: "secondarySubtle",
  },
  {
    slug: "waterfalls-hills",
    name: "Waterfalls & Hills",
    shortLabel: "Hills & Falls",
    description:
      "Structural category preview for elevated viewpoints, seasonal cascades, and highland trails across the district.",
    iconKey: "hills",
    accentVariant: "subtle",
  },
  {
    slug: "heritage-culture",
    name: "Heritage & Culture",
    shortLabel: "Heritage",
    description:
      "Structural category preview for historical precincts, riverside heritage sites, and traditional wellness centers.",
    iconKey: "heritage",
    accentVariant: "accentSubtle",
  },
];

export const DEV_SAMPLE_DESTINATIONS: SampleDestination[] = [
  {
    slug: "nilambur-teak-reserve",
    title: "Nilambur Teak Reserve (Sample)",
    location: "Nilambur, Malappuram",
    region: "Eastern Malappuram",
    categorySlug: "nature-forests",
    shortDescription:
      "Development preview entry representing wooded plantation trails, river views, and forestry museum spaces in Nilambur.",
    fullDescription:
      "This layout preview demonstrates how a full forest-reserve destination page presents editorial storytelling, key visitor parameters, and location guidance. Verified official descriptions, ecological notes, and departmental guidelines will populate this section in a subsequent data integration phase.",
    isFeatured: true,
    isPopular: true,
    isSampleSaved: true,
    popularityRank: 1,
    iconKey: "forest",
    importantInfoPlaceholder: {
      visitingHours: "Sample placeholder: Daytime hours",
      accessNote: "Sample placeholder: Road access via Nilambur corridor",
      entryReference: "Sample placeholder: Entry pass notice",
      advisoryNote: "Sample placeholder: Eco-zone guidelines apply",
    },
    mapPlaceholder: {
      coordinatesLabel: "Map coordinates placeholder (Nilambur area)",
      nearestTownLabel: "Nearest hub placeholder: Nilambur",
    },
    gallerySlots: [
      "Primary Canopy Trail View (Placeholder)",
      "Museum Exterior Frame (Placeholder)",
      "River Bridge Vista (Placeholder)",
      "Botanical Canopy Detail (Placeholder)",
    ],
    highlightsPlaceholder: [
      "Sample highlight: Tree-lined walking paths",
      "Sample highlight: Interpretive forestry exhibit space",
      "Sample highlight: Scenic riverfront outlook",
    ],
  },
  {
    slug: "kadalundi-estuary",
    title: "Kadalundi Estuary Viewpoint (Sample)",
    location: "Vallikkunnu, Malappuram",
    region: "Coastal Malappuram",
    categorySlug: "beaches-estuaries",
    shortDescription:
      "Development preview entry illustrating wetland birding lookouts and river-to-sea estuary landscapes.",
    fullDescription:
      "This structural preview showcases coastal and estuarine destination layout formatting, including seasonal advisory blocks and related coastal sites. Verified tidal calendars and sanctuary permit rules will be integrated once backend content workflows are connected.",
    isFeatured: true,
    isPopular: true,
    isSampleSaved: true,
    popularityRank: 2,
    iconKey: "coast",
    importantInfoPlaceholder: {
      visitingHours: "Sample placeholder: Morning & evening windows",
      accessNote: "Sample placeholder: Coastal road & rail proximity",
      entryReference: "Sample placeholder: Community zone reference",
      advisoryNote: "Sample placeholder: Seasonal wetland conditions",
    },
    mapPlaceholder: {
      coordinatesLabel: "Map coordinates placeholder (Kadalundi estuary)",
      nearestTownLabel: "Nearest hub placeholder: Vallikkunnu / Feroke",
    },
    gallerySlots: [
      "Primary Estuary Panorama (Placeholder)",
      "Mangrove Shoreline Frame (Placeholder)",
      "Viewing Bridge Perspective (Placeholder)",
      "Sunset Horizon Study (Placeholder)",
    ],
    highlightsPlaceholder: [
      "Sample highlight: River-sea confluence panorama",
      "Sample highlight: Wetland observation corridor",
      "Sample highlight: Quiet coastal sunset vantage",
    ],
  },
  {
    slug: "adyanpara-cascades",
    title: "Adyanpara Cascades (Sample)",
    location: "Kurumbalangode, Malappuram",
    region: "Eastern Malappuram",
    categorySlug: "waterfalls-hills",
    shortDescription:
      "Development preview entry representing rocky forest cascades and hillside viewpoints in the Nilambur belt.",
    fullDescription:
      "This layout preview models waterfall and highland tourism listings, highlighting safety guidance containers, seasonal availability placeholders, and neighboring eastern Malappuram spots.",
    isFeatured: true,
    isPopular: false,
    isSampleSaved: false,
    popularityRank: 4,
    iconKey: "hills",
    importantInfoPlaceholder: {
      visitingHours: "Sample placeholder: Daylight access only",
      accessNote: "Sample placeholder: Hillside approach road",
      entryReference: "Sample placeholder: Check-post reference",
      advisoryNote: "Sample placeholder: Seasonal flow & terrain advisory",
    },
    mapPlaceholder: {
      coordinatesLabel: "Map coordinates placeholder (Kurumbalangode zone)",
      nearestTownLabel: "Nearest hub placeholder: Nilambur",
    },
    gallerySlots: [
      "Primary Waterfall Tier View (Placeholder)",
      "Forest Approach Path (Placeholder)",
      "Rocky Stream Pool Frame (Placeholder)",
      "Hillside Mist Perspective (Placeholder)",
    ],
    highlightsPlaceholder: [
      "Sample highlight: Multi-tier rocky cascade zone",
      "Sample highlight: Shaded forest approach",
      "Sample highlight: Seasonal monsoon flow view",
    ],
  },
  {
    slug: "kottakkal-heritage-precinct",
    title: "Kottakkal Heritage Precinct (Sample)",
    location: "Kottakkal, Malappuram",
    region: "Central Malappuram",
    categorySlug: "heritage-culture",
    shortDescription:
      "Development preview entry illustrating traditional wellness heritage, botanical gardens, and cultural architecture.",
    fullDescription:
      "This preview demonstrates how cultural and heritage landmarks are structured within My Travelroad, separating descriptive storytelling from visitor protocol reminders and nearby discovery recommendations.",
    isFeatured: false,
    isPopular: true,
    isSampleSaved: true,
    popularityRank: 3,
    iconKey: "heritage",
    importantInfoPlaceholder: {
      visitingHours: "Sample placeholder: Designated visitor hours",
      accessNote: "Sample placeholder: NH corridor connectivity",
      entryReference: "Sample placeholder: Visitor registration note",
      advisoryNote: "Sample placeholder: Quiet cultural campus etiquette",
    },
    mapPlaceholder: {
      coordinatesLabel: "Map coordinates placeholder (Kottakkal center)",
      nearestTownLabel: "Nearest hub placeholder: Kottakkal",
    },
    gallerySlots: [
      "Primary Courtyard Architecture (Placeholder)",
      "Medicinal Garden Layout (Placeholder)",
      "Heritage Pavilion Frame (Placeholder)",
      "Cultural Exhibit Detail (Placeholder)",
    ],
    highlightsPlaceholder: [
      "Sample highlight: Traditional Kerala architectural forms",
      "Sample highlight: Curated botanical herbarium layout",
      "Sample highlight: Cultural museum & archives space",
    ],
  },
  {
    slug: "padinharekara-coast",
    title: "Padinharekara Coastal Point (Sample)",
    location: "Ponnani / Tirur Coast, Malappuram",
    region: "Coastal Malappuram",
    categorySlug: "beaches-estuaries",
    shortDescription:
      "Development preview entry representing wide sandy shorelines and river-mouth vistas along western Malappuram.",
    fullDescription:
      "This structural entry demonstrates coastal destination templates including sunset outlook cards, accessibility notes, and related shoreline listings.",
    isFeatured: false,
    isPopular: true,
    isSampleSaved: false,
    popularityRank: 5,
    iconKey: "coast",
    importantInfoPlaceholder: {
      visitingHours: "Sample placeholder: Open public promenade",
      accessNote: "Sample placeholder: Coastal road access",
      entryReference: "Sample placeholder: Public shoreline zone",
      advisoryNote: "Sample placeholder: Coastal wind & tide notice",
    },
    mapPlaceholder: {
      coordinatesLabel: "Map coordinates placeholder (Padinharekara shore)",
      nearestTownLabel: "Nearest hub placeholder: Tirur / Ponnani",
    },
    gallerySlots: [
      "Primary Coastal Confluence (Placeholder)",
      "Palm-Lined Shore Walk (Placeholder)",
      "Evening Light Horizon (Placeholder)",
      "River Mouth Viewpoint (Placeholder)",
    ],
    highlightsPlaceholder: [
      "Sample highlight: Panoramic river-mouth beach view",
      "Sample highlight: Spacious evening walkway",
      "Sample highlight: Coconut grove shoreline",
    ],
  },
  {
    slug: "kodikuthimala-ridge",
    title: "Kodikuthimala Hilltop (Sample)",
    location: "Perinthalmanna Area, Malappuram",
    region: "Southern-East Malappuram",
    categorySlug: "waterfalls-hills",
    shortDescription:
      "Development preview entry illustrating grassy hill ridges, lookout towers, and misty morning panoramas.",
    fullDescription:
      "This sample entry models elevated viewpoint pages with terrain warnings, trekking notes, and regional connections to central Malappuram towns.",
    isFeatured: false,
    isPopular: false,
    isSampleSaved: false,
    popularityRank: 6,
    iconKey: "hills",
    importantInfoPlaceholder: {
      visitingHours: "Sample placeholder: Morning to dusk hours",
      accessNote: "Sample placeholder: Hill road & short trail",
      entryReference: "Sample placeholder: Viewpoint entry placeholder",
      advisoryNote: "Sample placeholder: Steep gradient footwear note",
    },
    mapPlaceholder: {
      coordinatesLabel: "Map coordinates placeholder (Ammikkad hill area)",
      nearestTownLabel: "Nearest hub placeholder: Perinthalmanna",
    },
    gallerySlots: [
      "Primary Ridge Outlook (Placeholder)",
      "Grassland Slope Trail (Placeholder)",
      "Valley Mist Frame (Placeholder)",
      "Summit Watchtower View (Placeholder)",
    ],
    highlightsPlaceholder: [
      "Sample highlight: Elevated 360-degree valley overlook",
      "Sample highlight: Morning mist & breeze corridor",
      "Sample highlight: Short hillside ridge walk",
    ],
  },
  {
    slug: "nedumkayam-rainforest",
    title: "Nedumkayam Forest Zone (Sample)",
    location: "Karulai / Nilambur, Malappuram",
    region: "Eastern Malappuram",
    categorySlug: "nature-forests",
    shortDescription:
      "Development preview entry showcasing dense woodland edge trails, historic rest-house views, and stream bridges.",
    fullDescription:
      "This layout preview tests forest-permit notice cards and conservation-first copy blocks designed for ecologically sensitive zones in eastern Malappuram.",
    isFeatured: false,
    isPopular: false,
    isSampleSaved: false,
    popularityRank: 7,
    iconKey: "forest",
    importantInfoPlaceholder: {
      visitingHours: "Sample placeholder: Restricted daytime slots",
      accessNote: "Sample placeholder: Forest check-post route",
      entryReference: "Sample placeholder: Permit required placeholder",
      advisoryNote: "Sample placeholder: Strict plastic-free zone",
    },
    mapPlaceholder: {
      coordinatesLabel: "Map coordinates placeholder (Karulai forest edge)",
      nearestTownLabel: "Nearest hub placeholder: Nilambur",
    },
    gallerySlots: [
      "Primary Woodland Stream (Placeholder)",
      "Timber Bridge Crossing (Placeholder)",
      "Rainforest Canopy Study (Placeholder)",
      "Heritage Rest-House Frame (Placeholder)",
    ],
    highlightsPlaceholder: [
      "Sample highlight: Clear forest stream crossing",
      "Sample highlight: Dense tropical woodland atmosphere",
      "Sample highlight: Conservation-focused visitor zone",
    ],
  },
  {
    slug: "thirunavaya-riverfront",
    title: "Thirunavaya Riverfront (Sample)",
    location: "Thirunavaya, Malappuram",
    region: "Southern Malappuram",
    categorySlug: "heritage-culture",
    shortDescription:
      "Development preview entry representing historic riverside ghats and traditional heritage grounds along the Bharathapuzha.",
    fullDescription:
      "This preview illustrates riverine heritage pages, linking historical storytelling with calm cultural observation and surrounding Tirur-region stops.",
    isFeatured: false,
    isPopular: false,
    isSampleSaved: false,
    popularityRank: 8,
    iconKey: "heritage",
    importantInfoPlaceholder: {
      visitingHours: "Sample placeholder: Open daily",
      accessNote: "Sample placeholder: Rail & road access via Tirur",
      entryReference: "Sample placeholder: Cultural precinct access",
      advisoryNote: "Sample placeholder: Respectful heritage & ghat etiquette",
    },
    mapPlaceholder: {
      coordinatesLabel: "Map coordinates placeholder (Bharathapuzha bank)",
      nearestTownLabel: "Nearest hub placeholder: Tirur",
    },
    gallerySlots: [
      "Primary Riverbank Steps (Placeholder)",
      "Historic Courtyard Frame (Placeholder)",
      "Lotus Pond Perspective (Placeholder)",
      "Bharathapuzha Horizon (Placeholder)",
    ],
    highlightsPlaceholder: [
      "Sample highlight: Peaceful Bharathapuzha riverbank view",
      "Sample highlight: Traditional cultural heritage grounds",
      "Sample highlight: Proximity to regional heritage stops",
    ],
  },
];

export const DEV_SAMPLE_PROFILE: SampleProfilePreview = {
  displayName: "Amina Rahman (Sample Profile)",
  handle: "@malappuram_explorer",
  initials: "AR",
  homeRegion: "Malappuram, Kerala",
  bioPlaceholder:
    "Development preview profile layout for My Travelroad. Personal travel preferences, saved itineraries, and verified activity history will appear here once account services are implemented.",
  memberStatusLabel: "Explorer Preview",
  statsPlaceholders: [
    {
      label: "Saved Destinations",
      value: "3",
      note: "Sample placeholder count",
    },
    {
      label: "Categories Explored",
      value: "4",
      note: "Sample placeholder count",
    },
    {
      label: "Planned Routes",
      value: "0",
      note: "Planned in future task",
    },
  ],
  activityPlaceholders: [
    {
      id: "act-1",
      title: "Viewed Nilambur Teak Reserve (Sample)",
      subtitle: "Nature & Forests • Structural preview entry",
      timestampLabel: "Recent preview",
      targetHref: "/destinations/nilambur-teak-reserve",
    },
    {
      id: "act-2",
      title: "Browsed Beaches & Estuaries category",
      subtitle: "Category exploration • Structural preview entry",
      timestampLabel: "Recent preview",
      targetHref: "/categories/beaches-estuaries",
    },
    {
      id: "act-3",
      title: "Saved Kottakkal Heritage Precinct (Sample)",
      subtitle: "Heritage & Culture • Placeholder bookmark",
      timestampLabel: "Sample state",
      targetHref: "/destinations/kottakkal-heritage-precinct",
    },
  ],
};

export function getCategoryBySlug(slug: string): SampleCategory | undefined {
  return DEV_SAMPLE_CATEGORIES.find((cat) => cat.slug === slug);
}

export function getDestinationBySlug(slug: string): SampleDestination | undefined {
  return DEV_SAMPLE_DESTINATIONS.find((dest) => dest.slug === slug);
}

export function getRelatedDestinations(
  destination: SampleDestination,
  limit = 3
): SampleDestination[] {
  const sameCategory = DEV_SAMPLE_DESTINATIONS.filter(
    (item) => item.slug !== destination.slug && item.categorySlug === destination.categorySlug
  );
  const others = DEV_SAMPLE_DESTINATIONS.filter(
    (item) => item.slug !== destination.slug && item.categorySlug !== destination.categorySlug
  );
  return [...sameCategory, ...others].slice(0, limit);
}

export type SortOption = "popular" | "alphabetical" | "featured";

export function filterDestinations({
  query = "",
  category = "",
  sort = "popular",
}: {
  query?: string;
  category?: string;
  sort?: string;
}): SampleDestination[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCategory = category.trim().toLowerCase();

  const filtered = DEV_SAMPLE_DESTINATIONS.filter((dest) => {
    const matchesCategory =
      !normalizedCategory ||
      normalizedCategory === "all" ||
      dest.categorySlug.toLowerCase() === normalizedCategory;

    const matchesQuery =
      !normalizedQuery ||
      dest.title.toLowerCase().includes(normalizedQuery) ||
      dest.location.toLowerCase().includes(normalizedQuery) ||
      dest.region.toLowerCase().includes(normalizedQuery) ||
      dest.shortDescription.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });

  if (sort === "alphabetical") {
    return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === "featured") {
    return [...filtered].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  }
  return [...filtered].sort((a, b) => a.popularityRank - b.popularityRank);
}
