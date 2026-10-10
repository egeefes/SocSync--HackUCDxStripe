// Ticket with a QR code (CampusLoop design). Two kinds:
//   paid     - bought through Stripe; the code is derived from the Stripe payment
//   reserved - free event RSVP; the code is derived from the event + student
// The committee could scan the QR at the door. (Door scanning itself isn't built yet.)
import crypto from "node:crypto";
import Link from "next/link";
import QRCode from "qrcode";
import { CalendarDays, MapPin } from "lucide-react";
import ActionButton from "./ActionButton";
import { euro, when, nowLocal } from "@/lib/format";

const check = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 6).toUpperCase();

export function ticketCode(t) {
  if (t.kind === "reserved") return `SS-R${String(t.event_id).padStart(4, "0")}-${String(t.user_id).padStart(4, "0")}-${check(`rsvp:${t.event_id}:${t.user_id}`)}`;
  return `SS-T${String(t.payment_id).padStart(5, "0")}-${check(t.stripe_session_id)}`;
}

export default async function TicketCard({ t }) {
  const reserved = t.kind === "reserved";
  const code = ticketCode(t);
  const qr = await QRCode.toDataURL(code, { margin: 1, width: 232, color: { dark: "#292443", light: "#fdfcff" } });
  const past = t.start < nowLocal();
  return (
    <div className={`ticket-card ${past ? "past" : ""}`}>
      <div className="ticket-main">
        <div className="ticket-top">
          <span className={`ticket-kind ${reserved ? "reserved" : "paid"}`}>{reserved ? "FREE · RESERVED" : "PAID TICKET"}</span>
          {past && <span className="ticket-kind past">PAST EVENT</span>}
        </div>
        <h3><Link href={`/events/${t.event_id}`}>{t.title}</Link></h3>
        <div className="ticket-meta">
          <span><CalendarDays size={13} />{when(t.start)}</span>
          <span><MapPin size={13} />{t.venue}</span>
        </div>
        <div className="ticket-meta"><span>{t.society_name}{reserved ? " · Free" : ` · ${euro(t.amount_cents)}`}</span></div>
        <div className="ticket-code"><span>TICKET CODE</span><strong>{code}</strong></div>
        {reserved && !past && (
          <ActionButton endpoint="/api/rsvp" body={{ eventId: t.event_id }} variant="secondary">Cancel reservation</ActionButton>
        )}
      </div>
      <div className="ticket-qr">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated data-URL QR code */}
        <img src={qr} alt={`QR code for ticket ${code}`} />
        <small>Show at the door</small>
      </div>
    </div>
  );
}
