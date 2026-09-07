"use client";
import { useState } from "react";
import { requestMarketplaceReviewRemoval } from "@/lib/cloud/marketplace";
export function MarketplaceReviewRemoval({reviewId,requested}:{reviewId:string;requested:boolean}){const [done,setDone]=useState(requested);const [busy,setBusy]=useState(false);async function request(){setBusy(true);try{await requestMarketplaceReviewRemoval(reviewId);setDone(true)}finally{setBusy(false)}}return done?<span className="text-xs text-slate-400">Removal requested</span>:<button type="button" disabled={busy} onClick={()=>void request()} className="text-xs font-bold text-[#F09595]">{busy?"Requesting…":"Report my review for removal"}</button>}
