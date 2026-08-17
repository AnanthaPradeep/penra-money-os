import { logOutAction } from "@/lib/auth/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

/**
 * Server Action bound directly to the form — a POST-based, state-changing
 * operation, never a plain GET link. No Client Component wrapper needed
 * here beyond the shared `SubmitButton`'s own pending-state handling.
 */
export function LogoutButton() {
  return (
    <form action={logOutAction}>
      <SubmitButton pendingText="Logging out…">Log out</SubmitButton>
    </form>
  );
}
