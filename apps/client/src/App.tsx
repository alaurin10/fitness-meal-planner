import { Show } from "@clerk/react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/Dashboard";
import { GroceriesPage } from "./pages/Groceries";
import { MealsPage } from "./pages/Meals";
import { ProfilePage } from "./pages/Profile";
import { ProgressPage } from "./pages/Progress";
import { SignInPage } from "./pages/SignIn";
import { SignUpPage } from "./pages/SignUp";
import { WorkoutsPage } from "./pages/Workouts";

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route
        path="*"
        element={
          <>
            <Show when="signed-in">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/workouts" element={<WorkoutsPage />} />
                <Route path="/meals" element={<MealsPage />} />
                <Route path="/groceries" element={<GroceriesPage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Show>
            <Show when="signed-out">
              <Navigate to="/sign-in" replace />
            </Show>
          </>
        }
      />
    </Routes>
  );
}
