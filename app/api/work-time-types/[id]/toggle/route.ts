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

    // 対象の WorkTimeType が自分のものか確認
    const existing = await prisma.workTimeType.findUnique({
      where: { id },
      select: { userId: true, isActive: true },
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

    // isActiveを反転
    const workTimeType = await prisma.workTimeType.update({
      where: { id },
      data: {
        isActive: !existing.isActive,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    return NextResponse.json({ workTimeType });
  } catch (error) {
    console.error("Error toggling work time type:", error);
    return NextResponse.json(
      { error: "Failed to toggle work time type" },
      { status: 500 },
    );
  }
}
