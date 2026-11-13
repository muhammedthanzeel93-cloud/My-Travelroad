/**
 * My Travelroad — Category Domain Models
 * Defines the tourism taxonomy and hierarchical categorization structure.
 */

import type { CategoryId, IsoDateTimeString } from "./common.types";

/** Operational status of a taxonomy category. */
export type CategoryStatus = "active" | "inactive" | "archived";

/**
 * Tourism Destination Category.
 * Supports a self-referencing hierarchy (e.g., 'Nature' -> 'Forest Reserves' -> 'Teak Plantations')
 * to scale from Malappuram regional discovery to national ecosystems.
 */
export interface DestinationCategory {
  /** Unique category identifier. */
  id: CategoryId;

  /** URL-safe unique category slug (e.g., 'nature-forests', 'beaches-estuaries'). */
  slug: string;

  /** Full display name (e.g., 'Nature & Forests'). */
  name: string;

  /** Compact label for badge pills and mobile tab headers (e.g., 'Forests'). */
  shortLabel: string;

  /** Editorial description summarizing what places belong to this category. */
  description: string;

  /** Lucide icon key or SVG token identifier (e.g., 'forest', 'coast', 'hills', 'heritage'). */
  iconKey: string;

  /** Optional parent category ID for nested sub-categories. Root categories have null. */
  parentId?: CategoryId | null;

  /** Sequence priority for sorting categories in navigation and browse grids. */
  displayOrder: number;

  /** Operational visibility status. */
  status: CategoryStatus;

  /** Timestamp when the category was created. */
  createdAt: IsoDateTimeString;

  /** Timestamp when the category was last modified. */
  updatedAt: IsoDateTimeString;
}

/** Category with its populated subcategory hierarchy. */
export interface CategoryHierarchyNode extends DestinationCategory {
  subcategories: CategoryHierarchyNode[];
}
