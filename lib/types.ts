export type EventItem = {
  id: number; title: string; societyId: string; category: string;
  startsAt: string; // local Dublin time, "YYYY-MM-DDTHH:mm"
  location: string; price: number; capacity: number; baseGoing: number;
  description: string; image: string; color: string; tags: string[]; createdBy?: string;
};
export type CommitteeMember = { name: string; role: string; bio: string; image?: string };
export type SocialLink = { kind: "instagram" | "discord" | "website" | "email"; url: string };
export type SocietyProfile = {
  image: string;
  avatar?: string;
  membershipCardBackground?: string;
  bio: string;
  tagline: string;
  committee: CommitteeMember[];
  socials: SocialLink[];
};
export type Society = {
  id: string; name: string; short: string; category: string; initials: string; color: string;
  tagline: string; bio: string; image: string; baseMembers: number;
  committee: CommitteeMember[]; socials: SocialLink[];
};
export type User = {
  id: string; name: string; email: string; studentNumber: string;
  interests: string[]; saved: number[]; createdAt: string;
};
export type Membership = {
  id: string; societyId: string; userId: string; status: "pending" | "confirmed";
  sessionId: string; paidAt: string; confirmedAt?: string;
};
export type Ticket = {
  id: string; eventId: number; userId: string; kind: "paid" | "reserved";
  sessionId?: string; code: string; createdAt: string;
};
export type Review = {
  id: string; targetType: "event" | "society"; targetId: string; userId: string;
  rating: number; text: string; createdAt: string; updatedAt: string;
};
export type DB = {
  users: Record<string, User>; memberships: Membership[]; tickets: Ticket[];
  reviews: Review[]; events: EventItem[];
  societyProfiles: Record<string, SocietyProfile>;
};

export type Rating = { avg: number; count: number } | null;
export type EventView = EventItem & {
  societyName: string; societyAvatar?: string; going: number; spotsLeft: number;
  day: string; date: string; time: string; rating: Rating;
};
export type SocietyView = Society & {
  avatar?: string;
  memberCount: number; rating: Rating; status: "pending" | "confirmed" | null;
};
export type ReviewView = {
  id: string; rating: number; text: string; name: string;
  verified: boolean; createdAt: string; mine: boolean;
};
