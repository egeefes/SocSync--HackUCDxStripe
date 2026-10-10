// A society's home page (CampusLoop design): cover banner + logo, about us, committee, events,
// membership (pay to join via Stripe), reviews of the society + its events, AI review summary.
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Check, Star, Users } from "lucide-react";
import ActionButton from "@/components/ActionButton";
import ReviewSummary from "@/components/ReviewSummary";
import Flash from "@/components/Flash";
import EventCard from "@/components/EventCard";
import InstagramTag from "@/components/InstagramTag";
import SocietyAvatar from "@/components/SocietyAvatar";
import SocietyReviewForm from "@/components/SocietyReviewForm";
import { RatingBadge, Stars } from "@/components/Stars";
import { pageUser } from "@/lib/session";
import { getSociety, listEvents, societyReviews, societyOwnReviews, societyReviewBlockReason } from "@/lib/queries";
import { euro, when, nowLocal } from "@/lib/format";
import { societyCover, styleFor } from "@/lib/ui";

const MEMBER_PERKS = ["Member prices on tickets and trips", "Members-only events", "A vote at the AGM", "Supports the society directly"];

function ReviewItem({ name, stars, comment, badges, note }) {
  return (
    <li className="review-item">
      <div className="review-avatar">{name.charAt(0)}</div>
      <div className="review-body">
        <div className="review-meta">
          <strong>{name.split(" ")[0]}</strong>
          <Stars value={stars} size={13} />
          {badges.map((b) => <span key={b} className="verified-badge"><BadgeCheck size={11} /> {b}</span>)}
          {note && <span className="review-date">{note}</span>}
        </div>
        {comment && <p>{comment}</p>}
      </div>
    </li>
  );
}

export default async function SocietyPage({ params, searchParams }) {
  const { id } = await params;
  const { checkout } = await searchParams;
  const user = await pageUser();
  const society = getSociety(Number(id), user.id);
  if (!society) notFound();
  const isOwnSociety = user.role === "admin" && user.society_id === society.id;
  const look = styleFor(society.category);
  const committee = society.committee_json ? JSON.parse(society.committee_json) : [];

  const events = listEvents({ societyId: society.id });
  const now = nowLocal();
  const upcoming = events.filter((e) => e.start >= now);
  const past = events.filter((e) => e.start < now).reverse();
  const eventReviewsList = societyReviews(society.id);
  const ownReviews = societyOwnReviews(society.id);
  const mine = ownReviews.find((r) => r.user_id === user.id);
  const reviewBlocked = societyReviewBlockReason(user, society.id);

  return (
    <>
      <Flash checkout={checkout} />
      {isOwnSociety && (
        <div className="banner !mt-0 mb-5">
          <div><strong>This is your society&apos;s public page</strong><span>Exactly what students see. Change the logo, banner, about us and committee on your dashboard.</span></div>
          <Link className="primary-button small" href="/admin#profile">Edit profile</Link>
        </div>
      )}

      {/* ---------- Hero ---------- */}
      <div className="detail-hero society-hero" style={{ backgroundImage: `url(${societyCover(society)})` }}>
        <span className={`category-chip ${look.chip}`}>{society.category}</span>
      </div>
      <div className="society-head">
        <SocietyAvatar society={society} big />
        <div className="flex-1">
          <h1 className="detail-title !mb-2">{society.name}</h1>
          <InstagramTag handle={society.instagram} />
          <p className="society-tagline">{society.description}</p>
          <div className="society-head-meta">
            <span><Users size={14} />{society.member_count} {society.member_count === 1 ? "member" : "members"}</span>
            <span><CalendarDays size={14} />{society.upcoming_count} upcoming</span>
            <RatingBadge avg={society.avg_rating} count={society.review_count} />
          </div>
        </div>
        {user.role === "student" && (
          <ActionButton endpoint="/api/follow" body={{ societyId: society.id }} variant="secondary">
            {society.is_following ? "Following ✓" : "+ Follow"}
          </ActionButton>
        )}
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          {(society.bio || committee.length > 0) && (
            <section>
              {society.bio && (
                <>
                  <div className="eyebrow">ABOUT</div>
                  <h2 className="sub-h">Who we are</h2>
                  <p className="about-text">{society.bio}</p>
                </>
              )}
              {committee.length > 0 && (
                <>
                  <h3 className="sub-h small">Meet the committee</h3>
                  <div className="committee-grid">
                    {committee.map((m) => (
                      <div className="member-card" key={`${m.name}-${m.role}`}>
                        <div className={`member-avatar ${look.soc}`}>{m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</div>
                        <strong>{m.name}</strong>
                        <span className="member-role">{m.role}</span>
                        {m.bio && <p>{m.bio}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          <section>
            <h2 className="sub-h">Upcoming events</h2>
            {upcoming.length ? (
              <div className="event-grid two">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
            ) : (
              <div className="empty-state"><CalendarDays size={22} /><strong>No upcoming events yet</strong><p>Follow the society to hear about the next one.</p></div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="sub-h small">Past events</h2>
              <ul className="agenda">
                {past.map((e) => (
                  <li key={e.id}>
                    <div className="agenda-date"><strong>{new Date(e.start).toLocaleDateString("en-IE", { month: "short" }).toUpperCase()}</strong><span>{new Date(e.start).getDate()}</span></div>
                    <div className="agenda-body"><Link href={`/events/${e.id}`}>{e.title}</Link><span className="text-xs text-muted">{when(e.start)} · {e.venue}</span></div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="reviews" id="reviews">
            <div className="section-heading">
              <div><div className="eyebrow">FROM REAL MEMBERS &amp; ATTENDEES</div><h2 className="sub-h !m-0">What students say</h2></div>
              {society.avg_rating != null && (
                <div className="review-summary"><strong>{Number(society.avg_rating).toFixed(1)}</strong>
                  <div><Stars value={society.avg_rating} /><span>{society.review_count} verified reviews</span></div></div>
              )}
            </div>
            <div className="mb-4"><ReviewSummary societyId={society.id} reviewCount={eventReviewsList.length + ownReviews.length} /></div>

            {user.role === "student" && (
              reviewBlocked && !mine
                ? <p className="review-signin">{reviewBlocked}</p>
                : <SocietyReviewForm societyId={society.id} societyName={society.name} mine={mine ? { stars: mine.stars, comment: mine.comment } : null} />
            )}

            {ownReviews.length === 0 && eventReviewsList.length === 0 ? (
              <div className="empty-state"><Star size={22} /><strong>No reviews yet</strong><p>Members and students who went to an event can review.</p></div>
            ) : (
              <>
                {ownReviews.length > 0 && (
                  <>
                    <h3 className="sub-h small">About the society</h3>
                    <ul className="review-list">
                      {ownReviews.map((r) => (
                        <ReviewItem key={`s${r.id}`} name={r.user_name} stars={r.stars} comment={r.comment}
                          badges={[r.is_member && "Member", r.attended && "Attended events"].filter(Boolean)} />
                      ))}
                    </ul>
                  </>
                )}
                {eventReviewsList.length > 0 && (
                  <>
                    <h3 className="sub-h small">From its events</h3>
                    <ul className="review-list">
                      {eventReviewsList.map((r) => (
                        <ReviewItem key={`e${r.id}`} name={r.user_name} stars={r.stars} comment={r.comment} badges={["Attended"]} note={r.event_title} />
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>
        </div>

        {/* ---------- Membership ---------- */}
        <aside className="detail-side">
          <div className="join-panel">
            {society.is_member ? (
              <>
                <div className="going-note"><Check size={16} /> You&apos;re a member</div>
                <p className="text-sm text-muted">This society&apos;s events are in your calendar, and you get member prices.</p>
                <Link className="primary-button" href="/my-societies">View membership card</Link>
              </>
            ) : society.membership_fee_cents > 0 ? (
              <>
                <h3>Become a member</h3>
                <div className="action-price">{euro(society.membership_fee_cents)} <span className="text-sm font-normal text-muted">/ year</span></div>
                <ul>{MEMBER_PERKS.map((p) => <li key={p}><Check size={14} /> {p}</li>)}</ul>
                {user.role === "student" ? (
                  user.status === "verified" ? (
                    <ActionButton endpoint="/api/stripe/checkout" body={{ kind: "membership", societyId: society.id }} className="[&>button]:w-full">
                      Join for {euro(society.membership_fee_cents)}
                    </ActionButton>
                  ) : (
                    <p className="pending-note">Joining unlocks once the SocSync admin verifies your account.</p>
                  )
                ) : (
                  <p className="text-xs text-muted">Students join here.</p>
                )}
                <p className="demo-disclaimer">Secure card payment via Stripe (sandbox). The fee goes to the society.</p>
              </>
            ) : (
              <>
                <h3>Free to join</h3>
                <p className="text-sm text-muted">No membership fee. Follow the society to get its events in your calendar.</p>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
