"use client";
// Week/month/list calendar (FullCalendar). Clicking an event opens its page.
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import { useRouter } from "next/navigation";

// One colour per society category, so the calendar is scannable.
const COLOURS = {
  "Languages & Culture": "#4b78b6",
  Business: "#c99a2e",
  "Sport & Outdoors": "#3d916b",
  "Arts & Performance": "#c65d8a",
  "Academic & Tech": "#6f55e8",
  "Social & Hobbies": "#d86d5c",
};

export default function Calendar({ events }) {
  const router = useRouter();
  return (
    <div className="card">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,dayGridMonth,listWeek" }}
        buttonText={{ today: "Today", week: "Week", month: "Month", list: "List" }}
        firstDay={1}
        dayHeaderFormat={{ weekday: "short", day: "numeric" }}
        titleFormat={{ day: "numeric", month: "short", year: "numeric" }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        scrollTime="12:00:00"
        slotMinTime="08:00:00"
        slotMaxTime="24:00:00"
        allDaySlot={false}
        height="auto"
        nowIndicator
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        events={events.map((e) => ({
          id: String(e.id),
          title: `${e.title} · ${e.society_name}`,
          start: e.start,
          end: e.end || undefined,
          backgroundColor: COLOURS[e.category],
          borderColor: COLOURS[e.category],
        }))}
        eventClick={(info) => router.push(`/events/${info.event.id}`)}
      />
    </div>
  );
}

export { COLOURS };
