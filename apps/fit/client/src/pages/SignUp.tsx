import { SignUp } from "@clerk/react";

export function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <SignUp signInUrl="/sign-in" routing="path" path="/sign-up" />
    </div>
  );
}
