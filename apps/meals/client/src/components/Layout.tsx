import { UserButton } from "@clerk/react";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Wordmark } from "./Primitives";

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  return (
    <div
      className="mx-auto max-w-[480px] min-h-screen"
      style={{
        background: "var(--bg)",
        paddingBottom: 110,
        position: "relative",
      }}
    >
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-3"
        style={{
          background: "color-mix(in srgb, var(--bg) 88%, transparent)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Wordmark app="meals" />
        <UserButton />
      </header>
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
