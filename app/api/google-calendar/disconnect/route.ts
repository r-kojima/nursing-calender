import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function DELETE() {
  try {
    // 1. 認証チェック
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. ユーザー取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. 連携チェック
    if (!user.googleCalendarSyncEnabled) {
      return NextResponse.json(
        { error: "Google Calendar is not connected" },
        { status: 400 },
      );
    }

    // 4. トランザクション開始
    const result = await prisma.$transaction(async (tx) => {
      // 4-1. 自分のメンバーを取得
      const selfMember = await tx.member.findFirst({
        where: {
          userId: user.id,
          isSelf: true,
          isActive: true,
        },
      });

      if (!selfMember) {
        throw new Error("Self member not found");
      }

      // 4-2. 同期済みシフトの数をカウント
      const deletedCount = await tx.shift.count({
        where: {
          memberId: selfMember.id,
          syncStatus: "SYNCED",
          googleEventId: { not: null },
        },
      });

      // 4-3. ユーザーのトークン情報をクリア
      await tx.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiry: null,
          googleCalendarSyncEnabled: false,
          googleCalendarEmail: null,
          googleCalendarLastSync: null,
        },
      });

      // 4-4. シフトの同期情報をクリア
      await tx.shift.updateMany({
        where: { memberId: selfMember.id },
        data: {
          googleEventId: null,
          syncStatus: "DELETED",
          lastSyncedAt: null,
        },
      });

      return { deletedCount };
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error disconnecting Google Calendar:", error);
    return NextResponse.json(
      {
        error: "Failed to disconnect",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
