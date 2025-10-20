import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  console.log("[Google Calendar Status] Fetching status");
  try {
    // 1. 認証チェック
    const session = await auth();
    if (!session?.user?.email) {
      console.error("[Google Calendar Status] No session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. ユーザー取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        googleCalendarSyncEnabled: true,
        googleCalendarEmail: true,
        googleCalendarLastSync: true,
        googleTokenExpiry: true,
      },
    });

    if (!user) {
      console.error("[Google Calendar Status] User not found");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log(
      "[Google Calendar Status] User sync enabled:",
      user.googleCalendarSyncEnabled,
    );

    // 3. 連携されていない場合
    if (!user.googleCalendarSyncEnabled) {
      console.log("[Google Calendar Status] Returning not connected");
      return NextResponse.json({
        connected: false,
        syncEnabled: false,
      });
    }

    // 4. 自分のシフトの同期統計を取得
    const selfMember = await prisma.member.findFirst({
      where: {
        user: { email: session.user.email },
        isSelf: true,
        isActive: true,
      },
    });

    // selfMemberが存在しない場合は統計を0で返す
    let syncedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    if (selfMember) {
      // 5. 同期ステータス別の件数を集計
      [syncedCount, pendingCount, failedCount] = await Promise.all([
        prisma.shift.count({
          where: { memberId: selfMember.id, syncStatus: "SYNCED" },
        }),
        prisma.shift.count({
          where: { memberId: selfMember.id, syncStatus: "PENDING" },
        }),
        prisma.shift.count({
          where: { memberId: selfMember.id, syncStatus: "FAILED" },
        }),
      ]);
    }

    // 6. トークン有効期限チェック
    const isTokenExpired = user.googleTokenExpiry
      ? user.googleTokenExpiry < new Date()
      : false;

    const response = {
      connected: true,
      syncEnabled: user.googleCalendarSyncEnabled,
      email: user.googleCalendarEmail,
      lastSync: user.googleCalendarLastSync,
      isTokenExpired,
      stats: {
        synced: syncedCount,
        pending: pendingCount,
        failed: failedCount,
        total: syncedCount + pendingCount + failedCount,
      },
    };

    console.log("[Google Calendar Status] Returning:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
