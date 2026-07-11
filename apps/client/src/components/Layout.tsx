import { useAuth, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../lib/api";
import { useSettings } from "../hooks/useSettings";
import { useScrolled } from "../hooks/useScrolled";
import { useSyncServerTheme } from "../lib/theme";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { Icon } from "./Icon";
import { Wordmark } from "./Primitives";

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const settings = useSettings();
  useSyncServerTheme(settings.data?.theme);
  const scrolled = useScrolled();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const warmNavigation = async () => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: ["profile"],
          queryFn: async () => (await api.get("/api/profile")).data,
        }),
        queryClient.prefetchQuery({
          queryKey: ["settings"],
          queryFn: async () => (await api.get("/api/settings")).data.settings,
        }),
        queryClient.prefetchQuery({
          queryKey: ["workouts", "current"],
          queryFn: async () => (await api.get("/api/workouts/current")).data.plan,
        }),
        queryClient.prefetchQuery({
          queryKey: ["meals", "current"],
          queryFn: async () => (await api.get("/api/meals/current")).data.plan,
        }),
        queryClient.prefetchQuery({
          queryKey: ["groceries"],
          queryFn: async () => (await api.get("/api/groceries/current")).data.list,
        }),
        queryClient.prefetchQuery({
          queryKey: ["progress"],
          queryFn: async () => (await api.get("/api/progress")).data.logs,
        }),
      ]);
    };

    void warmNavigation().catch(() => {
      // Ignore prefetch misses and let the page-level queries handle errors.
    });
  }, [api, queryClient, isLoaded, isSignedIn]);

  return (
    <>
      {/* Ambient color field behind everything — gives the glass chrome
          something to refract; blur over a flat background is invisible. */}
      <div aria-hidden className="ambient-bg" />
      <SideNav />
      {/* Flex column at min-h-dvh so the in-flow sticky BottomNav sits at the
          viewport bottom even on short pages (dvh dodges the iOS 100vh gap). */}
      <div className="mx-auto max-w-[480px] min-h-dvh relative flex flex-col md:max-w-none md:ml-[220px]">
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 md:hidden"
          style={{
            background: scrolled
              ? "var(--glass-bg)"
              : "color-mix(in srgb, var(--bg) 30%, transparent)",
            backdropFilter: "blur(var(--glass-blur)) saturate(1.7)",
            WebkitBackdropFilter: "blur(var(--glass-blur)) saturate(1.7)",
            // Hairline + soft ambient shadow fade in once the page scrolls.
            // Both states keep the same layer count so the transition tweens
            // instead of snapping; a border would shift layout by 1px.
            boxShadow: scrolled
              ? "0 1px 0 var(--glass-border), 0 6px 20px rgba(0, 0, 0, 0.06)"
              : "0 1px 0 transparent, 0 6px 20px rgba(0, 0, 0, 0)",
            transition: "box-shadow 220ms ease, background 220ms ease",
          }}
        >
          <Wordmark />
          <Link to="/profile" aria-label="Profile" className="tappable" viewTransition>
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt=""
                width={32}
                height={32}
                style={{
                  display: "block",
                  borderRadius: "50%",
                  border: "1px solid var(--hair)",
                }}
              />
            ) : (
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1px solid var(--hair)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--sumi)",
                }}
              >
                <Icon name="profile" size={16} />
              </span>
            )}
          </Link>
        </header>
        {/* overflow-x-clip keeps the page-hero glow's horizontal bleed from
            creating a sideways scroll without clipping vertical shadows. */}
        <main className="relative flex-1 w-full overflow-x-clip pb-4 md:max-w-[960px] md:mx-auto md:pb-6">{children}</main>
        <BottomNav />
      </div>
    </>
  );
}
