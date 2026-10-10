// Creating student accounts: used by plain sign-up AND by "register your society" for new people.
import db from "./db";
import { nowStamp } from "./format";
import { hashPassword } from "./session";

// Returns { error, status } if invalid, otherwise { id } of the new (pending) account.
export async function createStudentAccount(b) {
  const name = String(b.name ?? "").trim();
  const studentNumber = String(b.studentNumber ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");

  const errors = [];
  if (name.length < 2 || name.length > 60) errors.push("Enter your full name.");
  if (!/^\d{8}$/.test(studentNumber)) errors.push("Student number must be exactly 8 digits.");
  if (!/^[^\s@]+@ucdconnect\.ie$/.test(email)) errors.push("Use your UCD student email (…@ucdconnect.ie).");
  if (password.length < 8) errors.push("Password must be at least 8 characters.");
  if (errors.length) return { error: errors.join(" "), status: 400 };

  // Reserve the student number and email atomically (HSETNX), so two sign-ups at the same moment can't both win.
  const id = await db.nextId("users");
  if (!(await db.claim("users_student_number", studentNumber, id))) {
    return { error: "An account with this student number already exists. Log in instead.", status: 409 };
  }
  if (!(await db.claim("users_email", email, id))) {
    await db.release("users_student_number", studentNumber);
    return { error: "An account with this email already exists. Log in instead.", status: 409 };
  }

  await db.set("users", id, {
    id, name, student_number: studentNumber, email, password_hash: hashPassword(password),
    role: "student", status: "pending", review_note: null, is_demo: 0, society_id: null,
    created_at: nowStamp(), google_refresh_token: null, google_email: null,
  });
  return { id };
}
