import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
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

    // WorkTimeTypeを取得（displayOrderでソート、isActiveなもののみ）
    const workTimeTypes = await prisma.workTimeType.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc",
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

    return NextResponse.json({ workTimeTypes });
  } catch (error) {
    console.error("Error fetching work time types:", error);
    return NextResponse.json(
      { error: "Failed to fetch work time types" },
      { status: 500 },
    );
  }
}
