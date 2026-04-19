import { SignIn } from "@clerk/react";
import { Wordmark } from "../components/Primitives";

export function SignInPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{
        background:
          "radial-gradient(1200px 800px at 10% -10%, color-mix(in srgb, var(--moss) 8%, transparent), transparent), radial-gradient(900px 700px at 110% 110%, color-mix(in srgb, var(--accent) 6%, transparent), transparent), var(--bg)",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <Wordmark app="meals" />
      </div>
      <SignIn signUpUrl="/sign-up" routing="path" path="/sign-in" />
    </div>
  );
}
