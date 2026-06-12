import { useSearchParams } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { PhoneHeader } from "../../components/Primitives";
import { SegmentedControl } from "../../components/SegmentedControl";
import { AccountTab } from "./AccountTab";
import { ProfileTab } from "./ProfileTab";
import { SettingsTab } from "./SettingsTab";

type HubTab = "profile" | "settings" | "account";

const TAB_OPTIONS = [
  { value: "profile", label: "Profile" },
  { value: "settings", label: "Settings" },
  { value: "account", label: "Account" },
] as const;

const TAB_COPY: Record<HubTab, { title: string; subtitle: string }> = {
  profile: {
    title: "Profile",
    subtitle: "Shapes your weekly plans and daily targets.",
  },
  settings: {
    title: "Settings",
    subtitle: "Global preferences. Changes apply and save automatically.",
  },
  account: {
    title: "Account",
    subtitle: "Sign-in details, security, and sessions.",
  },
};

/**
 * Single hub for everything about the user: the fitness/nutrition profile,
 * app-wide settings, and Clerk account management. Tab state lives in the
 * `?tab=` search param so each tab is deep-linkable (and /settings can
 * redirect here) without changing the pathname.
 */
export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: HubTab =
    tabParam === "settings" || tabParam === "account" ? tabParam : "profile";

  const switchTab = (next: HubTab) => {
    // Replace instead of push so Back leaves the hub rather than unwinding
    // every tab click. The default tab keeps a clean URL.
    setSearchParams(next === "profile" ? {} : { tab: next }, { replace: true });
  };

  return (
    <Layout>
      <PhoneHeader title={TAB_COPY[tab].title} subtitle={TAB_COPY[tab].subtitle} />

      <div className="px-4 pb-3">
        <SegmentedControl
          options={TAB_OPTIONS}
          value={tab}
          onChange={switchTab}
          aria-label="Profile sections"
          className="w-full"
        />
      </div>

      {tab === "profile" && <ProfileTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "account" && <AccountTab />}
    </Layout>
  );
}
