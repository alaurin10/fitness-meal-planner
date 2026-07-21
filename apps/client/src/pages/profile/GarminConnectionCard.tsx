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
  useImportGarminTokens,
  useSubmitGarminMfa,
  useSyncGarmin,
} from "../../hooks/useGarmin";

function axiosErrorMessage(err: unknown): string {
  const axiosMsg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
  return axiosMsg ?? (err as Error).message;
}

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
  const submitMfa = useSubmitGarminMfa();
  const importTokens = useImportGarminTokens();
  const disconnect = useDisconnectGarmin();
  const sync = useSyncGarmin();
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // "credentials" → (if the account has 2FA) "mfa" → connected. "import" is a
  // fallback for when Garmin rate-limits sign-ins from the server's IP: the
  // user signs in from their own computer and pastes the exported tokens.
  const [step, setStep] = useState<"credentials" | "mfa" | "import">("credentials");
  const [mfaCode, setMfaCode] = useState("");
  const [tokenJson, setTokenJson] = useState("");

  const connected = status.data?.connected ?? false;

  function resetForm() {
    setUsername("");
    setPassword("");
    setMfaCode("");
    setTokenJson("");
    setFormError(null);
    setStep("credentials");
  }

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
        onSuccess: (data) => {
          setPassword("");
          if (data.mfaRequired) {
            // 2FA account: advance to the code step. Garmin has just sent a code.
            setStep("mfa");
            toast.success("Garmin sent a verification code — enter it to finish.");
            return;
          }
          resetForm();
          // The initial backfill runs in the background; the status chip below
          // reflects its progress and the data fills in over the next moment.
          toast.success("Garmin connected — syncing your data now.");
        },
        onError: (err) => {
          setFormError(axiosErrorMessage(err));
          setPassword("");
        },
      },
    );
  }

  function submitMfaCode(e: FormEvent) {
    e.preventDefault();
    const code = mfaCode.trim();
    if (!/^\d{4,10}$/.test(code)) {
      setFormError("Enter the numeric code Garmin sent you.");
      return;
    }
    setFormError(null);
    submitMfa.mutate(
      { code },
      {
        onSuccess: () => {
          resetForm();
          toast.success("Garmin connected — syncing your data now.");
        },
        onError: (err) => {
          setFormError(axiosErrorMessage(err));
          setMfaCode("");
        },
      },
    );
  }

  function submitImport(e: FormEvent) {
    e.preventDefault();
    const raw = tokenJson.trim();
    if (!raw) {
      setFormError("Paste the token JSON printed by the export script.");
      return;
    }
    setFormError(null);
    importTokens.mutate(
      { tokens: raw },
      {
        onSuccess: () => {
          resetForm();
          toast.success("Garmin connected — syncing your data now.");
        },
        onError: (err) => setFormError(axiosErrorMessage(err)),
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
        step === "credentials" ? (
          <>
            <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
              Pull steps, calories burned, heart rate, sleep, activities, and weigh-ins from your
              Garmin watch — and send your weekly workouts to it. We sign in once and store only
              sign-in tokens, never your password. If your account uses two-factor
              authentication, we'll ask for the code Garmin sends you.
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
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setStep("import");
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                marginTop: 12,
                fontSize: 12.5,
                color: "var(--sumi)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Sign-in blocked or rate-limited? Import tokens from your computer instead.
            </button>
          </>
        ) : step === "mfa" ? (
          <>
            <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
              Enter the verification code Garmin just sent you (via your authenticator app, email,
              or text) to finish connecting. The code expires after a few minutes.
            </div>
            <form onSubmit={submitMfaCode} style={{ marginTop: 14 }}>
              <FormField label="Verification code" error={formError}>
                <input
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                  autoFocus
                />
              </FormField>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Button type="submit" disabled={submitMfa.isPending}>
                  {submitMfa.isPending ? "Verifying…" : "Verify code"}
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Start over
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
              Garmin sometimes rate-limits sign-ins coming from cloud servers like this one, even
              when your password is correct. The workaround: sign in from your own computer and
              paste the resulting tokens here. In a checkout of this project, run:
            </div>
            <pre
              style={{
                marginTop: 10,
                padding: "8px 10px",
                background: "var(--paper, rgba(0,0,0,0.05))",
                borderRadius: 8,
                fontSize: 12,
                overflowX: "auto",
              }}
            >
              pnpm --filter @app/server garmin:export-tokens
            </pre>
            <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 10, lineHeight: 1.5 }}>
              It signs you in from your home connection (including the two-factor code) and prints
              a one-line token JSON — paste that below. Tokens are stored encrypted, your password
              never leaves your computer, and the connection lasts about a year.
            </div>
            <form onSubmit={submitImport} style={{ marginTop: 14 }}>
              <FormField label="Token JSON" error={formError}>
                <textarea
                  className="field-input"
                  rows={4}
                  value={tokenJson}
                  onChange={(e) => setTokenJson(e.target.value)}
                  placeholder='{"oauth1":{...},"oauth2":{...}}'
                  spellCheck={false}
                  style={{ fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
                />
              </FormField>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Button type="submit" disabled={importTokens.isPending}>
                  {importTokens.isPending ? "Connecting…" : "Import & connect"}
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Back
                </Button>
              </div>
            </form>
          </>
        )
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
            Connected{status.data?.garminUserId ? ` as ${status.data.garminUserId}` : ""}. Health
            data syncs automatically while the app is open — on launch, every 15 minutes, and each
            time you return to it. Use Sync now to pull the very latest right after a watch upload.
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
