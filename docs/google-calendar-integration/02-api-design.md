# API設計詳細

## 1. 概要

Googleカレンダー連携機能のAPIエンドポイント設計について詳細に記述します。本ドキュメントでは、新規エンドポイントの仕様、既存APIの拡張、エラーハンドリング、およびセキュリティ実装について説明します。

## 2. APIエンドポイント一覧

### 2.1 新規エンドポイント

| エンドポイント | メソッド | 概要 | 認証 |
|-------------|---------|------|------|
| `/api/google-calendar/auth` | GET | OAuth認証開始 | ✅ |
| `/api/google-calendar/callback` | GET | OAuth認証コールバック | ✅ |
| `/api/google-calendar/sync` | POST | 手動同期実行 | ✅ |
| `/api/google-calendar/disconnect` | DELETE | 連携解除 | ✅ |
| `/api/google-calendar/status` | GET | 同期ステータス取得 | ✅ |
| `/api/cron/sync-calendar` | GET | バッチ同期処理 | CRON_SECRET |

### 2.2 既存エンドポイントの拡張

| エンドポイント | メソッド | 追加処理 |
|-------------|---------|---------|
| `/api/shifts` | POST | シフト作成後に同期 |
| `/api/shifts/upsert` | PUT | シフト更新後に同期 |
| `/api/shifts/[id]` | PUT | シフト更新後に同期 |
| `/api/shifts/[id]` | DELETE | シフト削除後に同期 |

---

## 3. OAuth認証エンドポイント

### 3.1 認証開始 - `GET /api/google-calendar/auth`

#### 3.1.1 概要

Googleの認証画面へリダイレクトし、OAuth 2.0フローを開始します。

#### 3.1.2 リクエスト

**メソッド:** `GET`

**認証:** Required (NextAuth session)

**クエリパラメータ:** なし

#### 3.1.3 処理フロー

```typescript
// app/api/google-calendar/auth/route.ts
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
      process.env.GOOGLE_REDIRECT_URI
    );

    // 3. CSRF対策用のstateパラメータ生成
    const state = crypto.randomBytes(32).toString("hex");

    // 4. セッションにstateを保存（後でコールバック時に検証）
    // ※ Next.js 15ではcookiesを使用
    const response = NextResponse.redirect(
      oauth2Client.generateAuthUrl({
        access_type: "offline", // リフレッシュトークンを取得
        scope: ["https://www.googleapis.com/auth/calendar.events"],
        state: state,
        prompt: "consent", // 毎回同意画面を表示してリフレッシュトークンを確実に取得
      })
    );

    // stateをHTTP-only cookieに保存（XSS対策）
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
      { status: 500 }
    );
  }
}
```

#### 3.1.4 レスポンス

**成功時 (302 Redirect):**
```
Location: https://accounts.google.com/o/oauth2/v2/auth?
  client_id=...
  &redirect_uri=...
  &response_type=code
  &scope=https://www.googleapis.com/auth/calendar.events
  &access_type=offline
  &state=...
  &prompt=consent
```

**エラー時 (401/500):**
```json
{
  "error": "Unauthorized" | "Failed to start authentication"
}
```

---

### 3.2 認証コールバック - `GET /api/google-calendar/callback`

#### 3.2.1 概要

Google認証後のコールバックを処理し、トークンをDBに保存して既存シフトを同期します。

#### 3.2.2 リクエスト

**メソッド:** `GET`

**認証:** Required (NextAuth session)

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|-----|------|
| `code` | string | ✅ | Google認証コード |
| `state` | string | ✅ | CSRF対策用ステート |
| `error` | string | ❌ | エラーコード（ユーザーが拒否した場合） |

#### 3.2.3 処理フロー

```typescript
// app/api/google-calendar/callback/route.ts
import { auth } from "@/app/lib/auth";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { encrypt } from "@/app/lib/encryption";
import { syncInitialShifts } from "@/app/lib/google-calendar/sync";

export async function GET(request: Request) {
  try {
    // 1. 認証チェック
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.redirect("/login?error=unauthorized");
    }

    // 2. クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // 3. ユーザーが拒否した場合
    if (error === "access_denied") {
      return NextResponse.redirect("/settings?error=access_denied");
    }

    // 4. バリデーション
    if (!code || !state) {
      return NextResponse.redirect("/settings?error=invalid_callback");
    }

    // 5. CSRF対策: stateの検証
    const cookies = request.headers.get("cookie") || "";
    const savedState = cookies
      .split(";")
      .find((c) => c.trim().startsWith("oauth_state="))
      ?.split("=")[1];

    if (!savedState || savedState !== state) {
      return NextResponse.redirect("/settings?error=invalid_state");
    }

    // 6. OAuth2クライアント初期化
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // 7. 認証コードをトークンに交換
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to obtain tokens");
    }

    // 8. Googleアカウント情報取得（メールアドレス）
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // 9. ユーザー取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.redirect("/settings?error=user_not_found");
    }

    // 10. トークンを暗号化してDBに保存
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

    // 11. 既存シフトの初回同期（非同期実行）
    syncInitialShifts(user.id).catch((error) => {
      console.error("Initial sync failed:", error);
    });

    // 12. 成功リダイレクト
    const response = NextResponse.redirect("/settings?success=connected");

    // 13. oauth_state cookieを削除
    response.cookies.delete("oauth_state");

    return response;
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    return NextResponse.redirect("/settings?error=callback_failed");
  }
}
```

#### 3.2.4 レスポンス

**成功時 (302 Redirect):**
```
Location: /settings?success=connected
```

**エラー時 (302 Redirect):**
```
Location: /settings?error={error_code}
```

**エラーコード一覧:**

| コード | 意味 |
|-------|------|
| `unauthorized` | 未認証ユーザー |
| `access_denied` | ユーザーが権限を拒否 |
| `invalid_callback` | 不正なコールバック（codeまたはstate欠落） |
| `invalid_state` | CSRF攻撃の可能性（state不一致） |
| `user_not_found` | ユーザーが見つからない |
| `callback_failed` | その他のエラー |

---

## 4. 同期管理エンドポイント

### 4.1 同期ステータス取得 - `GET /api/google-calendar/status`

#### 4.1.1 概要

現在の連携状態と同期統計を取得します。

#### 4.1.2 リクエスト

**メソッド:** `GET`

**認証:** Required (NextAuth session)

**クエリパラメータ:** なし

#### 4.1.3 処理フロー

```typescript
// app/api/google-calendar/status/route.ts
import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    // 1. 認証チェック
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. ユーザー取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        googleCalendarSyncEnabled: true,
        googleCalendarEmail: true,
        googleCalendarLastSync: true,
        googleTokenExpiry: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. 連携されていない場合
    if (!user.googleCalendarSyncEnabled) {
      return NextResponse.json({
        connected: false,
        syncEnabled: false,
      });
    }

    // 4. 自分のシフトの同期統計を取得
    const selfMember = await prisma.member.findFirst({
      where: {
        user: { email: session.user.email },
        isSelf: true,
        isActive: true,
      },
    });

    if (!selfMember) {
      return NextResponse.json(
        { error: "Self member not found" },
        { status: 404 }
      );
    }

    // 5. 同期ステータス別の件数を集計
    const [syncedCount, pendingCount, failedCount] = await Promise.all([
      prisma.shift.count({
        where: { memberId: selfMember.id, syncStatus: "SYNCED" },
      }),
      prisma.shift.count({
        where: { memberId: selfMember.id, syncStatus: "PENDING" },
      }),
      prisma.shift.count({
        where: { memberId: selfMember.id, syncStatus: "FAILED" },
      }),
    ]);

    // 6. トークン有効期限チェック
    const isTokenExpired = user.googleTokenExpiry
      ? user.googleTokenExpiry < new Date()
      : false;

    return NextResponse.json({
      connected: true,
      syncEnabled: user.googleCalendarSyncEnabled,
      email: user.googleCalendarEmail,
      lastSync: user.googleCalendarLastSync,
      isTokenExpired,
      stats: {
        synced: syncedCount,
        pending: pendingCount,
        failed: failedCount,
        total: syncedCount + pendingCount + failedCount,
      },
    });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

#### 4.1.4 レスポンス

**連携前:**
```json
{
  "connected": false,
  "syncEnabled": false
}
```

**連携済み:**
```json
{
  "connected": true,
  "syncEnabled": true,
  "email": "user@example.com",
  "lastSync": "2025-10-19T14:30:00.000Z",
  "isTokenExpired": false,
  "stats": {
    "synced": 15,
    "pending": 0,
    "failed": 0,
    "total": 15
  }
}
```

---

### 4.2 手動同期 - `POST /api/google-calendar/sync`

#### 4.2.1 概要

全シフトを手動で再同期します。

#### 4.2.2 リクエスト

**メソッド:** `POST`

**認証:** Required (NextAuth session)

**リクエストボディ:** なし

#### 4.2.3 処理フロー

```typescript
// app/api/google-calendar/sync/route.ts
import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { syncAllShifts } from "@/app/lib/google-calendar/sync";

export async function POST() {
  try {
    // 1. 認証チェック
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. ユーザー取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. 連携チェック
    if (!user.googleCalendarSyncEnabled) {
      return NextResponse.json(
        { error: "Google Calendar sync is not enabled" },
        { status: 400 }
      );
    }

    // 4. 同期実行（非同期）
    const result = await syncAllShifts(user.id);

    // 5. 最終同期日時を更新
    await prisma.user.update({
      where: { id: user.id },
      data: { googleCalendarLastSync: new Date() },
    });

    return NextResponse.json({
      success: true,
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
      skippedCount: result.skippedCount,
    });
  } catch (error) {
    console.error("Error during manual sync:", error);
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

#### 4.2.4 レスポンス

**成功時:**
```json
{
  "success": true,
  "syncedCount": 15,
  "failedCount": 0,
  "skippedCount": 5
}
```

**エラー時:**
```json
{
  "error": "Sync failed",
  "details": "Token expired"
}
```

---

### 4.3 連携解除 - `DELETE /api/google-calendar/disconnect`

#### 4.3.1 概要

Googleカレンダー連携を解除し、同期済みイベントを削除します。

#### 4.3.2 リクエスト

**メソッド:** `DELETE`

**認証:** Required (NextAuth session)

**リクエストボディ:** なし

#### 4.3.3 処理フロー

```typescript
// app/api/google-calendar/disconnect/route.ts
import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { deleteAllGoogleEvents } from "@/app/lib/google-calendar/sync";

export async function DELETE() {
  try {
    // 1. 認証チェック
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. ユーザー取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. 連携チェック
    if (!user.googleCalendarSyncEnabled) {
      return NextResponse.json(
        { error: "Google Calendar is not connected" },
        { status: 400 }
      );
    }

    // 4. トランザクション開始
    const result = await prisma.$transaction(async (tx) => {
      // 4-1. 同期済みシフトを取得
      const selfMember = await tx.member.findFirst({
        where: {
          userId: user.id,
          isSelf: true,
          isActive: true,
        },
      });

      if (!selfMember) {
        throw new Error("Self member not found");
      }

      const syncedShifts = await tx.shift.findMany({
        where: {
          memberId: selfMember.id,
          syncStatus: "SYNCED",
          googleEventId: { not: null },
        },
        select: { googleEventId: true },
      });

      // 4-2. Googleカレンダーからイベント削除（並列処理）
      const deletedCount = await deleteAllGoogleEvents(
        user.id,
        syncedShifts.map((s) => s.googleEventId!).filter(Boolean)
      );

      // 4-3. ユーザーのトークン情報をクリア
      await tx.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiry: null,
          googleCalendarSyncEnabled: false,
          googleCalendarEmail: null,
          googleCalendarLastSync: null,
        },
      });

      // 4-4. シフトの同期情報をクリア
      await tx.shift.updateMany({
        where: { memberId: selfMember.id },
        data: {
          googleEventId: null,
          syncStatus: "DELETED",
          lastSyncedAt: null,
        },
      });

      return { deletedCount };
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error disconnecting Google Calendar:", error);
    return NextResponse.json(
      { error: "Failed to disconnect", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

#### 4.3.4 レスポンス

**成功時:**
```json
{
  "success": true,
  "deletedCount": 15
}
```

**エラー時:**
```json
{
  "error": "Failed to disconnect",
  "details": "Self member not found"
}
```

---

## 5. 既存シフトAPIの拡張

### 5.1 シフトUPSERT - `PUT /api/shifts/upsert`

#### 5.1.1 既存処理の保持

既存の処理フローは変更せず、同期ロジックを追加します。

#### 5.1.2 追加処理

```typescript
// app/api/shifts/upsert/route.ts（拡張部分のみ）
import { syncShiftToGoogleCalendar } from "@/app/lib/google-calendar/sync";

export async function PUT(request: Request) {
  try {
    // ... 既存の処理（認証、バリデーション、UPSERT） ...

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
        syncStatus: "PENDING", // 追加: 初期状態は同期待ち
      },
      update: {
        ...updateData,
        syncStatus: "PENDING", // 追加: 更新時も同期待ちに戻す
      },
      include: {
        workTimeType: true,
        member: { include: { user: true } },
      },
    });

    // ===== 追加: Googleカレンダー同期（非同期） =====
    if (shift.member.isSelf && shift.member.user.googleCalendarSyncEnabled) {
      syncShiftToGoogleCalendar(shift.id).catch((error) => {
        console.error("Failed to sync shift to Google Calendar:", error);
      });
    }

    return NextResponse.json({ shift });
  } catch (error) {
    // ... エラーハンドリング ...
  }
}
```

### 5.2 シフト削除 - `DELETE /api/shifts/[id]`

#### 5.2.1 追加処理

```typescript
// app/api/shifts/[id]/route.ts（削除部分の拡張）
import { deleteGoogleCalendarEvent } from "@/app/lib/google-calendar/sync";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // ... 既存の認証・バリデーション処理 ...

    // シフトを取得（削除前にgoogleEventIdを保存）
    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      include: {
        member: { include: { user: true } },
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // 権限チェック
    if (shift.member.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // シフトを削除
    await prisma.shift.delete({
      where: { id: params.id },
    });

    // ===== 追加: Googleカレンダーから削除（非同期） =====
    if (
      shift.member.isSelf &&
      shift.member.user.googleCalendarSyncEnabled &&
      shift.googleEventId
    ) {
      deleteGoogleCalendarEvent(shift.member.userId, shift.googleEventId).catch(
        (error) => {
          console.error("Failed to delete Google Calendar event:", error);
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // ... エラーハンドリング ...
  }
}
```

---

## 6. バッチ処理エンドポイント

### 6.1 バッチ同期 - `GET /api/cron/sync-calendar`

#### 6.1.1 概要

定期的に実行されるバッチ処理で、同期待ち・失敗状態のシフトを再同期します。

#### 6.1.2 リクエスト

**メソッド:** `GET`

**認証:** CRON_SECRET (環境変数による認証)

**ヘッダー:**
```
Authorization: Bearer <CRON_SECRET>
```

#### 6.1.3 処理フロー

```typescript
// app/api/cron/sync-calendar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { syncShiftToGoogleCalendar } from "@/app/lib/google-calendar/sync";

export async function GET(request: Request) {
  try {
    // 1. CRON認証チェック
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 同期対象シフトを取得（PENDING or FAILED）
    const pendingShifts = await prisma.shift.findMany({
      where: {
        syncStatus: { in: ["PENDING", "FAILED"] },
        member: {
          isSelf: true,
          isActive: true,
          user: {
            googleCalendarSyncEnabled: true,
          },
        },
        workTimeTypeId: { not: null }, // シフトパターンが設定されているもののみ
      },
      include: {
        member: { include: { user: true } },
        workTimeType: true,
      },
      take: 100, // 1回のバッチで最大100件処理
      orderBy: { createdAt: "asc" },
    });

    console.log(`[Batch Sync] Processing ${pendingShifts.length} shifts`);

    // 3. 各シフトを同期（並列処理、ただしレート制限考慮）
    const results = await Promise.allSettled(
      pendingShifts.map(async (shift, index) => {
        // レート制限対策: 100msごとに1リクエスト
        await new Promise((resolve) => setTimeout(resolve, index * 100));
        return syncShiftToGoogleCalendar(shift.id);
      })
    );

    // 4. 結果集計
    const syncedCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.filter((r) => r.status === "rejected").length;

    console.log(
      `[Batch Sync] Completed: ${syncedCount} synced, ${failedCount} failed`
    );

    return NextResponse.json({
      success: true,
      processed: pendingShifts.length,
      syncedCount,
      failedCount,
    });
  } catch (error) {
    console.error("[Batch Sync] Error:", error);
    return NextResponse.json(
      { error: "Batch sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

#### 6.1.4 レスポンス

**成功時:**
```json
{
  "success": true,
  "processed": 15,
  "syncedCount": 14,
  "failedCount": 1
}
```

#### 6.1.5 Vercel Cron設定

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync-calendar",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## 7. エラーハンドリング

### 7.1 エラーレスポンス標準形式

すべてのAPIエンドポイントは以下の形式でエラーを返します:

```typescript
interface ErrorResponse {
  error: string;           // エラーの種類（ユーザー向け）
  details?: string;        // 詳細情報（デバッグ用）
  code?: string;           // エラーコード（任意）
}
```

### 7.2 HTTPステータスコード

| ステータス | 用途 | 例 |
|----------|------|-----|
| 200 | 成功 | データ取得成功 |
| 201 | 作成成功 | シフト作成成功 |
| 400 | リクエストエラー | バリデーションエラー |
| 401 | 認証エラー | 未ログイン |
| 403 | 認可エラー | 他人のデータへのアクセス |
| 404 | 未検出 | リソースが存在しない |
| 500 | サーバーエラー | 予期しないエラー |
| 503 | サービス利用不可 | Google API障害 |

### 7.3 Google Calendar API エラーハンドリング

```typescript
// app/lib/google-calendar/error-handler.ts
export async function handleGoogleApiError(error: any, shiftId: string) {
  if (error.code === 401) {
    // トークン期限切れ → リフレッシュ試行
    console.log(`[Shift ${shiftId}] Token expired, refreshing...`);
    // トークンリフレッシュロジックは次のドキュメントで詳述
    throw new Error("Token refresh required");
  } else if (error.code === 403) {
    // 権限不足 → 再認証が必要
    console.error(`[Shift ${shiftId}] Insufficient permissions`);
    await prisma.shift.update({
      where: { id: shiftId },
      data: { syncStatus: "FAILED" },
    });
    throw new Error("Insufficient permissions");
  } else if (error.code === 404) {
    // イベントが既に削除されている
    console.log(`[Shift ${shiftId}] Event already deleted`);
    await prisma.shift.update({
      where: { id: shiftId },
      data: { syncStatus: "DELETED", googleEventId: null },
    });
  } else if (error.code === 429) {
    // レート制限 → 指数バックオフで再試行
    console.warn(`[Shift ${shiftId}] Rate limited, will retry`);
    throw new Error("Rate limited");
  } else {
    // その他のエラー
    console.error(`[Shift ${shiftId}] Unexpected error:`, error);
    await prisma.shift.update({
      where: { id: shiftId },
      data: { syncStatus: "FAILED" },
    });
    throw error;
  }
}
```

---

## 8. レート制限対策

### 8.1 Google Calendar API クォータ

| 制限 | 値 |
|-----|-----|
| ユーザーあたり/秒 | 10リクエスト |
| プロジェクト全体/日 | 1,000,000リクエスト |

### 8.2 実装戦略

#### 8.2.1 バッチ処理での間隔調整

```typescript
// 100msごとに1リクエスト = 1秒あたり10リクエスト
await Promise.allSettled(
  shifts.map(async (shift, index) => {
    await new Promise((resolve) => setTimeout(resolve, index * 100));
    return syncShift(shift);
  })
);
```

#### 8.2.2 指数バックオフ再試行

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.code === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## 9. セキュリティ実装

### 9.1 認証ミドルウェア

すべてのAPIエンドポイントで共通の認証チェック:

```typescript
// app/lib/api/auth-middleware.ts
import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";

export async function requireAuth() {
  const session = await auth();

  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }

  return { error: null, session };
}
```

使用例:
```typescript
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  // 認証済みの処理...
}
```

### 9.2 CSRF対策

OAuth認証時にstateパラメータを使用:

```typescript
// 1. 認証開始時にstateを生成
const state = crypto.randomBytes(32).toString("hex");
response.cookies.set("oauth_state", state, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
});

// 2. コールバック時に検証
const savedState = cookies.find((c) => c.startsWith("oauth_state="));
if (savedState !== state) {
  throw new Error("Invalid state");
}
```

### 9.3 認可チェック

操作対象のリソースが自分のものか確認:

```typescript
// シフト操作時の認可チェック例
const shift = await prisma.shift.findUnique({
  where: { id: shiftId },
  include: { member: true },
});

if (shift.member.userId !== session.user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

## 10. パフォーマンス最適化

### 10.1 データベースクエリ最適化

#### 10.1.1 必要なフィールドのみ取得

```typescript
// ❌ 悪い例: すべてのフィールドを取得
const user = await prisma.user.findUnique({ where: { id } });

// ✅ 良い例: 必要なフィールドのみ
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    googleAccessToken: true,
    googleRefreshToken: true,
    googleTokenExpiry: true,
  },
});
```

#### 10.1.2 リレーションの事前読み込み

```typescript
// ✅ include で N+1 問題を回避
const shifts = await prisma.shift.findMany({
  where: { syncStatus: "PENDING" },
  include: {
    member: { include: { user: true } },
    workTimeType: true,
  },
});
```

### 10.2 非同期処理の活用

リアルタイム同期はレスポンスをブロックしない:

```typescript
// シフト作成レスポンスを先に返す
const shift = await prisma.shift.create({ data });

// 同期は非同期で実行（await しない）
syncShiftToGoogleCalendar(shift.id).catch(console.error);

return NextResponse.json({ shift }); // 即座に返す
```

---

## 11. テスト戦略

### 11.1 単体テスト

各エンドポイントのビジネスロジックをテスト:

```typescript
// __tests__/api/google-calendar/status.test.ts
describe("GET /api/google-calendar/status", () => {
  it("should return not connected for users without sync", async () => {
    const response = await fetch("/api/google-calendar/status");
    const data = await response.json();
    expect(data.connected).toBe(false);
  });

  it("should return sync stats for connected users", async () => {
    // モックユーザーを作成
    const response = await fetch("/api/google-calendar/status");
    const data = await response.json();
    expect(data.connected).toBe(true);
    expect(data.stats).toBeDefined();
  });
});
```

### 11.2 統合テスト

OAuth認証フロー全体をテスト:

```typescript
describe("OAuth Flow", () => {
  it("should complete full OAuth flow", async () => {
    // 1. 認証開始
    const authResponse = await fetch("/api/google-calendar/auth");
    expect(authResponse.status).toBe(302);

    // 2. コールバック（モックコード使用）
    const callbackResponse = await fetch(
      "/api/google-calendar/callback?code=mock_code&state=mock_state"
    );
    expect(callbackResponse.status).toBe(302);

    // 3. ステータス確認
    const statusResponse = await fetch("/api/google-calendar/status");
    const status = await statusResponse.json();
    expect(status.connected).toBe(true);
  });
});
```

---

## 12. まとめ

### 12.1 実装チェックリスト

- [ ] OAuth認証エンドポイント (`/api/google-calendar/auth`)
- [ ] OAuth コールバック (`/api/google-calendar/callback`)
- [ ] 同期ステータス取得 (`/api/google-calendar/status`)
- [ ] 手動同期 (`/api/google-calendar/sync`)
- [ ] 連携解除 (`/api/google-calendar/disconnect`)
- [ ] バッチ同期 (`/api/cron/sync-calendar`)
- [ ] 既存シフトAPI拡張 (UPSERT, DELETE)
- [ ] エラーハンドリング実装
- [ ] レート制限対策実装
- [ ] セキュリティ対策実装
- [ ] 単体テスト作成
- [ ] 統合テスト作成

### 12.2 次ステップ

1. ✅ データベーススキーマ設計完了
2. ✅ API設計詳細完了
3. ⏭️ OAuth認証・セキュリティ詳細（次のドキュメント）
4. ⏭️ 同期ロジック詳細
5. ⏭️ UI実装詳細

---

**ドキュメントバージョン:** 1.0
**最終更新日:** 2025-10-19
**レビュー担当者:** （未定）
**次回レビュー予定:** 実装開始前
