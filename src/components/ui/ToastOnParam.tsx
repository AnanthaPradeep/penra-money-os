"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

type ToastOnParamProps = {
  /** Query param name to watch for, e.g. "created". */
  param: string;
  message: string;
};

/**
 * Fires a success toast when the given query param is present, then strips
 * it from the URL so a refresh doesn't re-fire it. Exists because every
 * create/archive/reverse Server Action in this app redirects on success
 * (see src/lib/accounts/actions.ts, src/lib/ledger/actions.ts) rather than
 * returning a state the destination page could read directly — the toast
 * is triggered by a short-lived query param on the page it lands on
 * instead. Calling `toast()` here is synchronising with sonner's external
 * toast manager, which is exactly what an effect is for.
 */
export function ToastOnParam({ param, message }: Readonly<ToastOnParamProps>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const value = searchParams.get(param);

  useEffect(() => {
    if (!value) {
      return;
    }
    toast.success(message);
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    // Only re-run when the watched param's value actually changes — the
    // other values (pathname, router, searchParams object identity) are
    // stable/derived and re-running on their identity churn would risk a
    // duplicate toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return null;
}
