# OAuth認証・セキュリティ実装詳細

## 1. 概要

本ドキュメントでは、Googleカレンダー連携におけるOAuth 2.0認証フロー、トークン管理、暗号化、およびセキュリティ対策について詳細に記述します。

---

## 2. OAuth 2.0 認証フロー

### 2.1 使用する認証方式

**Authorization Code Flow (サーバーサイド)**

- ✅ リフレッシュトークンが取得可能
- ✅ トークンがクライアントに露出しない
- ✅ Next.js App Routerと相性が良い

### 2.2 認証フロー全体図

```
┌─────────┐                ┌──────────┐                ┌────────────┐
│ ユーザー │                │ 本アプリ  │                │  Google    │
└────┬────┘                └─────┬────┘                └─────┬──────┘
     │                           │                           │
     │ 1. 連携ボタンクリック       │                           │
     ├──────────────────────────>│                           │
     │                           │                           │
     │                           │ 2. 認証URLを生成           │
     │                           │    (state生成)            │
     │                           │                           │
     │ 3. リダイレクト             │                           │
     │<──────────────────────────┤                           │
     │                           │                           │
     │ 4. Google認証画面へ遷移     │                           │
     ├───────────────────────────────────────────────────────>│
     │                           │                           │
     │ 5. ログイン・権限許可        │                           │
     │                           │                           │
     │ 6. コールバックURL + code   │                           │
     │<───────────────────────────────────────────────────────┤
     │                           │                           │
     │ 7. callbackエンドポイント呼出│                           │
     ├──────────────────────────>│                           │
     │                           │                           │
     │                           │ 8. state検証              │
     │                           │                           │
     │                           │ 9. codeをtokenに交換       │
     │                           ├──────────────────────────>│
     │                           │                           │
     │                           │ 10. access_token +        │
     │                           │     refresh_token         │
     │                           │<──────────────────────────┤
     │                           │                           │
     │                           │ 11. トークンを暗号化してDB保存│
     │                           │                           │
     │                           │ 12. 既存シフトを一括同期    │
     │                           │                           │
     │ 13. 設定画面へリダイレクト   │                           │
     │<──────────────────────────┤                           │
     │                           │                           │
```

---

## 3. Google Cloud Console 設定

### 3.1 プロジェクト作成

1. **Google Cloud Console** にアクセス: https://console.cloud.google.com
2. 新しいプロジェクトを作成: `nursing-calendar-app`
3. プロジェクトを選択

### 3.2 Google Calendar API 有効化

1. **APIとサービス** → **ライブラリ** に移動
2. "Google Calendar API" を検索
3. **有効にする** をクリック

### 3.3 OAuth 認証情報の作成

#### 3.3.1 OAuth同意画面の設定

1. **APIとサービス** → **OAuth同意画面** に移動
2. ユーザータイプを選択: **外部**
3. アプリ情報を入力:
   - アプリ名: `Nursing Calendar`
   - ユーザーサポートメール: `your-email@example.com`
   - デベロッパー連絡先: `your-email@example.com`
4. スコープを追加:
   - `https://www.googleapis.com/auth/calendar.events`
5. テストユーザーを追加（開発中のみ必要）

#### 3.3.2 OAuth クライアント ID の作成

1. **APIとサービス** → **認証情報** に移動
2. **認証情報を作成** → **OAuthクライアントID** を選択
3. アプリケーションの種類: **ウェブアプリケーション**
4. 名前: `Nursing Calendar Web Client`
5. **承認済みのリダイレクトURI** を追加:
   - 開発環境: `http://localhost:3000/api/google-calendar/callback`
   - 本番環境: `https://your-domain.com/api/google-calendar/callback`
6. **作成** をクリック
7. クライアントIDとクライアントシークレットをコピー

### 3.4 環境変数設定

```env
# .env.local (開発環境)
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback

# 本番環境 (Vercel Environment Variables)
GOOGLE_CLIENT_ID=<本番用クライアントID>
GOOGLE_CLIENT_SECRET=<本番用クライアントシークレット>
GOOGLE_REDIRECT_URI=https://your-domain.com/api/google-calendar/callback
```

---

## 4. トークン管理

### 4.1 トークンの種類

| トークン | 有効期限 | 用途 | 保存場所 |
|---------|---------|------|---------|
| Access Token | 1時間 | API呼び出しに使用 | DB（暗号化） |
| Refresh Token | 永続的* | Access Token更新用 | DB（暗号化） |

*注: ユーザーが権限を取り消すまで有効

### 4.2 トークン取得処理

```typescript
// app/lib/google-calendar/oauth.ts
import { google } from "googleapis";
import { prisma } from "@/app/lib/prisma";
import { encrypt, decrypt } from "@/app/lib/encryption";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<TokenResponse> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("No access token received");
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    };
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    throw new Error("Failed to exchange authorization code");
  }
}
```

### 4.3 トークンリフレッシュ処理

```typescript
// app/lib/google-calendar/oauth.ts
export async function refreshAccessToken(
  userId: string
): Promise<string> {
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
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

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
  } catch (error: any) {
    console.error("Error refreshing access token:", error);

    // リフレッシュトークンが無効な場合は連携を無効化
    if (error.code === 401 || error.code === 400) {
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
```

### 4.4 トークン有効性チェック

```typescript
// app/lib/google-calendar/oauth.ts
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
```

---

## 5. データ暗号化

### 5.1 暗号化アルゴリズム

**AES-256-GCM (Galois/Counter Mode)**

- 認証付き暗号化
- 改ざん検出機能あり
- NIST推奨の標準アルゴリズム

### 5.2 暗号化実装

```typescript
// app/lib/encryption.ts
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128ビット
const AUTH_TAG_LENGTH = 16; // 128ビット

/**
 * 暗号化キーを取得（環境変数から）
 * キーは64文字のHEX文字列（32バイト = 256ビット）
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set in environment variables");
  }

  if (key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }

  return Buffer.from(key, "hex");
}

/**
 * 文字列を暗号化
 * @param text 暗号化する平文
 * @returns "iv:authTag:encryptedData" 形式の文字列
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // iv, authTag, encryptedDataを":"で結合
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * 暗号化された文字列を復号化
 * @param encryptedData "iv:authTag:encryptedData" 形式の文字列
 * @returns 復号化された平文
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(":");

    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * 暗号化キーを生成（初回セットアップ用）
 * 本番環境では手動で生成してVercel Secretsに保存
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
```

### 5.3 暗号化キーの生成と管理

#### 5.3.1 開発環境でのキー生成

```bash
# Node.jsで暗号化キーを生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 出力例:
# a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

#### 5.3.2 環境変数への設定

```env
# .env.local
ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

#### 5.3.3 本番環境（Vercel）での設定

```bash
# Vercel CLIで設定
vercel env add ENCRYPTION_KEY production

# または Vercel Dashboard → Settings → Environment Variables で設定
```

#### 5.3.4 キーローテーション戦略

**推奨頻度:** 6ヶ月ごと

**手順:**

```typescript
// scripts/rotate-encryption-key.ts
import { prisma } from "../app/lib/prisma";
import { encrypt, decrypt } from "../app/lib/encryption";

/**
 * 暗号化キーをローテーション
 * 1. 既存のトークンを復号化
 * 2. 新しいキーで再暗号化
 * 3. DBを更新
 */
async function rotateEncryptionKey(newKey: string) {
  // 環境変数を一時的に保存
  const oldKey = process.env.ENCRYPTION_KEY;

  // すべての暗号化済みトークンを取得
  const users = await prisma.user.findMany({
    where: {
      googleAccessToken: { not: null },
    },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
    },
  });

  console.log(`Rotating keys for ${users.length} users...`);

  for (const user of users) {
    try {
      // 古いキーで復号化
      const accessToken = user.googleAccessToken
        ? decrypt(user.googleAccessToken)
        : null;
      const refreshToken = user.googleRefreshToken
        ? decrypt(user.googleRefreshToken)
        : null;

      // 新しいキーに切り替え
      process.env.ENCRYPTION_KEY = newKey;

      // 新しいキーで再暗号化
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: accessToken ? encrypt(accessToken) : null,
          googleRefreshToken: refreshToken ? encrypt(refreshToken) : null,
        },
      });

      console.log(`✓ User ${user.id} rotated`);
    } catch (error) {
      console.error(`✗ User ${user.id} failed:`, error);
    } finally {
      // 元のキーに戻す
      process.env.ENCRYPTION_KEY = oldKey;
    }
  }

  console.log("Key rotation completed");
}

// 実行例
// const newKey = generateEncryptionKey();
// rotateEncryptionKey(newKey);
```

---

## 6. CSRF対策

### 6.1 Stateパラメータの使用

OAuth認証時にランダムな`state`を生成し、コールバック時に検証:

```typescript
// app/api/google-calendar/auth/route.ts
import crypto from "crypto";

export async function GET() {
  // 1. ランダムなstateを生成（256ビット）
  const state = crypto.randomBytes(32).toString("hex");

  // 2. HTTP-Only Cookieに保存（XSS対策）
  response.cookies.set("oauth_state", state, {
    httpOnly: true, // JavaScriptからアクセス不可
    secure: process.env.NODE_ENV === "production", // HTTPS必須（本番）
    sameSite: "lax", // CSRF対策
    maxAge: 600, // 10分間有効
    path: "/api/google-calendar", // スコープを限定
  });

  // 3. Google認証URLにstateを含める
  const authUrl = oauth2Client.generateAuthUrl({
    state: state,
    // ...その他のパラメータ
  });

  return NextResponse.redirect(authUrl);
}
```

### 6.2 Stateの検証

```typescript
// app/api/google-calendar/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receivedState = searchParams.get("state");

  // Cookieから保存済みのstateを取得
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const stateCookie = cookies.find((c) => c.startsWith("oauth_state="));
  const savedState = stateCookie?.split("=")[1];

  // 検証
  if (!receivedState || !savedState || receivedState !== savedState) {
    console.error("CSRF detected: state mismatch");
    return NextResponse.redirect("/settings?error=invalid_state");
  }

  // 検証成功後、Cookieを削除
  response.cookies.delete("oauth_state");

  // ... トークン取得処理
}
```

---

## 7. 認可制御

### 7.1 リソースレベルの認可

すべてのAPI操作で「自分のリソースのみアクセス可能」を保証:

```typescript
// app/lib/google-calendar/authorization.ts
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/**
 * シフトの所有権を確認
 */
export async function verifyShiftOwnership(
  shiftId: string
): Promise<{ authorized: boolean; shift: any | null }> {
  const session = await auth();

  if (!session?.user?.email) {
    return { authorized: false, shift: null };
  }

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      member: {
        include: { user: true },
      },
    },
  });

  if (!shift) {
    return { authorized: false, shift: null };
  }

  // ユーザーIDが一致するか確認
  const authorized = shift.member.user.email === session.user.email;

  return { authorized, shift };
}

/**
 * Googleカレンダー連携の有効性を確認
 */
export async function verifyGoogleCalendarAccess(
  userId: string
): Promise<{ authorized: boolean; user: any | null }> {
  const session = await auth();

  if (!session?.user?.email) {
    return { authorized: false, user: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      googleCalendarSyncEnabled: true,
      googleAccessToken: true,
      googleRefreshToken: true,
    },
  });

  if (!user) {
    return { authorized: false, user: null };
  }

  // 自分のアカウントか確認
  const authorized = user.email === session.user.email;

  return { authorized, user };
}
```

### 7.2 使用例

```typescript
// app/api/google-calendar/sync/route.ts
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 認可チェック
  const { authorized } = await verifyGoogleCalendarAccess(user.id);

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... 同期処理
}
```

---

## 8. セキュリティベストプラクティス

### 8.1 環境変数の保護

#### 8.1.1 .gitignore設定

```gitignore
# 環境変数ファイル
.env
.env.local
.env.production
.env.development

# Vercel
.vercel
```

#### 8.1.2 環境変数の検証

```typescript
// app/lib/config/validate-env.ts
export function validateEnvironmentVariables() {
  const requiredVars = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "ENCRYPTION_KEY",
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  // 暗号化キーの形式チェック
  if (process.env.ENCRYPTION_KEY?.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters");
  }
}

// アプリ起動時に実行
validateEnvironmentVariables();
```

### 8.2 HTTPSの強制（本番環境）

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 本番環境でHTTPSを強制
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") !== "https"
  ) {
    return NextResponse.redirect(
      `https://${request.headers.get("host")}${request.nextUrl.pathname}`,
      301
    );
  }

  return NextResponse.next();
}
```

### 8.3 セキュリティヘッダー

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
```

### 8.4 ログ記録（監査証跡）

```typescript
// app/lib/audit-log.ts
import { prisma } from "@/app/lib/prisma";

interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export async function logAuditEvent(entry: AuditLogEntry) {
  try {
    // 本番環境では専用のログテーブルに保存
    console.log("[AUDIT]", JSON.stringify(entry));

    // 重要な操作のみDB保存（オプション）
    if (["google_calendar_connect", "google_calendar_disconnect"].includes(entry.action)) {
      // await prisma.auditLog.create({ data: entry });
    }
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}
```

使用例:
```typescript
// OAuth認証成功時
await logAuditEvent({
  userId: user.id,
  action: "google_calendar_connect",
  resource: "google_calendar",
  ipAddress: request.headers.get("x-forwarded-for") || "unknown",
  userAgent: request.headers.get("user-agent") || "unknown",
  success: true,
});
```

---

## 9. エラーハンドリングとセキュリティ

### 9.1 エラーメッセージの安全な処理

```typescript
// ❌ 悪い例: 詳細なエラーをクライアントに返す
catch (error: any) {
  return NextResponse.json({
    error: error.message, // スタックトレースや内部情報が漏洩する可能性
  }, { status: 500 });
}

// ✅ 良い例: 安全なエラーメッセージ
catch (error: any) {
  console.error("Internal error:", error); // サーバーログに詳細を記録

  return NextResponse.json({
    error: "An error occurred during authentication", // 汎用的なメッセージ
  }, { status: 500 });
}
```

### 9.2 認証エラーの分類

```typescript
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHORIZED" | "TOKEN_EXPIRED" | "INVALID_TOKEN"
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

// 使用例
try {
  const token = await getValidAccessToken(userId);
} catch (error) {
  if (error instanceof AuthenticationError) {
    if (error.code === "TOKEN_EXPIRED") {
      // トークンリフレッシュを試行
      return await refreshAccessToken(userId);
    } else if (error.code === "INVALID_TOKEN") {
      // 再認証を促す
      return NextResponse.redirect("/settings?error=reconnect_required");
    }
  }
  throw error;
}
```

---

## 10. テストとセキュリティ検証

### 10.1 暗号化のテスト

```typescript
// __tests__/lib/encryption.test.ts
import { encrypt, decrypt } from "@/app/lib/encryption";

describe("Encryption", () => {
  beforeAll(() => {
    // テスト用の暗号化キーを設定
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("should encrypt and decrypt correctly", () => {
    const plaintext = "sensitive_access_token_123";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertext for same input", () => {
    const plaintext = "same_input";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    // 異なるIVを使用するため暗号文は異なる
    expect(encrypted1).not.toBe(encrypted2);

    // ただし復号化すると同じ
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it("should throw error on tampered ciphertext", () => {
    const plaintext = "original";
    const encrypted = encrypt(plaintext);

    // 暗号文を改ざん
    const tampered = encrypted.replace(/.$/, "X");

    expect(() => decrypt(tampered)).toThrow();
  });
});
```

### 10.2 CSRF対策のテスト

```typescript
// __tests__/api/google-calendar/auth.test.ts
describe("CSRF Protection", () => {
  it("should reject callback with mismatched state", async () => {
    const response = await fetch(
      "/api/google-calendar/callback?code=valid_code&state=wrong_state",
      {
        headers: {
          cookie: "oauth_state=correct_state",
        },
      }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=invalid_state");
  });

  it("should accept callback with matching state", async () => {
    const state = "correct_state_123";

    const response = await fetch(
      `/api/google-calendar/callback?code=valid_code&state=${state}`,
      {
        headers: {
          cookie: `oauth_state=${state}`,
        },
      }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("success=connected");
  });
});
```

---

## 11. セキュリティチェックリスト

### 11.1 OAuth実装

- [ ] `state`パラメータでCSRF対策
- [ ] リダイレクトURIの厳密な検証
- [ ] HTTP-Only Cookieでstateを保存
- [ ] トークンをHTTPS経由でのみ送信
- [ ] リフレッシュトークンの安全な保存

### 11.2 データ保護

- [ ] AES-256-GCMで暗号化
- [ ] 暗号化キーを環境変数で管理
- [ ] `.gitignore`に環境変数ファイルを追加
- [ ] 本番環境でHTTPSを強制
- [ ] DBアクセスをPrismaで保護（SQLインジェクション対策）

### 11.3 認可制御

- [ ] すべてのAPIで認証チェック
- [ ] リソース所有権の確認
- [ ] ユーザーIDでデータをフィルタ
- [ ] 管理者権限の適切な実装（将来的に必要な場合）

### 11.4 エラーハンドリング

- [ ] 詳細なエラーをログに記録
- [ ] クライアントには汎用的なエラーメッセージ
- [ ] トークンエラーの適切な処理
- [ ] レート制限エラーの再試行ロジック

### 11.5 監査とログ

- [ ] 重要な操作をログ記録
- [ ] ログにPII（個人情報）を含めない
- [ ] IPアドレスとUser-Agentを記録
- [ ] 定期的なセキュリティレビュー

---

## 12. まとめ

### 12.1 実装優先度

**Phase 1: 基本的なOAuth実装**
- [ ] Google Cloud Console設定
- [ ] OAuth認証エンドポイント
- [ ] トークン取得・保存
- [ ] 暗号化実装

**Phase 2: セキュリティ強化**
- [ ] CSRF対策（state検証）
- [ ] トークンリフレッシュ
- [ ] 認可制御
- [ ] HTTPSセキュリティヘッダー

**Phase 3: 運用とメンテナンス**
- [ ] 監査ログ
- [ ] エラーハンドリング改善
- [ ] セキュリティテスト
- [ ] キーローテーション手順

### 12.2 次ステップ

1. ✅ データベーススキーマ設計完了
2. ✅ API設計詳細完了
3. ✅ OAuth認証・セキュリティ詳細完了
4. ⏭️ 同期ロジック詳細（次のドキュメント）
5. ⏭️ UI実装詳細

---

**ドキュメントバージョン:** 1.0
**最終更新日:** 2025-10-19
**レビュー担当者:** （未定）
**セキュリティレビュー:** 実装前に必須
