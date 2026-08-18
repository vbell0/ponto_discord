import { NextResponse } from "next/server";
import { assertGuildAccess } from "@/lib/session";
import { getAnalytics } from "@/lib/queries";

export const dynamic = "force-dynamic";

function sinceFromPeriod(period: string): Date {
  const days = period === "30" ? 30 : 7;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function GET(
  req: Request,
  { params }: { params: { guildId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "7";
  const memberId = url.searchParams.get("memberId") ?? undefined;

  const data = await getAnalytics(
    params.guildId,
    sinceFromPeriod(period),
    memberId,
  );
  return NextResponse.json(data);
}
