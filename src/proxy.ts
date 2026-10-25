import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const path = url.pathname;

  if (path === "/signup" || path.startsWith("/signup/")) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  const isAuthenticated = Boolean(session);

  if (path === "/login" && isAuthenticated) {
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  if ((path.startsWith("/dashboard") || path === "/admin" || path.startsWith("/admin/")) && !isAuthenticated) {
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
