export function normalizeClubSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function validateClubDetails(input: {
  name: string;
  slug: string;
  location: string;
  description: string;
}) {
  const value = {
    name: input.name.trim().replace(/\s+/g, " "),
    slug: normalizeClubSlug(input.slug),
    location: input.location.trim().replace(/\s+/g, " "),
    description: input.description.trim(),
  };

  if (value.name.length < 2 || value.name.length > 80) {
    return { ok: false as const, message: "Club name must be between 2 and 80 characters." };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(value.slug)) {
    return { ok: false as const, message: "Club link must contain 3–48 letters, numbers or hyphens." };
  }
  if (value.location.length > 100) {
    return { ok: false as const, message: "Club location must be 100 characters or fewer." };
  }
  if (value.description.length > 500) {
    return { ok: false as const, message: "Club description must be 500 characters or fewer." };
  }
  return { ok: true as const, value };
}

export type ClubRole = "owner" | "admin" | "member";
export type MembershipRequestStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface ClubRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  location: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClubMemberRow {
  club_id: string;
  user_id: string;
  role: ClubRole;
  created_at: string;
}

export interface ClubMembershipRequestRow {
  id: string;
  club_id: string;
  user_id: string;
  request_name: string;
  status: MembershipRequestStatus;
  accepted_guide_revision: number | null;
  guide_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClubGuideRow {
  club_id: string;
  opening_hours: string;
  rules: string;
  revision: number;
  updated_at: string;
}
