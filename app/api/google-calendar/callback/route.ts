import { auth } from "@/app/lib/auth";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { encrypt } from "@/app/lib/encryption";
import { syncInitialShifts } from "@/app/lib/google-calendar/sync";

export async function GET(request: Request) {
  console.log("[Google Calendar Callback] Starting OAuth callback");
  try {
    // 1. 認証チェック
    const session = await auth();
    console.log("[Google Calendar Callback] Session:", session?.user?.email);
    if (!session?.user?.email) {
      console.error("[Google Calendar Callback] No session found");
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", request.url),
      );
    }

    // 2. クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // 3. ユーザーが拒否した場合
    if (error === "access_denied") {
      return NextResponse.redirect(
        new URL("/settings/google-calendar?error=access_denied", request.url),
      );
    }

    // 4. バリデーション
    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          "/settings/google-calendar?error=invalid_callback",
          request.url,
        ),
      );
    }

    // 5. CSRF対策: stateの検証
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const stateCookie = cookies.find((c) => c.startsWith("oauth_state="));
    const savedState = stateCookie?.split("=")[1];

    if (!savedState || savedState !== state) {
      return NextResponse.redirect(
        new URL("/settings/google-calendar?error=invalid_state", request.url),
      );
    }

    // 6. OAuth2クライアント初期化
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    // 7. 認証コードをトークンに交換
    console.log("[Google Calendar Callback] Exchanging code for tokens");
    const { tokens } = await oauth2Client.getToken(code);
    console.log(
      "[Google Calendar Callback] Tokens received:",
      !!tokens.access_token,
      !!tokens.refresh_token,
    );

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to obtain tokens");
    }

    // 8. Googleアカウント情報取得（メールアドレス）
    console.log("[Google Calendar Callback] Getting user info");
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    console.log("[Google Calendar Callback] User info:", userInfo.data.email);

    // 9. ユーザー取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.redirect(
        new URL("/settings/google-calendar?error=user_not_found", request.url),
      );
    }

    // 10. トークンを暗号化してDBに保存
    console.log("[Google Calendar Callback] Saving tokens to database");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleAccessToken: encrypt(tokens.access_token),
        googleRefreshToken: encrypt(tokens.refresh_token),
        googleTokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : new Date(Date.now() + 3600 * 1000), // デフォルト1時間
        googleCalendarSyncEnabled: true,
        googleCalendarEmail: userInfo.data.email || null,
        googleCalendarLastSync: new Date(),
      },
    });
    console.log("[Google Calendar Callback] Successfully saved to database");

    // 11. 既存シフトの初回同期（非同期実行）
    syncInitialShifts(user.id).catch((error) => {
      console.error("[Google Calendar Callback] Initial sync failed:", error);
    });

    // 12. 成功リダイレクト
    console.log("[Google Calendar Callback] Redirecting to success page");
    const response = NextResponse.redirect(
      new URL("/settings/google-calendar?success=connected", request.url),
    );

    // 13. oauth_state cookieを削除
    response.cookies.delete("oauth_state");

    return response;
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    return NextResponse.redirect(
      new URL("/settings/google-calendar?error=callback_failed", request.url),
    );
  }
}
