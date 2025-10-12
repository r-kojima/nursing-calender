import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    // 認証チェック
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    if (!year || !month) {
      return NextResponse.json(
        { error: "year and month are required" },
        { status: 400 },
      );
    }

    const yearNum = Number.parseInt(year, 10);
    const monthNum = Number.parseInt(month, 10);

    if (
      Number.isNaN(yearNum) ||
      Number.isNaN(monthNum) ||
      monthNum < 1 ||
      monthNum > 12
    ) {
      return NextResponse.json(
        { error: "Invalid year or month" },
        { status: 400 },
      );
    }

    // ユーザー取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 自分自身のMemberを取得
    const selfMember = await prisma.member.findFirst({
      where: {
        userId: user.id,
        isSelf: true,
        isActive: true,
      },
    });

    if (!selfMember) {
      return NextResponse.json(
        { error: "Self member not found" },
        { status: 404 },
      );
    }

    // 指定月の開始日と終了日を計算
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0);

    // シフトデータ取得
    const shifts = await prisma.shift.findMany({
      where: {
        memberId: selfMember.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        workTimeType: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            color: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    // レスポンス整形
    const response = {
      shifts: shifts.map((shift) => ({
        id: shift.id,
        date: shift.date.toISOString(),
        note: shift.note,
        workTimeType: shift.workTimeType,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
