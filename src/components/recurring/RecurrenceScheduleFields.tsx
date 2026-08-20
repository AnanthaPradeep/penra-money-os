import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { RECURRENCE_FREQUENCIES } from "@/lib/recurring/schedule";
import {
  PROCESSING_MODES,
  PROCESSING_MODE_LABELS,
} from "@/lib/recurring/types";

const FREQUENCY_LABELS: Record<
  (typeof RECURRENCE_FREQUENCIES)[number],
  string
> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly",
};

type RecurrenceScheduleFieldsProps = {
  idPrefix: string;
  fieldError: (name: string) => string | undefined;
  defaultFrequency?: string | undefined;
  defaultIntervalCount?: number | undefined;
  defaultStartDate?: string | undefined;
  defaultEndDate?: string | undefined;
  defaultProcessingMode?: string | undefined;
  /** The create form fixes the start date and shows it as a plain field; the edit form never lets it change at all, so it's omitted entirely there. */
  showStartDate?: boolean;
};

/**
 * The frequency/interval/start-date/end-date/processing-mode block shared
 * by every recurring-item kind's form — kept in one place so schedule
 * fields never drift between the bill, subscription, income, and transfer
 * variants.
 */
export function RecurrenceScheduleFields({
  idPrefix,
  fieldError,
  defaultFrequency = "monthly",
  defaultIntervalCount = 1,
  defaultStartDate,
  defaultEndDate,
  defaultProcessingMode = "reminder_only",
  showStartDate = true,
}: Readonly<RecurrenceScheduleFieldsProps>) {
  const frequencyOptions = RECURRENCE_FREQUENCIES.map((frequency) => ({
    value: frequency,
    label: FREQUENCY_LABELS[frequency],
  }));
  const processingModeOptions = PROCESSING_MODES.map((mode) => ({
    value: mode,
    label: PROCESSING_MODE_LABELS[mode],
  }));

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Select
          id={`${idPrefix}-frequency`}
          name="frequency"
          label="Repeats"
          options={frequencyOptions}
          defaultValue={defaultFrequency}
          required
          error={fieldError("frequency")}
        />
        <Field
          id={`${idPrefix}-interval-count`}
          name="intervalCount"
          label="Every N periods"
          inputMode="numeric"
          defaultValue={defaultIntervalCount}
          description="1 = every period, 2 = every other, etc."
          required
          error={fieldError("intervalCount")}
        />
      </div>
      {showStartDate ? (
        <Field
          id={`${idPrefix}-start-date`}
          name="startDate"
          label="Start date"
          type="date"
          defaultValue={defaultStartDate}
          required
          error={fieldError("startDate")}
        />
      ) : null}
      <Field
        id={`${idPrefix}-end-date`}
        name="endDate"
        label="End date (optional)"
        type="date"
        defaultValue={defaultEndDate}
        description="Leave blank for an item with no planned end."
        error={fieldError("endDate")}
      />
      <Select
        id={`${idPrefix}-processing-mode`}
        name="processingMode"
        label="How should this be handled?"
        options={processingModeOptions}
        defaultValue={defaultProcessingMode}
        required
        error={fieldError("processingMode")}
      />
    </>
  );
}
