import Link from "next/link";
import QRCode from "qrcode";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import type { EventView, Ticket } from "@/lib/types";
import { parts } from "@/lib/format";
import { CancelTicketButton } from "./CancelTicketButton";

export async function TicketCard({ event, ticket, past }: { event: EventView; ticket: Ticket; past: boolean }) {
  const qr = await QRCode.toString(ticket.code, { type: "svg", margin: 1, width: 132, color: { dark: "#202039", light: "#ffffff" } });
  const p = parts(event.startsAt);
  return <article className={`ticket-card ${past ? "past" : ""}`}>
    <div className="ticket-main">
      <div className="ticket-top"><span className={`ticket-kind ${ticket.kind}`}>{ticket.kind === "paid" ? "PAID TICKET" : "FREE · RESERVED"}</span>{past && <span className="ticket-kind past">PAST EVENT</span>}</div>
      <span className="event-society">{event.societyName}</span>
      <h3><Link href={`/events/${event.id}`}>{event.title}</Link></h3>
      <div className="ticket-meta">
        <span><CalendarDays size={14}/>{p.long}</span><span><Clock3 size={14}/>{p.time}</span><span><MapPin size={14}/>{event.location}</span>
      </div>
      <div className="ticket-code"><span>TICKET CODE</span><strong>{ticket.code}</strong></div>
      {ticket.kind === "reserved" && !past && <CancelTicketButton ticketId={ticket.id}/>}
    </div>
    <div className="ticket-qr"><div dangerouslySetInnerHTML={{ __html: qr }} aria-label={`QR code for ticket ${ticket.code}`} role="img"/><small>Show this at the door</small></div>
  </article>;
}
