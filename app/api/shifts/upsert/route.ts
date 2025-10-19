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
    const { date, workTimeTypeId, note } = body;

    // バリデーション
    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
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
          memberId: selfMember.id,
          date: shiftDate,
        },
      },
      create: {
        memberId: selfMember.id,
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
