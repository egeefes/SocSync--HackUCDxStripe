// Student home: connect / sync / disconnect Google Calendar.
import ActionButton from "./ActionButton";

export default function GoogleCalendarCard({ configured, email, syncedCount, ucdEmail }) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        <p className="font-semibold">📅 Google Calendar</p>
        {email ? (
          <p className="text-muted">
            Connected to <b>{email}</b> · {syncedCount} upcoming {syncedCount === 1 ? "event" : "events"} in your calendar.
            Events you RSVP to or buy tickets for are added automatically.
          </p>
        ) : (
          <p className="text-muted">
            Connect your UCD Google account ({ucdEmail || "…@ucdconnect.ie"}) and every event you RSVP to or buy a ticket for
            appears in your Google Calendar automatically.
          </p>
        )}
      </div>
      {!configured ? (
        <span className="text-xs text-muted">Not set up yet (GOOGLE_CLIENT_ID missing in .env.local)</span>
      ) : email ? (
        <div className="flex gap-2">
          <ActionButton endpoint="/api/google/sync" variant="secondary">Sync now</ActionButton>
          <ActionButton endpoint="/api/google/disconnect" variant="secondary">Disconnect</ActionButton>
        </div>
      ) : (
        // A plain link, not fetch: the browser has to actually go to Google's sign-in page.
        <a href="/api/google/connect" className="btn-primary">Connect Google Calendar</a>
      )}
    </div>
  );
}
