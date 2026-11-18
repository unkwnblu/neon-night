"use server";

import { requireDoor } from "@/lib/admin-auth";
import { checkInStats, checkInTicket, lookupTicket, undoCheckIn, type ScanResult } from "@/lib/checkin";

export type ScanResponse = { result?: ScanResult; error?: string; stats?: { issued: number; checkedIn: number } };

async function run(fn: () => Promise<ScanResult>): Promise<ScanResponse> {
  await requireDoor();
  try {
    // Count after the change, so the header includes the ticket just verified.
    const result = await fn();
    return { result, stats: await checkInStats() };
  } catch (e) {
    console.error("Check-in failed:", e);
    return { error: "Couldn't reach the ticket database. Check the connection and try again." };
  }
}

export async function scanAction(code: string) {
  return run(() => lookupTicket(code));
}

export async function verifyAction(code: string) {
  return run(() => checkInTicket(code));
}

export async function undoAction(code: string) {
  return run(() => undoCheckIn(code));
}
