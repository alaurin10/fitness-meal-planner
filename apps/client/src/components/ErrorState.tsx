import { Button } from "./Button";
import { Card } from "./Card";
import { Icon } from "./Icon";

/**
 * Standardized error display with an optional retry action. Replaces the ad-hoc
 * red text scattered across pages, and gives the user a way to recover.
 */
export function ErrorState({
  error,
  title = "Something went wrong",
  onRetry,
  retrying = false,
  compact = false,
}: {
  /** An Error, a string, or anything — falls back to a generic message. */
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Inline variant for use under a form/control rather than a full card. */
  compact?: boolean;
}) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string" && error.trim()
        ? error
        : "Please try again in a moment.";

  if (compact) {
    return (
      <div
        role="alert"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 6,
        }}
      >
        <span style={{ color: "var(--rose)", fontSize: 12.5 }}>{message}</span>
        {onRetry && (
          <Button variant="ghost" onClick={onRetry} disabled={retrying} style={{ padding: "4px 10px", fontSize: 12.5 }}>
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--rose)" }}>
          <Icon name="x" size={18} />
          <span className="font-display" style={{ fontSize: 17, color: "var(--ink)" }}>
            {title}
          </span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>{message}</div>
        {onRetry && (
          <div>
            <Button variant="primary" onClick={onRetry} disabled={retrying}>
              <Icon name="sparkle" size={14} />
              {retrying ? "Retrying…" : "Try again"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
