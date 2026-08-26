"use client";

import { useActionState, useState } from "react";
import { UploadCloud } from "lucide-react";

import type { AccountOption } from "@/components/ledger/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  INITIAL_BANK_IMPORT_ACTION_STATE,
  INITIAL_UPLOAD_STATEMENT_ACTION_STATE,
  type BankImportActionState,
  type UploadStatementActionState,
} from "@/lib/bank-import/action-state";
import {
  confirmMappingAction,
  uploadStatementAction,
} from "@/lib/bank-import/actions";
import { STATEMENT_DATE_FORMATS } from "@/lib/bank-import/types";

type UploadSuccessState = Extract<
  UploadStatementActionState,
  { status: "success" }
>;

type ImportWizardProps = {
  accounts: AccountOption[];
  defaultAccountId?: string | undefined;
};

const DATE_FORMAT_OPTIONS = STATEMENT_DATE_FORMATS.map((format) => ({
  value: format,
  label: format,
}));

/**
 * A single-page, two-phase upload wizard. The file is parsed once,
 * server-side, in uploadStatementAction — nothing about it is ever stored
 * durably (see parser.ts), so the tokenized header/rows the action returns
 * are kept only in this component's own React state for as long as the
 * tab stays open, and are resubmitted once (as a hidden JSON field) when
 * the user confirms the column mapping. Reloading the page loses the
 * in-progress upload by design, exactly like re-selecting a file would.
 */
export function ImportWizard({
  accounts,
  defaultAccountId,
}: Readonly<ImportWizardProps>) {
  const [uploadState, uploadAction] = useActionState(
    uploadStatementAction,
    INITIAL_UPLOAD_STATEMENT_ACTION_STATE,
  );
  const [mappingState, mappingAction] = useActionState(
    confirmMappingAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );

  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: account.name,
  }));

  if (uploadState.status !== "success") {
    return (
      <form action={uploadAction} noValidate className="flex flex-col gap-4">
        <Select
          id="import-account"
          name="accountId"
          label="Destination account"
          options={accountOptions}
          defaultValue={defaultAccountId}
          placeholder="Choose an account"
          required
          error={
            uploadState.status === "error"
              ? uploadState.fieldErrors?.accountId
              : undefined
          }
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="import-file"
            className="text-sm font-medium text-foreground"
          >
            Statement file
          </label>
          <p className="text-sm text-muted-foreground">
            CSV or TSV only, up to 6MB. The file is parsed in memory and is
            never stored — only the transactions you confirm are saved.
          </p>
          <input
            id="import-file"
            name="file"
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            required
            className="h-11 w-full rounded-md border border-input-border bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </div>

        {uploadState.status === "error" ? (
          <FormMessage message={uploadState.message} tone="error" />
        ) : null}

        <SubmitButton pendingText="Reading file…">
          <UploadCloud aria-hidden="true" className="size-4" />
          Upload and continue
        </SubmitButton>
      </form>
    );
  }

  return (
    <MappingPhase
      uploadState={uploadState}
      mappingState={mappingState}
      mappingAction={mappingAction}
    />
  );
}

type MappingPhaseProps = {
  uploadState: UploadSuccessState;
  mappingState: BankImportActionState;
  mappingAction: (formData: FormData) => void;
};

function MappingPhase({
  uploadState,
  mappingState,
  mappingAction,
}: Readonly<MappingPhaseProps>) {
  const [amountShape, setAmountShape] = useState<"debit_credit" | "signed">(
    uploadState.suggestedMapping.debitColumn ||
      uploadState.suggestedMapping.creditColumn
      ? "debit_credit"
      : "signed",
  );

  const columnOptions = uploadState.header.map((column) => ({
    value: column,
    label: column,
  }));
  const columnOptionsWithNone = [
    { value: "", label: "None" },
    ...columnOptions,
  ];

  const fieldError = (name: string) =>
    mappingState.status === "error"
      ? mappingState.fieldErrors?.[name]
      : undefined;

  const rowsPayload = JSON.stringify({
    header: uploadState.header,
    rows: uploadState.rows,
  });

  return (
    <form action={mappingAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="importId" value={uploadState.importId} />
      <input type="hidden" name="rowsPayload" value={rowsPayload} />

      {uploadState.isDuplicateFile ? (
        <FormMessage
          tone="error"
          message="This exact file was already imported into this account. You can still continue, but check your import history first to avoid duplicate transactions."
        />
      ) : null}

      <p className="text-sm text-muted-foreground">
        Detected {uploadState.header.length} columns and{" "}
        {uploadState.rows.length} rows. Confirm which column is which before we
        parse the file —
        {uploadState.detectionConfidence === "high"
          ? " these were auto-detected with high confidence."
          : " double-check the auto-detected columns below."}
      </p>

      <Select
        id="mapping-date-column"
        name="dateColumn"
        label="Date column"
        options={columnOptions}
        defaultValue={uploadState.suggestedMapping.dateColumn}
        placeholder="Choose a column"
        required
        error={fieldError("dateColumn")}
      />
      <Select
        id="mapping-date-format"
        name="dateFormat"
        label="Date format"
        options={DATE_FORMAT_OPTIONS}
        defaultValue="DD/MM/YYYY"
        required
        error={fieldError("dateFormat")}
      />
      <Select
        id="mapping-description-column"
        name="descriptionColumn"
        label="Description column"
        options={columnOptions}
        defaultValue={uploadState.suggestedMapping.descriptionColumn}
        placeholder="Choose a column"
        required
        error={fieldError("descriptionColumn")}
      />
      <Select
        id="mapping-reference-column"
        name="referenceColumn"
        label="Reference column (optional)"
        options={columnOptionsWithNone}
        defaultValue={uploadState.suggestedMapping.referenceColumn ?? ""}
      />
      <Select
        id="mapping-balance-column"
        name="balanceColumn"
        label="Running balance column (optional)"
        options={columnOptionsWithNone}
        defaultValue={uploadState.suggestedMapping.balanceColumn ?? ""}
      />

      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium text-foreground">
          How does this statement show amounts?
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="amountShapeChoice"
            checked={amountShape === "debit_credit"}
            onChange={() => setAmountShape("debit_credit")}
          />
          Separate debit and credit columns
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="amountShapeChoice"
            checked={amountShape === "signed"}
            onChange={() => setAmountShape("signed")}
          />
          One amount column (signed, or with a DR/CR suffix)
        </label>
      </fieldset>

      {amountShape === "debit_credit" ? (
        <>
          <Select
            id="mapping-debit-column"
            name="debitColumn"
            label="Debit column"
            options={columnOptions}
            defaultValue={uploadState.suggestedMapping.debitColumn}
            placeholder="Choose a column"
            error={fieldError("amountColumn")}
          />
          <Select
            id="mapping-credit-column"
            name="creditColumn"
            label="Credit column"
            options={columnOptions}
            defaultValue={uploadState.suggestedMapping.creditColumn}
            placeholder="Choose a column"
          />
        </>
      ) : (
        <>
          <Select
            id="mapping-amount-column"
            name="amountColumn"
            label="Amount column"
            options={columnOptions}
            defaultValue={uploadState.suggestedMapping.amountColumn}
            placeholder="Choose a column"
            error={fieldError("amountColumn")}
          />
          <Select
            id="mapping-sign-convention"
            name="amountSignConvention"
            label="Sign convention"
            options={[
              {
                value: "debit_negative",
                label: "Negative amounts are debits (most common)",
              },
              { value: "debit_positive", label: "Positive amounts are debits" },
            ]}
            defaultValue="debit_negative"
          />
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="saveAsPreset" />
        Remember this mapping for statements with the same columns
      </label>
      <Field
        id="mapping-bank-label"
        name="bankLabel"
        label="Bank / source label (optional)"
        placeholder="e.g. HDFC Bank savings export"
      />

      {mappingState.status === "error" ? (
        <FormMessage message={mappingState.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Parsing rows…">
        Parse and review rows
      </SubmitButton>
    </form>
  );
}
