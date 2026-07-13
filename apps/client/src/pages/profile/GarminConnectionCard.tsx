import { useState, type FormEvent } from "react";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormField } from "../../components/FormField";
import { useToast } from "../../components/Toast";
import {
  useConnectGarmin,
  useDisconnectGarmin,
  useGarminStatus,
  useSyncGarmin,
} from "../../hooks/useGarmin";

function formatLastSync(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * "Connections" settings card: link/unlink a Garmin account and trigger
 * syncs. The connect form posts credentials once; the server keeps only
 * OAuth tokens. This card is the sole Garmin UI users see before connecting.
 */
export function GarminConnectionCard() {
  const status = useGarminStatus();
  const connect = useConnectGarmin();
  const disconnect = useDisconnectGarmin();
  const sync = useSyncGarmin();
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const connected = status.data?.connected ?? false;

  function submitConnect(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setFormError("Enter your Garmin email and password.");
      return;
    }
    setFormError(null);
    connect.mutate(
      { username: username.trim(), password },
      {
        onSuccess: () => {
          setUsername("");
          setPassword("");
          // The initial backfill runs in the background; the status chip below
          // reflects its progress and the data fills in over the next moment.
          toast.success("Garmin connected — syncing your data now.");
        },
        onError: (err) => {
          const axiosMsg = (err as { response?: { data?: { error?: string } } }).response?.data
            ?.error;
          setFormError(axiosMsg ?? (err as Error).message);
          setPassword("");
        },
      },
    );
  }

  function runSync() {
    sync.mutate(
      { force: true },
      {
        onSuccess: (result) => {
          if (result.skipped) {
            toast.success("Already up to date.");
          } else if (result.errors.length > 0) {
            toast.error(`Sync finished with issues: ${result.errors[0]}`);
          } else {
            toast.success(
              `Synced — ${result.wellnessDays} days of health data, ${result.activitiesImported} activities, ${result.weightsImported} weigh-ins.`,
            );
          }
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  }

  return (
    <Card>
      <div className="eyebrow">Connections</div>
      <div className="font-display" style={{ fontSize: 24, color: "var(--ink)", marginTop: 6 }}>
        Garmin watch
      </div>

      {!connected ? (
        <>
          <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
            Pull steps, calories burned, heart rate, sleep, activities, and weigh-ins from your
            Garmin watch — and send your weekly workouts to it. We sign in once and store only
            sign-in tokens, never your password. Accounts with two-factor authentication aren't
            supported yet.
          </div>
          <form onSubmit={submitConnect} style={{ marginTop: 14 }}>
            <FormField label="Garmin email" error={null}>
              <input
                className="field-input"
                type="email"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@example.com"
              />
            </FormField>
            <FormField label="Garmin password" error={formError}>
              <input
                className="field-input"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>
            <Button type="submit" disabled={connect.isPending} style={{ marginTop: 4 }}>
              {connect.isPending ? "Connecting…" : "Connect Garmin"}
            </Button>
          </form>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
            Connected{status.data?.garminUserId ? ` as ${status.data.garminUserId}` : ""}. Health
            data syncs automatically when you open the app; use Sync now after a fresh watch
            upload.
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12.5 }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  status.data?.lastSyncStatus === "error" ? "var(--rose)" : "var(--accent)",
              }}
            />
            <span style={{ color: "var(--sumi)", fontWeight: 600 }}>
              {status.data?.lastSyncStatus === "syncing" || sync.isPending
                ? "Syncing…"
                : `Last sync ${formatLastSync(status.data?.lastSyncAt)}`}
            </span>
          </div>
          {status.data?.lastSyncStatus === "error" && status.data.lastSyncError && (
            <div role="alert" style={{ color: "var(--rose)", fontSize: 12.5, marginTop: 8 }}>
              {status.data.lastSyncError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button onClick={runSync} disabled={sync.isPending}>
              {sync.isPending ? "Syncing…" : "Sync now"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
              Disconnect
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        options={{
          title: "Disconnect Garmin?",
          message:
            "Your synced activities and health data stay in the app, but syncing stops until you reconnect.",
          confirmLabel: "Disconnect",
          destructive: true,
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          disconnect.mutate(undefined, {
            onSuccess: () => toast.success("Garmin disconnected."),
            onError: (err) => toast.error((err as Error).message),
          });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}
