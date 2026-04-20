import { UserButton } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { useApi } from "../lib/api";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { Wordmark } from "./Primitives";

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();

  useEffect(() => {
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
  }, [api, queryClient]);

  return (
    <>
      <SideNav />
      <div
        className="mx-auto max-w-[480px] min-h-screen relative pb-[110px] md:max-w-none md:ml-[220px] md:pb-6"
        style={{ background: "var(--bg)" }}
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 md:hidden"
          style={{
            background: "color-mix(in srgb, var(--bg) 88%, transparent)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Wordmark />
          <UserButton />
        </header>
        <main className="md:max-w-[960px] md:mx-auto">{children}</main>
        <BottomNav />
      </div>
    </>
  );
}
