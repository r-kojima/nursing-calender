import { google } from "googleapis";
import { prisma } from "@/app/lib/prisma";
import { encrypt, decrypt } from "@/app/lib/encryption";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

/**
 * OAuth2クライアントを作成
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * 認証コードをトークンに交換
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<TokenResponse> {
  const oauth2Client = createOAuth2Client();

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("No access token received");
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
    };
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    throw new Error("Failed to exchange authorization code");
  }
}

/**
 * アクセストークンをリフレッシュ
 */
export async function refreshAccessToken(userId: string): Promise<string> {
  // 1. ユーザーのリフレッシュトークンを取得
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleRefreshToken: true,
      googleCalendarSyncEnabled: true,
    },
  });

  if (!user?.googleRefreshToken || !user.googleCalendarSyncEnabled) {
    throw new Error("Google Calendar is not connected");
  }

  // 2. リフレッシュトークンを復号化
  const refreshToken = decrypt(user.googleRefreshToken);

  // 3. OAuth2クライアント設定
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  try {
    // 4. 新しいアクセストークンを取得
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("No access token received");
    }

    // 5. DBを更新
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: encrypt(credentials.access_token),
        googleTokenExpiry: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : new Date(Date.now() + 3600 * 1000),
      },
    });

    return credentials.access_token;
  } catch (error: unknown) {
    console.error("Error refreshing access token:", error);

    // リフレッシュトークンが無効な場合は連携を無効化
    const errorCode =
      error && typeof error === "object" && "code" in error ? error.code : null;
    if (errorCode === 401 || errorCode === 400) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleCalendarSyncEnabled: false,
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiry: null,
        },
      });
      throw new Error("Refresh token is invalid. Please reconnect.");
    }

    throw error;
  }
}

/**
 * 有効なアクセストークンを取得
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  // 1. ユーザー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleTokenExpiry: true,
      googleCalendarSyncEnabled: true,
    },
  });

  if (!user?.googleAccessToken || !user.googleCalendarSyncEnabled) {
    throw new Error("Google Calendar is not connected");
  }

  // 2. トークンの有効期限をチェック（5分前にリフレッシュ）
  const now = new Date();
  const expiryBuffer = new Date(now.getTime() + 5 * 60 * 1000); // 5分後

  if (!user.googleTokenExpiry || user.googleTokenExpiry < expiryBuffer) {
    // 期限切れまたは間もなく期限切れ → リフレッシュ
    console.log(`[User ${userId}] Access token expired, refreshing...`);
    return await refreshAccessToken(userId);
  }

  // 3. 有効なトークンを復号化して返す
  return decrypt(user.googleAccessToken);
}
