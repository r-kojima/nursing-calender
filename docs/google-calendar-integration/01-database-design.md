# データベース設計詳細

## 1. 概要

Googleカレンダー連携機能を実装するために、既存のデータベーススキーマを拡張します。本ドキュメントでは、スキーマ変更、マイグレーション戦略、インデックス設計、およびデータ整合性の確保方法について詳細に記述します。

## 2. スキーマ変更の全体像

### 2.1 変更対象テーブル

1. **User** - Googleカレンダー認証情報の保存
2. **Shift** - 同期状態の管理
3. **SyncStatus** (新規enum) - 同期ステータスの定義

### 2.2 変更しないテーブル

- **Member** - 変更なし（`isSelf`フィールドは既存）
- **WorkTimeType** - 変更なし（既存のフィールドで対応可能）
- **Account/Session/VerificationToken** - NextAuth関連テーブルは変更なし

---

## 3. Userテーブルの拡張

### 3.1 追加フィールド

```prisma
model User {
  id                      String    @id @default(cuid())
  email                   String    @unique
  password                String
  name                    String
  emailVerified           DateTime?
  image                   String?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  // 既存のリレーション
  members                 Member[]
  workTimeTypes           WorkTimeType[]
  accounts                Account[]
  sessions                Session[]

  // ===== Googleカレンダー連携フィールド（追加） =====
  googleAccessToken       String?   @db.Text
  googleRefreshToken      String?   @db.Text
  googleTokenExpiry       DateTime?
  googleCalendarSyncEnabled Boolean @default(false)
  googleCalendarEmail     String?   // 連携したGoogleアカウントのメールアドレス
  googleCalendarLastSync  DateTime? // 最後に同期した日時
}
```

### 3.2 フィールド詳細仕様

| フィールド名 | 型 | NULL許可 | デフォルト | 説明 |
|------------|-----|---------|----------|------|
| `googleAccessToken` | `String?` | ✅ | `null` | Googleアクセストークン（AES-256-GCM暗号化済み） |
| `googleRefreshToken` | `String?` | ✅ | `null` | Googleリフレッシュトークン（AES-256-GCM暗号化済み） |
| `googleTokenExpiry` | `DateTime?` | ✅ | `null` | アクセストークンの有効期限（UTC） |
| `googleCalendarSyncEnabled` | `Boolean` | ❌ | `false` | 同期機能の有効/無効フラグ |
| `googleCalendarEmail` | `String?` | ✅ | `null` | 連携したGoogleアカウントのメールアドレス（表示用） |
| `googleCalendarLastSync` | `DateTime?` | ✅ | `null` | 最後に同期が成功した日時（バッチ処理での参照用） |

### 3.3 データ型選択の理由

#### 3.3.1 `@db.Text` の使用

```prisma
googleAccessToken  String? @db.Text
googleRefreshToken String? @db.Text
```

**理由:**
- アクセストークンは通常2048文字以上になる可能性がある
- AES-256-GCM暗号化後は元のサイズの約1.5倍になる
- PostgreSQLの`VARCHAR(255)`では不足する可能性があるため`TEXT`型を使用

#### 3.3.2 `DateTime?` (nullable) の使用

```prisma
googleTokenExpiry      DateTime?
googleCalendarLastSync DateTime?
```

**理由:**
- 連携前は値が存在しないため`null`許可が必要
- 連携解除時に`null`に戻すことで「未連携」状態を表現

### 3.4 制約と検証ルール

#### 3.4.1 アプリケーションレベルの検証

```typescript
// 連携有効時はトークン必須
if (user.googleCalendarSyncEnabled) {
  if (!user.googleAccessToken || !user.googleRefreshToken) {
    throw new Error("Invalid sync configuration: tokens missing");
  }
}
```

#### 3.4.2 暗号化データの検証

```typescript
// トークンの保存前に暗号化を確認
const encryptedToken = encrypt(accessToken);
if (!encryptedToken.includes(':')) {
  throw new Error("Invalid encrypted token format");
}
```

---

## 4. Shiftテーブルの拡張

### 4.1 追加フィールド

```prisma
model Shift {
  id             String        @id @default(cuid())
  memberId       String
  workTimeTypeId String?
  date           DateTime      @db.Date
  note           String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  // 既存のリレーション
  member         Member        @relation(fields: [memberId], references: [id], onDelete: Cascade)
  workTimeType   WorkTimeType? @relation(fields: [workTimeTypeId], references: [id], onDelete: SetNull)

  // ===== Googleカレンダー連携フィールド（追加） =====
  googleEventId  String?       // GoogleカレンダーのイベントID
  lastSyncedAt   DateTime?     // 最後に同期した日時（UTC）
  syncStatus     SyncStatus    @default(PENDING) // 同期ステータス

  @@unique([memberId, date])
  @@index([date])
  @@index([syncStatus]) // 追加: バッチ処理用インデックス
  @@index([memberId, syncStatus]) // 追加: 複合インデックス
}

enum SyncStatus {
  PENDING    // 同期待ち
  SYNCED     // 同期済み
  FAILED     // 同期失敗
  DELETED    // Googleカレンダーから削除済み
}
```

### 4.2 フィールド詳細仕様

| フィールド名 | 型 | NULL許可 | デフォルト | 説明 |
|------------|-----|---------|----------|------|
| `googleEventId` | `String?` | ✅ | `null` | GoogleカレンダーAPIが返すイベントID（例: `abc123def456`） |
| `lastSyncedAt` | `DateTime?` | ✅ | `null` | 最後に同期が成功した日時（UTC）。失敗時は更新しない |
| `syncStatus` | `SyncStatus` | ❌ | `PENDING` | 同期ステータス（後述のenum参照） |

### 4.3 SyncStatus Enum詳細

| 値 | 意味 | 遷移元 | 遷移先 | 使用ケース |
|----|------|-------|-------|----------|
| `PENDING` | 同期待ち | - | `SYNCED`, `FAILED` | シフト作成直後、同期が必要な状態 |
| `SYNCED` | 同期済み | `PENDING`, `FAILED` | `PENDING`, `DELETED` | Googleカレンダーに正常に反映済み |
| `FAILED` | 同期失敗 | `PENDING`, `SYNCED` | `SYNCED`, `PENDING` | API呼び出し失敗、バッチ処理で再試行対象 |
| `DELETED` | 削除済み | `SYNCED` | - | Googleカレンダーから削除済み（論理削除の記録） |

### 4.4 syncStatusの状態遷移図

```
[作成]
  ↓
PENDING ──(同期成功)──→ SYNCED ──(削除)──→ DELETED
  ↓                      ↓
  └──(同期失敗)──→ FAILED ──(再試行成功)──→ SYNCED
       ↑                ↑
       └────(更新失敗)───┘
```

### 4.5 インデックス設計

#### 4.5.1 既存インデックス

```prisma
@@index([date]) // 日付による検索用（既存）
```

**用途:** カレンダー表示時の月別シフト取得

**クエリ例:**
```typescript
await prisma.shift.findMany({
  where: { date: { gte: startOfMonth, lte: endOfMonth } }
});
```

#### 4.5.2 新規インデックス（追加）

##### 単一カラムインデックス

```prisma
@@index([syncStatus])
```

**用途:** バッチ処理での同期待ちシフト抽出

**クエリ例:**
```typescript
await prisma.shift.findMany({
  where: { syncStatus: { in: ['PENDING', 'FAILED'] } }
});
```

##### 複合インデックス

```prisma
@@index([memberId, syncStatus])
```

**用途:** 特定メンバーの同期失敗シフトを効率的に取得

**クエリ例:**
```typescript
await prisma.shift.findMany({
  where: {
    memberId: 'member123',
    syncStatus: 'FAILED'
  }
});
```

#### 4.5.3 インデックスサイズの見積もり

**前提条件:**
- 1ユーザーあたりメンバー数: 10人
- シフトデータ保持期間: 2年（730日）
- 総レコード数: 10人 × 730日 = 7,300レコード/ユーザー

**インデックスサイズ:**
- `syncStatus` (ENUM): 1バイト × 7,300 = 7.3 KB
- `memberId` (CUID): 25バイト × 7,300 = 178 KB
- 複合インデックス: 約 185 KB/ユーザー

**結論:** インデックスサイズは十分に小さく、パフォーマンスへの影響は軽微

---

## 5. マイグレーション戦略

### 5.1 マイグレーション実行計画

#### Phase 1: スキーマ変更の適用

```bash
# 1. マイグレーションファイルの生成
npx prisma migrate dev --name add_google_calendar_integration

# 2. 生成されるマイグレーションファイルの確認
# prisma/migrations/YYYYMMDDHHMMSS_add_google_calendar_integration/migration.sql
```

#### Phase 2: 既存データへの対応

**既存のShiftレコードの処理:**

```sql
-- すべての既存シフトのsyncStatusをPENDINGに設定（デフォルト値により自動適用）
-- ただし、isSelf=falseのメンバーのシフトはDELETEDに設定（同期対象外のため）

UPDATE "Shift"
SET "syncStatus" = 'DELETED'
WHERE "memberId" IN (
  SELECT id FROM "Member" WHERE "isSelf" = false
);
```

**理由:**
- `isSelf = false` のメンバー（他の保育士）のシフトは同期対象外
- `DELETED` ステータスに設定することでバッチ処理の対象外にする

### 5.2 マイグレーション後の検証

#### 5.2.1 データ整合性チェック

```typescript
// scripts/validate-migration.ts
import { prisma } from '../app/lib/prisma';

async function validateMigration() {
  // 1. すべてのUserにgoogleCalendarSyncEnabledが存在するか確認
  const usersWithoutFlag = await prisma.user.count({
    where: { googleCalendarSyncEnabled: null }
  });
  console.log(`Users without sync flag: ${usersWithoutFlag}`); // 0であるべき

  // 2. すべてのShiftにsyncStatusが存在するか確認
  const shiftsWithoutStatus = await prisma.shift.count({
    where: { syncStatus: null }
  });
  console.log(`Shifts without sync status: ${shiftsWithoutStatus}`); // 0であるべき

  // 3. インデックスが作成されているか確認
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'Shift' AND indexname LIKE '%syncStatus%'
  `;
  console.log('Sync status indexes:', indexes);
}

validateMigration();
```

#### 5.2.2 ロールバック手順

万が一問題が発生した場合のロールバック:

```bash
# マイグレーションを1つ戻す
npx prisma migrate resolve --rolled-back YYYYMMDDHHMMSS_add_google_calendar_integration

# スキーマを以前の状態に復元
git checkout HEAD~1 -- prisma/schema.prisma
npx prisma migrate dev
```

---

## 6. データ整合性の確保

### 6.1 トランザクション管理

#### 6.1.1 シフト作成時の同期

```typescript
async function createShiftWithSync(data: ShiftCreateInput) {
  return await prisma.$transaction(async (tx) => {
    // 1. シフトを作成
    const shift = await tx.shift.create({
      data: {
        ...data,
        syncStatus: 'PENDING' // 初期状態は同期待ち
      }
    });

    // 2. 同期対象か判定
    const member = await tx.member.findUnique({
      where: { id: shift.memberId },
      include: { user: true }
    });

    if (!member?.isSelf || !member.user.googleCalendarSyncEnabled) {
      // 同期対象外の場合はDELETEDに変更
      await tx.shift.update({
        where: { id: shift.id },
        data: { syncStatus: 'DELETED' }
      });
      return shift;
    }

    // 3. Googleカレンダーに同期（トランザクション外で非同期実行）
    // ※ トランザクション内でAPI呼び出しをするとタイムアウトリスクがあるため分離
    syncToGoogleCalendar(shift.id).catch(console.error);

    return shift;
  });
}
```

#### 6.1.2 連携解除時の一括削除

```typescript
async function disconnectGoogleCalendar(userId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. すべての同期済みシフトを取得
    const syncedShifts = await tx.shift.findMany({
      where: {
        member: { userId, isSelf: true },
        syncStatus: 'SYNCED',
        googleEventId: { not: null }
      }
    });

    // 2. Googleカレンダーから削除（並列処理）
    await Promise.allSettled(
      syncedShifts.map(shift => deleteGoogleEvent(shift.googleEventId!))
    );

    // 3. DBのトークン情報をクリア
    await tx.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleCalendarSyncEnabled: false,
        googleCalendarEmail: null,
        googleCalendarLastSync: null
      }
    });

    // 4. シフトの同期情報をクリア
    await tx.shift.updateMany({
      where: { member: { userId, isSelf: true } },
      data: {
        googleEventId: null,
        syncStatus: 'DELETED',
        lastSyncedAt: null
      }
    });
  });
}
```

### 6.2 制約とビジネスルール

#### 6.2.1 同期対象の条件

以下の条件を**すべて**満たすシフトのみ同期:

```typescript
function isSyncable(shift: Shift & { member: Member & { user: User } }): boolean {
  return (
    shift.member.isSelf === true &&                          // 1. 本人のシフト
    shift.member.user.googleCalendarSyncEnabled === true &&  // 2. 連携が有効
    shift.workTimeTypeId !== null &&                         // 3. シフトパターンが設定されている
    shift.syncStatus !== 'DELETED'                           // 4. 削除済みでない
  );
}
```

#### 6.2.2 同期状態の更新ルール

| 操作 | 更新フィールド | 値 |
|-----|--------------|-----|
| シフト作成成功 | `syncStatus` | `PENDING` |
| 同期成功 | `syncStatus`, `lastSyncedAt`, `googleEventId` | `SYNCED`, `now()`, `eventId` |
| 同期失敗 | `syncStatus` | `FAILED` |
| シフト削除（論理削除） | `syncStatus`, `googleEventId` | `DELETED`, `null` |
| 連携解除 | `syncStatus`, `googleEventId`, `lastSyncedAt` | `DELETED`, `null`, `null` |

---

## 7. パフォーマンス最適化

### 7.1 クエリ最適化

#### 7.1.1 N+1問題の回避

**悪い例:**
```typescript
const shifts = await prisma.shift.findMany({ where: { syncStatus: 'PENDING' } });
for (const shift of shifts) {
  const member = await prisma.member.findUnique({ where: { id: shift.memberId } }); // N+1!
}
```

**良い例:**
```typescript
const shifts = await prisma.shift.findMany({
  where: { syncStatus: 'PENDING' },
  include: {
    member: { include: { user: true } },
    workTimeType: true
  }
});
```

#### 7.1.2 バッチ処理用のページネーション

```typescript
async function processPendingSyncs(batchSize = 100) {
  let cursor: string | undefined = undefined;

  while (true) {
    const shifts = await prisma.shift.findMany({
      where: { syncStatus: { in: ['PENDING', 'FAILED'] } },
      take: batchSize,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'asc' },
      include: { member: { include: { user: true } }, workTimeType: true }
    });

    if (shifts.length === 0) break;

    await processShiftBatch(shifts);
    cursor = shifts[shifts.length - 1].id;
  }
}
```

### 7.2 インデックス使用状況の監視

```sql
-- インデックスが実際に使用されているか確認
EXPLAIN ANALYZE
SELECT * FROM "Shift"
WHERE "syncStatus" IN ('PENDING', 'FAILED')
  AND "memberId" = 'member123';

-- 期待される実行計画: Index Scan using Shift_memberId_syncStatus_idx
```

---

## 8. セキュリティ考慮事項

### 8.1 暗号化データの保護

#### 8.1.1 暗号化キーの管理

```env
# .env (開発環境)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# 本番環境ではVercelのEnvironment Secretsで管理
# キーローテーション: 6ヶ月ごとに変更を推奨
```

#### 8.1.2 トークンのアクセス制御

```typescript
// app/lib/google-calendar.ts
import { auth } from './auth';

export async function getDecryptedTokens(userId: string) {
  const session = await auth();

  // 認証チェック: 自分のトークンのみ取得可能
  if (session?.user?.id !== userId) {
    throw new Error('Unauthorized: Cannot access other user tokens');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleAccessToken) {
    throw new Error('No Google tokens found');
  }

  return {
    accessToken: decrypt(user.googleAccessToken),
    refreshToken: user.googleRefreshToken ? decrypt(user.googleRefreshToken) : null
  };
}
```

### 8.2 SQLインジェクション対策

Prismaを使用することで自動的にパラメータ化クエリが生成されるため、基本的にSQLインジェクションのリスクはありません。ただし、生SQLを使用する場合は以下のように対策:

```typescript
// ❌ 危険: 文字列結合
await prisma.$queryRawUnsafe(`SELECT * FROM "Shift" WHERE id = '${shiftId}'`);

// ✅ 安全: パラメータ化クエリ
await prisma.$queryRaw`SELECT * FROM "Shift" WHERE id = ${shiftId}`;
```

---

## 9. データバックアップ戦略

### 9.1 マイグレーション前のバックアップ

```bash
# PostgreSQLダンプの取得
pg_dump $DATABASE_URL > backup_before_migration_$(date +%Y%m%d).sql

# Vercel Postgresの場合
vercel env pull .env.local
pg_dump $(cat .env.local | grep DATABASE_URL | cut -d '=' -f2) > backup.sql
```

### 9.2 本番環境への適用手順

1. **ステージング環境でテスト**
   ```bash
   # ステージング環境でマイグレーション実行
   DATABASE_URL=$STAGING_DATABASE_URL npx prisma migrate deploy
   ```

2. **バックアップ取得**
   ```bash
   pg_dump $PRODUCTION_DATABASE_URL > production_backup.sql
   ```

3. **本番適用**
   ```bash
   DATABASE_URL=$PRODUCTION_DATABASE_URL npx prisma migrate deploy
   ```

4. **検証スクリプト実行**
   ```bash
   npm run validate-migration
   ```

---

## 10. モニタリングとアラート

### 10.1 監視すべきメトリクス

| メトリクス | 正常範囲 | アラート条件 |
|----------|---------|------------|
| FAILED状態のシフト数 | < 10件 | > 50件 |
| 最終同期からの経過時間 | < 24時間 | > 48時間 |
| トークン有効期限切れユーザー数 | 0人 | > 5人 |
| バッチ処理の実行時間 | < 5分 | > 10分 |

### 10.2 監視クエリ例

```typescript
// app/api/admin/sync-health/route.ts
export async function GET() {
  const [failedCount, expiredTokens] = await Promise.all([
    // 同期失敗シフト数
    prisma.shift.count({ where: { syncStatus: 'FAILED' } }),

    // トークン期限切れユーザー数
    prisma.user.count({
      where: {
        googleCalendarSyncEnabled: true,
        googleTokenExpiry: { lt: new Date() }
      }
    })
  ]);

  return Response.json({
    failedShifts: failedCount,
    expiredTokenUsers: expiredTokens,
    status: failedCount > 50 || expiredTokens > 5 ? 'WARNING' : 'OK'
  });
}
```

---

## 11. まとめ

### 11.1 変更サマリー

| 対象 | 変更内容 | 影響範囲 |
|-----|---------|---------|
| Userテーブル | 6フィールド追加 | 全ユーザー |
| Shiftテーブル | 3フィールド + 2インデックス追加 | 全シフトレコード |
| 新規enum | SyncStatus定義 | - |

### 11.2 次ステップ

1. ✅ データベーススキーマ設計完了
2. ⏭️ API設計詳細（次のドキュメント）
3. ⏭️ OAuth認証・セキュリティ詳細
4. ⏭️ 同期ロジック詳細
5. ⏭️ UI実装詳細

---

**ドキュメントバージョン:** 1.0
**最終更新日:** 2025-10-19
**レビュー担当者:** （未定）
**次回レビュー予定:** マイグレーション実行前
