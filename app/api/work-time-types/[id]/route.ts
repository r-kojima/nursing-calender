import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ユーザーを取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, startTime, endTime, color } = body;

    // バリデーション
    if (!name || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Name, startTime, and endTime are required" },
        { status: 400 },
      );
    }

    // 時刻の妥当性チェック
    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "Start time must be before end time" },
        { status: 400 },
      );
    }

    // 対象の WorkTimeType が自分のものか確認
    const existing = await prisma.workTimeType.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Work time type not found" },
        { status: 404 },
      );
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 更新
    const workTimeType = await prisma.workTimeType.update({
      where: { id },
      data: {
        name,
        startTime,
        endTime,
        color: color || null,
      },
      select: {
        id: true,
        name: true,
        startTime: true,
        endTime: true,
        color: true,
        displayOrder: true,
      },
    });

    return NextResponse.json({ workTimeType });
  } catch (error) {
    console.error("Error updating work time type:", error);
    return NextResponse.json(
      { error: "Failed to update work time type" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ユーザーを取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;

    // 対象の WorkTimeType が自分のものか確認
    const existing = await prisma.workTimeType.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Work time type not found" },
        { status: 404 },
      );
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 物理削除
    await prisma.workTimeType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting work time type:", error);
    return NextResponse.json(
      { error: "Failed to delete work time type" },
      { status: 500 },
    );
  }
}
