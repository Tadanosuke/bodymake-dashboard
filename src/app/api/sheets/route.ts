import { NextResponse } from "next/server";
import { MOCK_DATA } from "@/lib/mockData";
import type { DashboardData } from "@/lib/types";

const GAS_ENDPOINT = process.env.GAS_ENDPOINT;

export async function GET() {
  if (GAS_ENDPOINT) {
    try {
      const res = await fetch(`${GAS_ENDPOINT}?action=getDashboard`, {
        next: { revalidate: 60 },
      });
      if (!res.ok) throw new Error("GAS fetch failed");
      const data: DashboardData = await res.json();
      return NextResponse.json(data);
    } catch (e) {
      console.error("GAS fetch error, falling back to mock:", e);
    }
  }

  return NextResponse.json(MOCK_DATA);
}
