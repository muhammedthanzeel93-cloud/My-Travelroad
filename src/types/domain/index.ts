/**
 * My Travelroad — Domain Types Barrel Export
 * Central exports for all application domain entities, categorized by development phase.
 */

// 1. Common Primitives & Geospatial Types
export * from "./common.types";

// 2. Identity & Accounts (Stage A)
export * from "./account.types";
export * from "./profile.types";

// 3. Taxonomy & Categorization (Stage A)
export * from "./category.types";

// 4. Destination Discovery (Stage A)
export * from "./destination.types";

// 5. Fact-Level Destination Verification (Stage A)
export * from "./verification.types";

// 6. Saved Destinations & Itineraries (Stage A)
export * from "./saved-destination.types";

// 7. Administration, Moderation & Audit Trails (Stage A)
export * from "./audit.types";
export * from "./moderation.types";

// 8. Community & Social Models (FUTURE PHASE)
// Conceptual models for future sprints; strictly decoupled from Stage A data access.
export * from "./community.types";
