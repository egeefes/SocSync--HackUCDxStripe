import Link from "next/link";
import JsonForm from "@/components/JsonForm";
import LoginModal from "@/components/LoginModal";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card space-y-4">
        <div>
          <h1 className="text-xl font-bold">Create a student account</h1>
          <p className="text-sm text-muted">
            The SocSync admin checks every new account, so ratings come from real UCD students.
            Until then you can browse and follow societies.
          </p>
        </div>
        <JsonForm endpoint="/api/auth/signup" submitLabel="Create account">
          <div><span className="label">Full name</span><input name="name" className="input" required /></div>
          <div><span className="label">Student number</span><input name="studentNumber" className="input" inputMode="numeric" placeholder="8 digits, e.g. 23456789" required /></div>
          <div><span className="label">UCD student email</span><input name="email" type="email" className="input" placeholder="firstname.lastname@ucdconnect.ie" required /></div>
          <div><span className="label">Password (8+ characters)</span><input name="password" type="password" className="input" minLength={8} required /></div>
        </JsonForm>
        <p className="text-sm text-muted">Already have an account? <LoginModal triggerLabel="Log in" /></p>
      </div>
      <div className="card text-sm">
        <b>Running a society?</b> <Link href="/register-society" className="text-accent underline">Register your society</Link> instead. It creates your account too.
      </div>
    </div>
  );
}
