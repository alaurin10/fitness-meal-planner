import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/Dashboard";
import { PlanPage } from "./pages/Plan";
import { ProfilePage } from "./pages/Profile";
import { ProgressPage } from "./pages/Progress";
import { SignInPage } from "./pages/SignIn";

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route
        path="*"
        element={
          <>
            <SignedIn>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
    </Routes>
  );
}
