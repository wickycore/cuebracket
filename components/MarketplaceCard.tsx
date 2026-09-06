import Link from "next/link";
import { ClubVerifiedBadge } from "@/components/ClubVerifiedBadge";
import { RemoteMedia } from "@/components/RemoteMedia";
import { formatMarketplacePrice, marketplaceAvailability, marketplaceLabel, type MarketplaceListing } from "@/lib/marketplace";

export function MarketplaceCard({listing}:{listing:MarketplaceListing}){
 const sold=listing.status==="sold_out";
 return <Link href={`/marketplace/${listing.id}`} className={`group overflow-hidden rounded-[14px] border border-[#1e3a5f] bg-[#0d1f38] transition hover:border-[#4dd8c4]/50 ${sold?"opacity-55":""}`}>
  <div className="relative aspect-[16/10] bg-[#102846]">{listing.photos[0]?<RemoteMedia src={listing.photos[0]} alt={listing.title} width={720} height={450} sizes="(max-width: 768px) 100vw, 33vw" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-4xl text-[#6b8bab]">🎱</div>}{sold?<span className="absolute right-3 top-3 rounded-lg border border-[#d97878]/50 bg-[#d97878]/15 px-2 py-1 text-[11px] font-black text-[#F09595]">SOLD OUT</span>:null}</div>
  <div className={`border-l-[3px] ${sold?"border-l-[#6b8bab]":"border-l-[#5dcaa5]"} p-4`}><div className="flex items-start justify-between gap-3"><h2 className="line-clamp-2 font-semibold text-white">{listing.title}</h2><strong className="shrink-0 text-sm text-[#4dd8c4]">{formatMarketplacePrice(Number(listing.price),listing.currency)}</strong></div>
  <p className="mt-1 text-xs font-medium text-[#9db4d1]">{marketplaceLabel(listing.condition)} · {listing.location}</p><div className="mt-3 flex items-end justify-between gap-3"><span className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${sold?"border-[#6b8bab]/40 text-[#6b8bab]":"border-[#5dcaa5]/40 bg-[#5dcaa5]/10 text-[#5dcaa5]"}`}>{marketplaceAvailability(listing)}</span>{listing.club?<span className="flex min-w-0 items-center gap-1 truncate text-[11px] font-bold text-[#7fc9ff]">{listing.club.name}{listing.club.is_verified?<ClubVerifiedBadge/>:null}</span>:null}</div></div>
 </Link>;
}
