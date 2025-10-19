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

    // WorkTimeTypeを取得（displayOrderでソート）
    const workTimeTypes = await prisma.workTimeType.findMany({
      where: {
        userId: user.id,
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
        isActive: true,
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

export async function POST(request: Request) {
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

    // displayOrderの自動設定（既存の最大値 + 1）
    const maxDisplayOrder = await prisma.workTimeType.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: {
        displayOrder: "desc",
      },
      select: {
        displayOrder: true,
      },
    });

    const displayOrder = (maxDisplayOrder?.displayOrder ?? -1) + 1;

    // 作成
    const workTimeType = await prisma.workTimeType.create({
      data: {
        userId: user.id,
        name,
        startTime,
        endTime,
        color: color || null,
        displayOrder,
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

    return NextResponse.json({ workTimeType }, { status: 201 });
  } catch (error) {
    console.error("Error creating work time type:", error);
    return NextResponse.json(
      { error: "Failed to create work time type" },
      { status: 500 },
    );
  }
}
