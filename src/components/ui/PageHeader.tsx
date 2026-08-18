import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Rendered above the title (e.g. a BackLink) — kept separate from `title` so the <h1> stays the page's one clear heading. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
};

/** The top-of-page heading block shared by every screen — exactly one `<h1>` per page lives here. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: Readonly<PageHeaderProps>) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1.5">
        {eyebrow}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
