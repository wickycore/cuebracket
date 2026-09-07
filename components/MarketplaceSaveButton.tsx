"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleSavedListing } from "@/lib/cloud/marketplace";

export function MarketplaceSaveButton({listingId,initialSaved,signedIn}:{listingId:string;initialSaved:boolean;signedIn:boolean}){
  const router=useRouter(); const [saved,setSaved]=useState(initialSaved); const [busy,setBusy]=useState(false);
  async function toggle(){if(!signedIn){router.push(`/auth/login?next=/marketplace/${listingId}`);return}setBusy(true);const next=!saved;setSaved(next);try{await toggleSavedListing(listingId,next)}catch{setSaved(!next)}finally{setBusy(false)}}
  return <button type="button" disabled={busy} onClick={e=>{e.preventDefault();e.stopPropagation();void toggle()}} aria-label={saved?"Remove from saved listings":"Save listing"} aria-pressed={saved} title={saved?"Saved":"Save for later"} className={`grid h-10 w-10 place-items-center rounded-[10px] border bg-[#0a1628]/90 text-lg transition ${saved?"border-[#4dd8c4] text-[#4dd8c4]":"border-[#2a4a6f] text-[#9db4d1] hover:border-[#4dd8c4]"}`}>{saved?"♥":"♡"}</button>;
}
