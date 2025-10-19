# 同期ロジック実装詳細

## 1. 概要

本ドキュメントでは、シフトデータとGoogleカレンダーの同期ロジックについて詳細に記述します。リアルタイム同期、バッチ同期、エラーハンドリング、およびデータ整合性の確保方法について説明します。

---

## 2. 同期アーキテクチャ

### 2.1 同期方式の全体像

```
┌────────────────────────────────────────────────────────────┐
│                    同期方式の選択                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────┐          ┌──────────────────┐       │
│  │ リアルタイム同期  │          │  バッチ同期       │       │
│  │  (優先)         │          │  (補完)          │       │
│  └────────┬────────┘          └────────┬─────────┘       │
│           │                            │                 │
│           │                            │                 │
│  ┌────────▼─────────────────────────────▼────────┐       │
│  │          同期対象シフトの判定                   │       │
│  │  - isSelf = true                             │       │
│  │  - googleCalendarSyncEnabled = true          │       │
│  │  - workTimeTypeId != null                    │       │
│  └──────────────────────┬───────────────────────┘       │
│                         │                               │
│           ┌─────────────┼─────────────┐                 │
│           │             │             │                 │
│  ┌────────▼──────┐ ┌───▼────┐ ┌─────▼──────┐           │
│  │  作成 (CREATE) │ │ 更新   │ │ 削除       │           │
│  │  → INSERT     │ │ → UPDATE│ │ → DELETE  │           │
│  └───────────────┘ └────────┘ └────────────┘           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 同期タイミング

| タイミング | トリガー | 処理方法 | 用途 |
|----------|---------|---------|------|
| リアルタイム | シフトCRUD操作 | 非同期API呼び出し | 即座に反映 |
| バッチ | Cron (1日1回) | まとめて処理 | 失敗シフトの再試行 |
| 手動 | ユーザー操作 | 即座に実行 | トラブルシューティング |
| 初回 | OAuth認証完了後 | 過去30日分を一括同期 | 連携直後の状態同期 |

---

## 3. 同期対象の判定ロジック

### 3.1 同期可能条件

```typescript
// app/lib/google-calendar/sync-validator.ts
import type { Shift, Member, User, WorkTimeType } from "@/app/generated/prisma";

type ShiftWithRelations = Shift & {
  member: Member & {
    user: User;
  };
  workTimeType: WorkTimeType | null;
};

/**
 * シフトが同期対象か判定
 */
export function isSyncable(shift: ShiftWithRelations): boolean {
  // 1. 本人のシフトか
  if (!shift.member.isSelf) {
    return false;
  }

  // 2. Googleカレンダー連携が有効か
  if (!shift.member.user.googleCalendarSyncEnabled) {
    return false;
  }

  // 3. シフトパターンが設定されているか（休みではない）
  if (!shift.workTimeTypeId || !shift.workTimeType) {
    return false;
  }

  // 4. 削除済みステータスでないか
  if (shift.syncStatus === "DELETED") {
    return false;
  }

  return true;
}

/**
 * 同期スキップの理由を取得（デバッグ用）
 */
export function getSyncSkipReason(shift: ShiftWithRelations): string | null {
  if (!shift.member.isSelf) {
    return "Not self member";
  }
  if (!shift.member.user.googleCalendarSyncEnabled) {
    return "Sync not enabled";
  }
  if (!shift.workTimeTypeId) {
    return "No work time type (day off)";
  }
  if (shift.syncStatus === "DELETED") {
    return "Already deleted";
  }
  return null;
}
```

---

## 4. Googleカレンダーイベントの変換

### 4.1 シフトからイベントへの変換

```typescript
// app/lib/google-calendar/event-converter.ts
import type { calendar_v3 } from "googleapis";

interface ShiftEventData {
  shiftId: string;
  date: Date;
  workTimeType: {
    name: string;
    startTime: string; // "07:00"
    endTime: string; // "16:00"
    color: string | null; // "#FF6B35"
  };
  note: string | null;
}

/**
 * カラーコードをGoogleカレンダーのcolorIdに変換
 */
function convertColorToGoogleColorId(hexColor: string | null): string {
  // Googleカレンダーの標準カラーID (1-11)
  const colorMapping: Record<string, string> = {
    "#FF6B35": "11", // オレンジ系 → Red
    "#FFB347": "6", // 黄色系 → Yellow
    "#4A90E2": "9", // 青系 → Blue
    "#10B981": "10", // 緑系 → Green
    "#EF4444": "11", // 赤系 → Red
    "#F59E0B": "5", // アンバー → Banana
  };

  if (!hexColor) {
    return "1"; // デフォルトはラベンダー
  }

  // 完全一致を探す
  if (colorMapping[hexColor]) {
    return colorMapping[hexColor];
  }

  // 部分一致（先頭3文字）
  const shortColor = hexColor.substring(0, 4); // "#FF6"
  for (const [key, value] of Object.entries(colorMapping)) {
    if (key.startsWith(shortColor)) {
      return value;
    }
  }

  return "1"; // 一致しない場合はデフォルト
}

/**
 * シフトデータをGoogleカレンダーイベントに変換
 */
export function convertShiftToGoogleEvent(
  shiftData: ShiftEventData
): calendar_v3.Schema$Event {
  const { date, workTimeType, note } = shiftData;

  // 日付をYYYY-MM-DD形式に変換
  const dateStr = date.toISOString().split("T")[0];

  // 開始・終了日時をISO 8601形式に変換
  const startDateTime = `${dateStr}T${workTimeType.startTime}:00+09:00`;
  const endDateTime = `${dateStr}T${workTimeType.endTime}:00+09:00`;

  // Googleカレンダーイベントを作成
  return {
    summary: workTimeType.name, // 例: "早番"
    description: note || "", // メモ（なければ空文字）
    start: {
      dateTime: startDateTime,
      timeZone: "Asia/Tokyo",
    },
    end: {
      dateTime: endDateTime,
      timeZone: "Asia/Tokyo",
    },
    colorId: convertColorToGoogleColorId(workTimeType.color),
    reminders: {
      useDefault: false, // カスタムリマインダーを使用
      overrides: [
        { method: "popup", minutes: 60 }, // 1時間前に通知
      ],
    },
  };
}

/**
 * シフトの更新検出（同期が必要か判定）
 */
export function hasShiftChanged(
  currentShift: ShiftEventData,
  previousEvent: calendar_v3.Schema$Event
): boolean {
  const currentEvent = convertShiftToGoogleEvent(currentShift);

  // 比較対象のフィールド
  const fieldsToCompare = [
    "summary",
    "description",
    "start.dateTime",
    "end.dateTime",
  ];

  for (const field of fieldsToCompare) {
    const currentValue = getNestedValue(currentEvent, field);
    const previousValue = getNestedValue(previousEvent, field);

    if (currentValue !== previousValue) {
      return true;
    }
  }

  return false;
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}
```

---

## 5. リアルタイム同期の実装

### 5.1 シフト作成時の同期

```typescript
// app/lib/google-calendar/sync.ts
import { google } from "googleapis";
import { prisma } from "@/app/lib/prisma";
import { getValidAccessToken } from "./oauth";
import { convertShiftToGoogleEvent } from "./event-converter";
import { isSyncable } from "./sync-validator";
import { handleGoogleApiError } from "./error-handler";

/**
 * シフトをGoogleカレンダーに同期（作成または更新）
 */
export async function syncShiftToGoogleCalendar(
  shiftId: string
): Promise<void> {
  try {
    console.log(`[Sync] Starting sync for shift ${shiftId}`);

    // 1. シフトデータを取得
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        member: {
          include: { user: true },
        },
        workTimeType: true,
      },
    });

    if (!shift) {
      throw new Error(`Shift ${shiftId} not found`);
    }

    // 2. 同期対象か判定
    if (!isSyncable(shift)) {
      console.log(`[Sync] Shift ${shiftId} is not syncable, skipping`);
      await prisma.shift.update({
        where: { id: shiftId },
        data: { syncStatus: "DELETED" },
      });
      return;
    }

    // 3. アクセストークンを取得（必要に応じてリフレッシュ）
    const accessToken = await getValidAccessToken(shift.member.userId);

    // 4. Google Calendar APIクライアント初期化
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 5. イベントデータを作成
    const eventData = convertShiftToGoogleEvent({
      shiftId: shift.id,
      date: shift.date,
      workTimeType: shift.workTimeType!,
      note: shift.note,
    });

    let googleEventId: string;

    // 6. 既存イベントがあれば更新、なければ作成
    if (shift.googleEventId) {
      console.log(`[Sync] Updating existing event ${shift.googleEventId}`);
      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: shift.googleEventId,
        requestBody: eventData,
      });
      googleEventId = response.data.id!;
    } else {
      console.log(`[Sync] Creating new event`);
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: eventData,
      });
      googleEventId = response.data.id!;
    }

    // 7. 同期成功をDBに記録
    await prisma.shift.update({
      where: { id: shiftId },
      data: {
        googleEventId: googleEventId,
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
      },
    });

    console.log(`[Sync] Successfully synced shift ${shiftId}`);
  } catch (error: any) {
    console.error(`[Sync] Failed to sync shift ${shiftId}:`, error);

    // エラーハンドリング
    await handleGoogleApiError(error, shiftId);
  }
}
```

### 5.2 シフト削除時の同期

```typescript
/**
 * Googleカレンダーからイベントを削除
 */
export async function deleteGoogleCalendarEvent(
  userId: string,
  googleEventId: string
): Promise<void> {
  try {
    console.log(`[Sync] Deleting event ${googleEventId}`);

    // 1. アクセストークン取得
    const accessToken = await getValidAccessToken(userId);

    // 2. Google Calendar APIクライアント初期化
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 3. イベント削除
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
    });

    console.log(`[Sync] Successfully deleted event ${googleEventId}`);
  } catch (error: any) {
    // 404エラー（既に削除済み）は無視
    if (error.code === 404) {
      console.log(`[Sync] Event ${googleEventId} already deleted`);
      return;
    }

    console.error(`[Sync] Failed to delete event ${googleEventId}:`, error);
    throw error;
  }
}
```

---

## 6. バッチ同期の実装

### 6.1 バッチ処理のメインロジック

```typescript
// app/lib/google-calendar/batch-sync.ts
import { prisma } from "@/app/lib/prisma";
import { syncShiftToGoogleCalendar } from "./sync";

interface BatchSyncResult {
  processed: number;
  syncedCount: number;
  failedCount: number;
  skippedCount: number;
}

/**
 * 同期待ち・失敗状態のシフトをバッチ処理
 */
export async function processPendingSyncs(
  batchSize = 100
): Promise<BatchSyncResult> {
  console.log("[Batch Sync] Starting batch sync...");

  const result: BatchSyncResult = {
    processed: 0,
    syncedCount: 0,
    failedCount: 0,
    skippedCount: 0,
  };

  try {
    // 1. 同期対象シフトを取得
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
        workTimeTypeId: { not: null },
      },
      include: {
        member: { include: { user: true } },
        workTimeType: true,
      },
      take: batchSize,
      orderBy: { createdAt: "asc" },
    });

    console.log(`[Batch Sync] Found ${pendingShifts.length} shifts to process`);

    result.processed = pendingShifts.length;

    // 2. 各シフトを順次同期（レート制限対策）
    for (let i = 0; i < pendingShifts.length; i++) {
      const shift = pendingShifts[i];

      try {
        // レート制限対策: 100msごとに1リクエスト
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        await syncShiftToGoogleCalendar(shift.id);
        result.syncedCount++;
      } catch (error) {
        console.error(`[Batch Sync] Failed to sync shift ${shift.id}:`, error);
        result.failedCount++;
      }
    }

    console.log(
      `[Batch Sync] Completed: ${result.syncedCount} synced, ${result.failedCount} failed`
    );

    return result;
  } catch (error) {
    console.error("[Batch Sync] Error during batch sync:", error);
    throw error;
  }
}
```

### 6.2 初回同期（OAuth認証後）

```typescript
/**
 * 過去30日分のシフトを一括同期（初回連携時）
 */
export async function syncInitialShifts(userId: string): Promise<void> {
  console.log(`[Initial Sync] Starting for user ${userId}`);

  try {
    // 1. 自分自身のメンバーを取得
    const selfMember = await prisma.member.findFirst({
      where: {
        userId: userId,
        isSelf: true,
        isActive: true,
      },
    });

    if (!selfMember) {
      throw new Error("Self member not found");
    }

    // 2. 過去30日分のシフトを取得
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const shifts = await prisma.shift.findMany({
      where: {
        memberId: selfMember.id,
        workTimeTypeId: { not: null }, // 休みを除外
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: "asc" },
    });

    console.log(`[Initial Sync] Found ${shifts.length} shifts to sync`);

    // 3. すべてのシフトをPENDINGに設定
    await prisma.shift.updateMany({
      where: {
        id: { in: shifts.map((s) => s.id) },
      },
      data: {
        syncStatus: "PENDING",
      },
    });

    // 4. バッチ同期を実行（レート制限を考慮）
    for (let i = 0; i < shifts.length; i++) {
      try {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        await syncShiftToGoogleCalendar(shifts[i].id);
      } catch (error) {
        console.error(`[Initial Sync] Failed to sync shift ${shifts[i].id}`);
      }
    }

    console.log(`[Initial Sync] Completed for user ${userId}`);
  } catch (error) {
    console.error(`[Initial Sync] Error for user ${userId}:`, error);
    throw error;
  }
}
```

---

## 7. 手動同期の実装

### 7.1 全シフト再同期

```typescript
/**
 * ユーザーの全シフトを手動で再同期
 */
export async function syncAllShifts(userId: string): Promise<BatchSyncResult> {
  console.log(`[Manual Sync] Starting for user ${userId}`);

  const result: BatchSyncResult = {
    processed: 0,
    syncedCount: 0,
    failedCount: 0,
    skippedCount: 0,
  };

  try {
    // 1. 自分のメンバーを取得
    const selfMember = await prisma.member.findFirst({
      where: {
        userId: userId,
        isSelf: true,
        isActive: true,
      },
    });

    if (!selfMember) {
      throw new Error("Self member not found");
    }

    // 2. すべてのシフトを取得（削除済みを除く）
    const shifts = await prisma.shift.findMany({
      where: {
        memberId: selfMember.id,
        workTimeTypeId: { not: null },
        syncStatus: { not: "DELETED" },
      },
      include: {
        member: { include: { user: true } },
        workTimeType: true,
      },
      orderBy: { date: "desc" },
    });

    result.processed = shifts.length;

    console.log(`[Manual Sync] Found ${shifts.length} shifts`);

    // 3. すべてをPENDINGに変更
    await prisma.shift.updateMany({
      where: {
        id: { in: shifts.map((s) => s.id) },
      },
      data: {
        syncStatus: "PENDING",
      },
    });

    // 4. 順次同期
    for (let i = 0; i < shifts.length; i++) {
      try {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        await syncShiftToGoogleCalendar(shifts[i].id);
        result.syncedCount++;
      } catch (error) {
        console.error(`[Manual Sync] Failed: ${shifts[i].id}`);
        result.failedCount++;
      }
    }

    console.log(
      `[Manual Sync] Completed: ${result.syncedCount}/${result.processed}`
    );

    return result;
  } catch (error) {
    console.error(`[Manual Sync] Error:`, error);
    throw error;
  }
}
```

---

## 8. 連携解除時の一括削除

### 8.1 全イベント削除

```typescript
/**
 * Googleカレンダーから全イベントを削除
 */
export async function deleteAllGoogleEvents(
  userId: string,
  eventIds: string[]
): Promise<number> {
  console.log(`[Disconnect] Deleting ${eventIds.length} events`);

  let deletedCount = 0;

  try {
    // アクセストークン取得
    const accessToken = await getValidAccessToken(userId);

    // OAuth2クライアント初期化
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 並列削除（最大10件ずつ）
    const chunks = chunkArray(eventIds, 10);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map((eventId) =>
          calendar.events.delete({
            calendarId: "primary",
            eventId: eventId,
          })
        )
      );

      // 成功数をカウント
      deletedCount += results.filter((r) => r.status === "fulfilled").length;

      // レート制限対策
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[Disconnect] Deleted ${deletedCount} events`);

    return deletedCount;
  } catch (error) {
    console.error(`[Disconnect] Error deleting events:`, error);
    return deletedCount; // 部分的に成功した場合も返す
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

---

## 9. エラーハンドリング

### 9.1 Google API エラー処理

```typescript
// app/lib/google-calendar/error-handler.ts
import { prisma } from "@/app/lib/prisma";
import { refreshAccessToken } from "./oauth";

/**
 * Google Calendar APIのエラーを処理
 */
export async function handleGoogleApiError(
  error: any,
  shiftId: string
): Promise<void> {
  console.error(`[Error Handler] Processing error for shift ${shiftId}:`, error);

  // エラーコードに応じて処理を分岐
  switch (error.code) {
    case 401:
      // Unauthorized: トークン期限切れ
      await handleTokenExpired(shiftId, error);
      break;

    case 403:
      // Forbidden: 権限不足
      await handleInsufficientPermissions(shiftId, error);
      break;

    case 404:
      // Not Found: イベントが既に削除されている
      await handleEventNotFound(shiftId);
      break;

    case 429:
      // Too Many Requests: レート制限
      await handleRateLimited(shiftId, error);
      break;

    case 500:
    case 503:
      // Google API障害
      await handleGoogleServiceError(shiftId, error);
      break;

    default:
      // その他のエラー
      await handleUnknownError(shiftId, error);
      break;
  }
}

async function handleTokenExpired(shiftId: string, error: any): Promise<void> {
  console.log(`[Error Handler] Token expired for shift ${shiftId}`);

  // シフトのユーザーIDを取得
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { member: true },
  });

  if (!shift) return;

  try {
    // トークンをリフレッシュ
    await refreshAccessToken(shift.member.userId);

    // 再度同期を試行（syncStatus は PENDING のまま、バッチで再試行される）
    console.log(`[Error Handler] Token refreshed, will retry sync`);
  } catch (refreshError) {
    console.error(`[Error Handler] Failed to refresh token:`, refreshError);

    // リフレッシュ失敗 → 連携を無効化
    await prisma.user.update({
      where: { id: shift.member.userId },
      data: { googleCalendarSyncEnabled: false },
    });

    await prisma.shift.update({
      where: { id: shiftId },
      data: { syncStatus: "FAILED" },
    });
  }
}

async function handleInsufficientPermissions(
  shiftId: string,
  error: any
): Promise<void> {
  console.error(
    `[Error Handler] Insufficient permissions for shift ${shiftId}`
  );

  // 権限不足の場合は再認証が必要
  await prisma.shift.update({
    where: { id: shiftId },
    data: { syncStatus: "FAILED" },
  });

  // ユーザーに再認証を促す（実際のUIで通知）
}

async function handleEventNotFound(shiftId: string): Promise<void> {
  console.log(`[Error Handler] Event not found for shift ${shiftId}`);

  // イベントが既に削除されている場合は DELETED に変更
  await prisma.shift.update({
    where: { id: shiftId },
    data: {
      syncStatus: "DELETED",
      googleEventId: null,
    },
  });
}

async function handleRateLimited(shiftId: string, error: any): Promise<void> {
  console.warn(`[Error Handler] Rate limited for shift ${shiftId}`);

  // レート制限の場合は PENDING のまま、バッチ処理で再試行
  // syncStatus は変更しない
}

async function handleGoogleServiceError(
  shiftId: string,
  error: any
): Promise<void> {
  console.error(`[Error Handler] Google service error for shift ${shiftId}`);

  // Google側の障害の場合は PENDING のまま、バッチ処理で再試行
  // syncStatus は変更しない
}

async function handleUnknownError(shiftId: string, error: any): Promise<void> {
  console.error(`[Error Handler] Unknown error for shift ${shiftId}:`, error);

  // 不明なエラーの場合は FAILED に変更
  await prisma.shift.update({
    where: { id: shiftId },
    data: { syncStatus: "FAILED" },
  });
}
```

### 9.2 リトライロジック

```typescript
/**
 * 指数バックオフによるリトライ
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;

      // リトライ可能なエラーか判定
      const isRetryable = [429, 500, 503].includes(error.code);

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // 指数バックオフで待機: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retries exceeded");
}
```

---

## 10. データ整合性の確保

### 10.1 トランザクション管理

```typescript
/**
 * シフト作成と同期をトランザクションで実行
 */
export async function createShiftWithSync(
  memberId: string,
  date: Date,
  workTimeTypeId: string | null,
  note: string | null
) {
  return await prisma.$transaction(async (tx) => {
    // 1. シフトを作成
    const shift = await tx.shift.create({
      data: {
        memberId,
        date,
        workTimeTypeId,
        note,
        syncStatus: workTimeTypeId ? "PENDING" : "DELETED",
      },
      include: {
        member: { include: { user: true } },
        workTimeType: true,
      },
    });

    // 2. 同期対象か判定
    if (!isSyncable(shift)) {
      return shift;
    }

    // 3. Googleカレンダーに同期（トランザクション外で非同期実行）
    // トランザクション内でAPI呼び出しをするとタイムアウトリスクがあるため
    setImmediate(() => {
      syncShiftToGoogleCalendar(shift.id).catch((error) => {
        console.error("Background sync failed:", error);
      });
    });

    return shift;
  });
}
```

### 10.2 同期状態の整合性チェック

```typescript
/**
 * 同期状態の整合性を検証
 */
export async function validateSyncConsistency(userId: string): Promise<{
  isConsistent: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // 1. 自分のメンバーを取得
  const selfMember = await prisma.member.findFirst({
    where: { userId, isSelf: true },
  });

  if (!selfMember) {
    return { isConsistent: false, issues: ["Self member not found"] };
  }

  // 2. SYNCED だが googleEventId がないシフト
  const syncedWithoutEventId = await prisma.shift.count({
    where: {
      memberId: selfMember.id,
      syncStatus: "SYNCED",
      googleEventId: null,
    },
  });

  if (syncedWithoutEventId > 0) {
    issues.push(`${syncedWithoutEventId} shifts marked SYNCED but missing googleEventId`);
  }

  // 3. googleEventId があるが SYNCED でないシフト
  const eventIdWithoutSynced = await prisma.shift.count({
    where: {
      memberId: selfMember.id,
      googleEventId: { not: null },
      syncStatus: { not: "SYNCED" },
    },
  });

  if (eventIdWithoutSynced > 0) {
    issues.push(`${eventIdWithoutSynced} shifts have googleEventId but not marked SYNCED`);
  }

  // 4. 連携無効なのに SYNCED のシフト
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleCalendarSyncEnabled: true },
  });

  if (!user?.googleCalendarSyncEnabled) {
    const syncedShifts = await prisma.shift.count({
      where: {
        memberId: selfMember.id,
        syncStatus: "SYNCED",
      },
    });

    if (syncedShifts > 0) {
      issues.push(`${syncedShifts} shifts marked SYNCED but sync is disabled`);
    }
  }

  return {
    isConsistent: issues.length === 0,
    issues,
  };
}
```

---

## 11. パフォーマンス最適化

### 11.1 バルク操作

```typescript
/**
 * 複数シフトの一括ステータス更新
 */
export async function bulkUpdateSyncStatus(
  shiftIds: string[],
  status: "PENDING" | "SYNCED" | "FAILED" | "DELETED"
): Promise<void> {
  await prisma.shift.updateMany({
    where: {
      id: { in: shiftIds },
    },
    data: {
      syncStatus: status,
      ...(status === "SYNCED" ? { lastSyncedAt: new Date() } : {}),
    },
  });
}
```

### 11.2 並列処理の最適化

```typescript
/**
 * 並列度を制御した同期処理
 */
export async function syncShiftsWithConcurrency(
  shiftIds: string[],
  concurrency = 5
): Promise<void> {
  const chunks = chunkArray(shiftIds, concurrency);

  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map((shiftId) => syncShiftToGoogleCalendar(shiftId))
    );

    // チunk間で100ms待機（レート制限対策）
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
```

---

## 12. モニタリングとログ

### 12.1 同期メトリクスの収集

```typescript
// app/lib/google-calendar/metrics.ts
interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncTime: number;
  lastSyncAt: Date | null;
}

export async function getSyncMetrics(userId: string): Promise<SyncMetrics> {
  const selfMember = await prisma.member.findFirst({
    where: { userId, isSelf: true },
  });

  if (!selfMember) {
    throw new Error("Self member not found");
  }

  const [synced, failed, pending, lastSync] = await Promise.all([
    prisma.shift.count({
      where: { memberId: selfMember.id, syncStatus: "SYNCED" },
    }),
    prisma.shift.count({
      where: { memberId: selfMember.id, syncStatus: "FAILED" },
    }),
    prisma.shift.count({
      where: { memberId: selfMember.id, syncStatus: "PENDING" },
    }),
    prisma.shift.findFirst({
      where: { memberId: selfMember.id, lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
  ]);

  return {
    totalSyncs: synced + failed + pending,
    successfulSyncs: synced,
    failedSyncs: failed,
    averageSyncTime: 0, // 実装時に計測
    lastSyncAt: lastSync?.lastSyncedAt || null,
  };
}
```

---

## 13. まとめ

### 13.1 実装チェックリスト

**リアルタイム同期:**
- [ ] シフト作成時の同期
- [ ] シフト更新時の同期
- [ ] シフト削除時の同期
- [ ] 同期対象判定ロジック
- [ ] イベント変換ロジック

**バッチ同期:**
- [ ] 定期バッチ処理
- [ ] 初回同期処理
- [ ] 手動同期処理
- [ ] レート制限対策

**エラーハンドリング:**
- [ ] トークン期限切れ処理
- [ ] リトライロジック
- [ ] エラー分類と対応
- [ ] 整合性チェック

**パフォーマンス:**
- [ ] 並列処理の最適化
- [ ] バルク操作
- [ ] メトリクス収集

### 13.2 次ステップ

1. ✅ データベーススキーマ設計完了
2. ✅ API設計詳細完了
3. ✅ OAuth認証・セキュリティ詳細完了
4. ✅ 同期ロジック詳細完了
5. ⏭️ UI実装詳細（次のドキュメント）

---

**ドキュメントバージョン:** 1.0
**最終更新日:** 2025-10-19
**レビュー担当者:** （未定）
**次回レビュー予定:** 実装開始前
