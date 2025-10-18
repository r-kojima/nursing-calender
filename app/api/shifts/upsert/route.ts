import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function PUT(request: Request) {
  try {
    // 認証チェック
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // リクエストボディ取得
    const body = await request.json();
    const { memberId, date, workTimeTypeId, note } = body;

    // バリデーション
    if (!memberId || !date) {
      return NextResponse.json(
        { error: "memberId and date are required" },
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

    // メンバーの所有権チェック
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member || member.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 日付をDateオブジェクトに変換
    const shiftDate = new Date(date);

    // UPSERT処理
    const updateData: {
      workTimeTypeId?: string | null;
      note?: string | null;
    } = {
      workTimeTypeId: workTimeTypeId !== undefined ? workTimeTypeId : undefined,
    };

    // noteが指定されている場合のみ更新対象にする
    if (note !== undefined) {
      updateData.note = note;
    }

    const shift = await prisma.shift.upsert({
      where: {
        memberId_date: {
          memberId,
          date: shiftDate,
        },
      },
      create: {
        memberId,
        date: shiftDate,
        workTimeTypeId: workTimeTypeId !== undefined ? workTimeTypeId : null,
        note: note !== undefined ? note : null,
      },
      update: updateData,
    });

    return NextResponse.json({ shift });
  } catch (error) {
    console.error("Error upserting shift:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
