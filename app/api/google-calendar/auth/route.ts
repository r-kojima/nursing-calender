import { auth } from "@/app/lib/auth";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  try {
    // 1. 認証チェック
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. OAuth2クライアント初期化
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    // 3. CSRF対策用のstateパラメータ生成
    const state = crypto.randomBytes(32).toString("hex");

    // 4. Google認証URLを生成
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // リフレッシュトークンを取得
      scope: [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state: state,
      prompt: "consent", // 毎回同意画面を表示してリフレッシュトークンを確実に取得
    });

    // 5. stateをHTTP-only cookieに保存（XSS対策）
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10分間有効
    });

    return response;
  } catch (error) {
    console.error("Error starting OAuth flow:", error);
    return NextResponse.json(
      { error: "Failed to start authentication" },
      { status: 500 },
    );
  }
}
