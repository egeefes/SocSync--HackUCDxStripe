// Creating student accounts: used by plain sign-up AND by "register your society" for new people.
import db from "./db";
import { hashPassword } from "./session";

// Returns { error, status } if invalid, otherwise { id } of the new (pending) account.
export function createStudentAccount(b) {
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

  if (db.prepare("SELECT 1 FROM users WHERE student_number = ?").get(studentNumber)) {
    return { error: "An account with this student number already exists. Log in instead.", status: 409 };
  }
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    return { error: "An account with this email already exists. Log in instead.", status: 409 };
  }

  const result = db
    .prepare(
      `INSERT INTO users (name, student_number, email, password_hash, role, status, created_at)
       VALUES (?, ?, ?, ?, 'student', 'pending', datetime('now'))`
    )
    .run(name, studentNumber, email, hashPassword(password));
  return { id: Number(result.lastInsertRowid) };
}
