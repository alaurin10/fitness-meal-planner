import { SignUp } from "@clerk/react";
import { Wordmark } from "../components/Primitives";

export function SignUpPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{
        background:
          "radial-gradient(1200px 800px at 10% -10%, color-mix(in srgb, var(--accent) 8%, transparent), transparent), radial-gradient(900px 700px at 110% 110%, color-mix(in srgb, var(--moss) 6%, transparent), transparent), var(--bg)",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <Wordmark app="fit" />
      </div>
      <SignUp signInUrl="/sign-in" routing="path" path="/sign-up" />
    </div>
  );
}
