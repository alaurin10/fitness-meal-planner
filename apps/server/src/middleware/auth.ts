import type { RequestHandler } from "express";
import { clerkMiddleware, getAuth, requireAuth as clerkRequireAuth } from "@clerk/express";

export const clerkAuth = clerkMiddleware();
export const requireAuth = clerkRequireAuth();

export function currentUserId(req: Parameters<RequestHandler>[0]): string {
  const auth = getAuth(req);
  if (!auth.userId) {
    throw new Error("No user on authenticated request");
  }
  return auth.userId;
}
