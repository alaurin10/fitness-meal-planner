import { UserProfile, useClerk } from "@clerk/react";
import { Button } from "../../components/Button";
import { useClerkAppearance } from "../../lib/clerkAppearance";

/**
 * Embedded Clerk account management (email, password, security, sessions).
 * Hash routing keeps Clerk's internal navigation out of React Router's way.
 */
export function AccountTab() {
  const { signOut } = useClerk();
  const appearance = useClerkAppearance();

  return (
    <div className="px-4 pt-2">
      <UserProfile routing="hash" appearance={appearance} />
      <Button
        variant="ghost"
        className="w-full"
        style={{ marginTop: 16 }}
        onClick={() => void signOut()}
      >
        Sign out
      </Button>
    </div>
  );
}
