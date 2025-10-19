import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { prisma } from "@/app/lib/prisma";
import { getValidAccessToken } from "./oauth";

/**
 * 過去30日分のシフトを一括同期（初回連携時）
 */
export async function syncInitialShifts(userId: string): Promise<void> {
  console.log(`[Initial Sync] Starting for user ${userId}`);

  try {
    // 1. 自分自身のメンバーを取得
    const selfMember = await prisma.member.findFirst({
      where: {
        userId: userId,
        isSelf: true,
        isActive: true,
      },
    });

    if (!selfMember) {
      throw new Error("Self member not found");
    }

    // 2. 過去30日分のシフトを取得
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const shifts = await prisma.shift.findMany({
      where: {
        memberId: selfMember.id,
        workTimeTypeId: { not: null }, // 休みを除外
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: "asc" },
    });

    console.log(`[Initial Sync] Found ${shifts.length} shifts to sync`);

    // 3. すべてのシフトをPENDINGに設定
    await prisma.shift.updateMany({
      where: {
        id: { in: shifts.map((s) => s.id) },
      },
      data: {
        syncStatus: "PENDING",
      },
    });

    console.log(`[Initial Sync] Completed for user ${userId}`);
  } catch (error) {
    console.error(`[Initial Sync] Error for user ${userId}:`, error);
    throw error;
  }
}

/**
 * シフトをGoogleカレンダーに同期（作成または更新）
 * 実際の同期ロジックはPhase 1: Real-time syncで実装
 */
export async function syncShiftToGoogleCalendar(
  _shiftId: string,
): Promise<void> {
  // Phase 1では初回同期のみ実装のためスタブ
  console.log(`[Sync] Sync will be implemented in real-time sync phase`);
}
