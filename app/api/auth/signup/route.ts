import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import type { PrismaClient } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // バリデーション
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "メールアドレス、パスワード、名前は必須です" },
        { status: 400 },
      );
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "有効なメールアドレスを入力してください" },
        { status: 400 },
      );
    }

    // パスワードの長さチェック
    if (password.length < 8) {
      return NextResponse.json(
        { error: "パスワードは8文字以上である必要があります" },
        { status: 400 },
      );
    }

    // 既存ユーザーのチェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 400 },
      );
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザーとメンバーをトランザクションで作成
    const user = await prisma.$transaction(
      async (
        tx: Omit<
          PrismaClient,
          "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
        >,
      ) => {
        // ユーザーの作成
        const newUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
          },
        });

        // 本人のメンバーを作成
        await tx.member.create({
          data: {
            userId: newUser.id,
            name: newUser.name,
            isSelf: true,
            isActive: true,
          },
        });

        return newUser;
      },
    );

    // パスワードを除いてレスポンスを返す
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      {
        message: "アカウントが作成されました",
        user: userWithoutPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "アカウント作成中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
