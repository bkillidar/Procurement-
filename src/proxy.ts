import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// Every page, form and action needs a signed-in account (see docs/SECURITY.md).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
