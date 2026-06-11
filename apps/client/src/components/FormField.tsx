import { useCallback, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Labeled form field with an announced inline error slot. The input is
 * wrapped by the <label>, so no id wiring is needed; pass `aria-invalid`
 * on the input itself when using field errors.
 */
export function FormField({
  label,
  error,
  required,
  hint,
  children,
  style,
}: {
  label: string;
  error?: string | null;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        marginBottom: 10,
        flex: 1,
        ...style,
      }}
    >
      <span className="eyebrow">
        {label}
        {required && (
          <span aria-hidden style={{ color: "var(--rose)", marginLeft: 3 }}>
            *
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span role="alert" style={{ color: "var(--rose)", fontSize: 12 }}>
          {error}
        </span>
      ) : hint ? (
        <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{hint}</span>
      ) : null}
    </label>
  );
}

type Rules<K extends string> = Record<K, (value: string) => string | null>;

/**
 * Minimal field-error tracking: validate on blur, clear/re-check on change
 * once a field is dirty, and run everything as the submit gate.
 */
export function useFieldErrors<K extends string>(rules: Rules<K>) {
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});

  const validateField = useCallback(
    (field: K, value: string) => {
      const message = rules[field](value);
      setErrors((prev) => {
        if ((prev[field] ?? null) === message) return prev;
        const next = { ...prev };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
      return message === null;
    },
    [rules],
  );

  /** Re-validate on change only after the field already has an error. */
  const revalidateField = useCallback(
    (field: K, value: string) => {
      setErrors((prev) => {
        if (!(field in prev)) return prev;
        const message = rules[field](value);
        const next = { ...prev };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
    },
    [rules],
  );

  const validateAll = useCallback(
    (values: Record<K, string>) => {
      const next: Partial<Record<K, string>> = {};
      for (const field of Object.keys(rules) as K[]) {
        const message = rules[field](values[field]);
        if (message) next[field] = message;
      }
      setErrors(next);
      return Object.keys(next).length === 0;
    },
    [rules],
  );

  return { errors, validateField, revalidateField, validateAll };
}
