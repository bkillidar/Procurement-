import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, isPublicPath, safeEqual } from "@/lib/access";

// Optional shared-password gate (see docs/SECURITY.md). With APP_ACCESS_PASSWORD unset the
// app is open, which is the V1 default. With it set, every page and action needs the cookie.
export async function proxy(request: NextRequest) {
  const password = process.env.APP_ACCESS_PASSWORD;
  if (!password || isPublicPath(request.nextUrl.pathname)) return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await accessToken(password))) return NextResponse.next();

  if (request.method !== "GET") {
    // A form/action POST without access: refuse rather than redirect.
    return new NextResponse("Locked", { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
