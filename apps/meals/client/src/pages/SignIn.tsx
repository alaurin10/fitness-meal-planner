import { SignIn } from "@clerk/react";

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <SignIn signUpUrl="/sign-up" routing="path" path="/sign-in" />
    </div>
  );
}
