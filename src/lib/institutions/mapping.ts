import {
  INSTITUTION_TYPES,
  type InstitutionRow,
  type InstitutionType,
} from "@/lib/institutions/types";
import { assertLiteral } from "@/lib/types/literal";

export type Institution = {
  id: string;
  name: string;
  institutionType: InstitutionType;
  website: string | null;
  notes: string | null;
  isArchived: boolean;
};

export function mapInstitutionRow(row: InstitutionRow): Institution {
  return {
    id: row.id,
    name: row.name,
    institutionType: assertLiteral(
      row.institution_type,
      INSTITUTION_TYPES,
      "institutions.institution_type",
    ),
    website: row.website,
    notes: row.notes,
    isArchived: row.is_archived,
  };
}
