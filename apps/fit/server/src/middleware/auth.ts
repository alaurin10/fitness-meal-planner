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

export const requireInternal: RequestHandler = (req, res, next) => {
  const header = req.header("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    res.status(500).json({ error: "INTERNAL_API_SECRET not configured" });
    return;
  }
  if (header !== expected) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
};
