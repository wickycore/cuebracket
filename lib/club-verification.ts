"use client";

import { createClient } from "@/lib/supabase/client";

export interface ClubVerificationEligibility {
  eligible: boolean;
  missingCriteria: string[];
}

export async function checkVerificationEligibility(clubId: string): Promise<ClubVerificationEligibility> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("check_club_verification_eligibility", { target_club: clubId }).single();
  if (error) throw error;
  const row = data as { eligible?: boolean; missing_criteria?: string[] } | null;
  return {
    eligible: Boolean(row?.eligible),
    missingCriteria: Array.isArray(row?.missing_criteria) ? row.missing_criteria : [],
  };
}
