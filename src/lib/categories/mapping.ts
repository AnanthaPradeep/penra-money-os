import {
  CATEGORY_TYPES,
  type CategoryRow,
  type CategoryType,
} from "@/lib/categories/types";
import { assertLiteral } from "@/lib/types/literal";

export type Category = {
  id: string;
  parentId: string | null;
  categoryType: CategoryType;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  isArchived: boolean;
};

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parent_id,
    categoryType: assertLiteral(
      row.category_type,
      CATEGORY_TYPES,
      "categories.category_type",
    ),
    name: row.name,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    isSystem: row.is_system,
    isArchived: row.is_archived,
  };
}
