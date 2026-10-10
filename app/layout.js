import { DM_Sans, Manrope } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import "./campus.css";
import { getCurrentUser } from "@/lib/session";
import { platformStats } from "@/lib/queries";
import Shell from "@/components/Shell";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata = {
  title: "SocSync: every society event in one calendar",
  description: "Find, follow, join and rate UCD society events.",
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();
  const stats = user?.role === "platform" ? await platformStats() : null;
  const pendingCount = stats ? stats.pending_users + stats.pending_societies : 0;

  return (
    <html lang="en" className={`${dmSans.variable} ${manrope.variable} antialiased`}>
      <body>
        {user ? (
          <Suspense>
            <Shell user={{ name: user.name, role: user.role, status: user.status, society_id: user.society_id }} pendingCount={pendingCount}>
              {user.status === "pending" && (
                <div className="banner pending-banner">
                  <div>
                    <strong>Your account is waiting for verification</strong>
                    <span>You can browse and follow societies now. RSVPs, tickets, memberships and reviews unlock once the SocSync admin verifies you.</span>
                  </div>
                </div>
              )}
              {user.status === "rejected" && (
                <div className="banner rejected-banner">
                  <div><strong>Your account could not be verified</strong><span>{user.review_note}</span></div>
                </div>
              )}
              {children}
            </Shell>
          </Suspense>
        ) : (
          // Logged out: only the login / sign-up pages, on a soft background, no menu.
          <main className="auth-page">{children}</main>
        )}
      </body>
    </html>
  );
}
