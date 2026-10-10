// Runs before every page: anyone without a session cookie is sent to the login page.
// (Pages still check the session properly with pageUser(); this just makes the redirect instant.)
import { NextResponse } from "next/server";

const PUBLIC = ["/login", "/signup", "/register-society"];

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isPublic && !request.cookies.has("sid")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: skip API routes, Next's own files and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
