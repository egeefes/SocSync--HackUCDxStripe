
import db from "@/lib/db";
import { startSession, homeFor } from "@/lib/session";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = Number(body.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return Response.json(
        { error: "Choose a valid demo account and try again." },
        { status: 400 }
      );
    }

    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(userId);

    if (!user) {
      return Response.json(
        {
          error:
            "Demo account not found. The database may not have been initialized."
        },
        { status: 404 }
      );
    }

    if (!user.is_demo) {
      return Response.json(
        {
          error:
            "Only seeded demo accounts can log in without a password."
        },
        { status: 403 }
      );
    }

    await startSession(user.id);

    return Response.json({
      ok: true,
      redirect: homeFor(user),
    });
  } catch (error) {
    console.error("Demo login failed:", error);

    return Response.json(
      {
        error:
          "Demo login failed on the server. Check the Vercel Runtime Logs."
      },
      { status: 500 }
    );
  }
}
