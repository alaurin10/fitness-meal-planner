import { Show } from "@clerk/react";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ScrollToTop } from "./components/ScrollToTop";
import { SkeletonList } from "./components/Skeleton";

// Lazy-load route pages so each ships in its own chunk and the initial bundle
// stays small. Sign-in/up stay eager since they're the entry point.
import { SignInPage } from "./pages/SignIn";
import { SignUpPage } from "./pages/SignUp";

const DashboardPage = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.DashboardPage })));
const WorkoutsPage = lazy(() => import("./pages/Workouts").then((m) => ({ default: m.WorkoutsPage })));
const MealsPage = lazy(() => import("./pages/Meals").then((m) => ({ default: m.MealsPage })));
const RecipeDetailPage = lazy(() => import("./pages/RecipeDetail").then((m) => ({ default: m.RecipeDetailPage })));
const RecipesPage = lazy(() => import("./pages/Recipes").then((m) => ({ default: m.RecipesPage })));
const RecipeEditorPage = lazy(() => import("./pages/RecipeEditor").then((m) => ({ default: m.RecipeEditorPage })));
const RecipeViewPage = lazy(() => import("./pages/RecipeView").then((m) => ({ default: m.RecipeViewPage })));
const GroceriesPage = lazy(() => import("./pages/Groceries").then((m) => ({ default: m.GroceriesPage })));
const ProgressPage = lazy(() => import("./pages/Progress").then((m) => ({ default: m.ProgressPage })));
const ProfilePage = lazy(() => import("./pages/profile/ProfileHub").then((m) => ({ default: m.ProfilePage })));

function RouteFallback() {
  return (
    <Layout>
      <SkeletonList count={3} />
    </Layout>
  );
}

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
              <ScrollToTop />
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/workouts" element={<WorkoutsPage />} />
                  <Route path="/meals" element={<MealsPage />} />
                  <Route path="/meals/:weekStart/:day/:index" element={<RecipeDetailPage />} />
                  <Route path="/recipes" element={<RecipesPage />} />
                  <Route path="/recipes/new" element={<RecipeEditorPage />} />
                  <Route path="/recipes/:id" element={<RecipeViewPage />} />
                  <Route path="/recipes/:id/edit" element={<RecipeEditorPage />} />
                  <Route path="/groceries" element={<GroceriesPage />} />
                  <Route path="/progress" element={<ProgressPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  {/* Settings now lives in the profile hub; keep old links working. */}
                  <Route path="/settings" element={<Navigate to="/profile?tab=settings" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
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
