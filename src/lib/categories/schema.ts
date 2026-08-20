import { z } from "zod";

import { CATEGORY_TYPES } from "@/lib/categories/types";

/**
 * A small curated set of lucide-react icon names, matching the icons
 * already used by the default category set (see the Phase 5 migration's
 * provision_default_categories) plus a few generic extras for custom
 * categories — "controlled allowed values", not a free-text icon picker.
 */
export const CATEGORY_ICON_OPTIONS = [
  "utensils",
  "shopping-cart",
  "car",
  "home",
  "plug",
  "shopping-bag",
  "heart-pulse",
  "graduation-cap",
  "clapperboard",
  "plane",
  "shield",
  "landmark",
  "receipt",
  "gift",
  "sparkles",
  "wallet",
  "briefcase",
  "laptop",
  "percent",
  "trending-up",
  "building",
  "rotate-ccw",
  "tag",
  "more-horizontal",
] as const;
export type CategoryIconOption = (typeof CATEGORY_ICON_OPTIONS)[number];

/** A small curated palette — matches the default category colours. */
export const CATEGORY_COLOR_OPTIONS = [
  "#EF6C4D",
  "#4C9A6A",
  "#3B82F6",
  "#8B5CF6",
  "#0EA5E9",
  "#EC4899",
  "#DC2626",
  "#2563EB",
  "#F59E0B",
  "#06B6D4",
  "#64748B",
  "#78716C",
  "#94A3B8",
  "#F472B6",
  "#A855F7",
  "#16A34A",
  "#0D9488",
  "#0891B2",
  "#65A30D",
  "#059669",
  "#0284C7",
  "#7C3AED",
  "#DB2777",
  "#6B7280",
] as const;
export type CategoryColorOption = (typeof CATEGORY_COLOR_OPTIONS)[number];

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a category name.")
  .max(60, "Category name must be 60 characters or fewer.");

export const categoryTypeSchema = z.enum(CATEGORY_TYPES, {
  error: "Please choose income or expense.",
});

export const categoryIconSchema = z.enum(CATEGORY_ICON_OPTIONS).optional();

export const categoryColorSchema = z.enum(CATEGORY_COLOR_OPTIONS).optional();

export const categoryFormSchema = z.object({
  name: categoryNameSchema,
  categoryType: categoryTypeSchema,
  icon: categoryIconSchema,
  color: categoryColorSchema,
});
export type CategoryFormInput = z.infer<typeof categoryFormSchema>;
