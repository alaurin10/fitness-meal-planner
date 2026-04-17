import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { useLogProgress, useProgress } from "../hooks/useProgress";

export function ProgressPage() {
  const { data: logs, isLoading } = useProgress();
  const log = useLogProgress();
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  return (
    <Layout title="Progress">
      <Card>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            log.mutate(
              {
                weightLbs: weight ? Number(weight) : null,
                note: note || undefined,
              },
              {
                onSuccess: () => {
                  setWeight("");
                  setNote("");
                },
              },
            );
          }}
        >
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">
              Weight (lbs)
            </span>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">
              Note
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text focus:border-accent focus:outline-none"
            />
          </label>
          <Button type="submit" disabled={log.isPending}>
            {log.isPending ? "Logging…" : "Log entry"}
          </Button>
        </form>
      </Card>

      {isLoading && <Card>Loading history…</Card>}
      {logs && logs.length > 0 && (
        <Card>
          <p className="text-xs uppercase tracking-widest text-muted mb-3">
            Recent
          </p>
          <ul className="space-y-2 text-sm">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-start justify-between gap-3 border-b border-border last:border-b-0 pb-2 last:pb-0"
              >
                <div>
                  <p>{new Date(l.loggedAt).toLocaleDateString()}</p>
                  {l.note && (
                    <p className="text-muted text-xs">{l.note}</p>
                  )}
                </div>
                <div className="text-right text-muted shrink-0">
                  {l.weightLbs != null && <div>{l.weightLbs} lb</div>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Layout>
  );
}
