import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  actions?: ReactNode;
  id?: string;
};

/** A secondary `<h2>` heading for a section within a page — pairs with `aria-labelledby` on the enclosing `<section>`. */
export function SectionHeader({
  title,
  actions,
  id,
}: Readonly<SectionHeaderProps>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        id={id}
        className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {actions}
    </div>
  );
}
