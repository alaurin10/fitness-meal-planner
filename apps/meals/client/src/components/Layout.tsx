import { UserButton } from "@clerk/react";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface Props {
  title: string;
  children: ReactNode;
}

export function Layout({ title, children }: Props) {
  return (
    <div className="mx-auto max-w-[480px] min-h-screen bg-bg pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-bg/90 backdrop-blur border-b border-border">
        <h1 className="text-xl text-text">{title}</h1>
        <UserButton />
      </header>
      <main className="px-4 py-4 space-y-4">{children}</main>
      <BottomNav />
    </div>
  );
}
