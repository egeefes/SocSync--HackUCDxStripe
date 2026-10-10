import { NextResponse } from "next/server";
import { fail, readJson, requireCommittee, HttpError } from "@/lib/http";
import { mutate } from "@/lib/store";
import { findSociety } from "@/lib/domain";
import type { SocietyProfile, SocialLink } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const b = await readJson(request);
    const profile: SocietyProfile = {
      image: String(b.image ?? "").trim().slice(0, 950000),
      avatar: String(b.avatar ?? "").trim().slice(0, 950000),
      membershipCardBackground: String(b.membershipCardBackground ?? "").trim().slice(0, 950000),
      bio: String(b.bio ?? "").trim().slice(0, 2000),
      tagline: String(b.tagline ?? "").trim().slice(0, 180),
      committee: Array.isArray(b.committee) ? b.committee.slice(0, 20).map((m: any) => ({
        name: String(m.name ?? "").trim().slice(0, 80),
        role: String(m.role ?? "").trim().slice(0, 80),
        bio: String(m.bio ?? "").trim().slice(0, 500),
        image: String(m.image ?? "").trim().slice(0, 500),
      })).filter((m: any) => m.name && m.role) : [],
      socials: Array.isArray(b.socials) ? b.socials.slice(0, 10).map((l: any) => ({
        kind: String(l.kind ?? "") as SocialLink["kind"],
        url: String(l.url ?? "").trim().slice(0, 500),
      })).filter((l: any) => ["instagram", "discord", "website", "email"].includes(l.kind) && l.url) : [],
    };
    if (profile.image && !/^https:\/\//i.test(profile.image) && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(profile.image)) throw new HttpError(400, "Cover image must be an https URL.");
    if (profile.avatar && !/^https:\/\//i.test(profile.avatar) && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(profile.avatar)) throw new HttpError(400, "Profile picture must be an https URL.");
    if (profile.membershipCardBackground && !/^https:\/\//i.test(profile.membershipCardBackground) && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(profile.membershipCardBackground)) throw new HttpError(400, "Membership card background must be an image or https URL.");
    if (profile.committee.some((m) => m.image && !/^https:\/\//i.test(m.image))) throw new HttpError(400, "Committee member images must be https URLs.");
    const { societyId } = await mutate((db) => {
      const access = requireCommittee(db);
      if (!findSociety(access.societyId)) throw new HttpError(404, "Society not found.");
      db.societyProfiles ??= {};
      db.societyProfiles[access.societyId] = profile;
      return access;
    });
    return NextResponse.json({ ok: true, societyId });
  } catch (e) { return fail(e); }
}
