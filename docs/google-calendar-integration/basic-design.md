# Googleカレンダー連携機能 仕様書

## 1. 機能概要

本アプリケーションで管理するシフト情報を、ユーザーのGoogleカレンダーに一方向で同期する機能を提供します。

### 1.1 基本方針
- **同期方向**: 本アプリ → Googleカレンダー(一方向)
- **同期対象**: ログインユーザー自身のシフトのみ(Member.isSelf = true)
- **認証方式**: OAuth 2.0によるユーザーごとの個別認証
- **同期タイミング**: リアルタイム同期を優先し、補完としてバッチ処理を実装

---

## 2. ユーザー要件

### 2.1 必須要件
- 連携の動線は設定画面に用意
- 連携済みかどうかの状態を、設定画面上で視認できるようにする
- 本アプリからGoogleカレンダーに一方通行で連携する
- 連携内容は、スケジュール名・時間・メモ
- 本アプリ上でシフトを変更したら、Googleカレンダーに同期させる
- 必要があればバッチ処理で連携させる

### 2.2 追加要件(確認済み)
- ユーザーごとに個別のGoogleアカウントと連携
- ログインユーザー自身のシフトのみを同期
- シフト削除時はGoogleカレンダーからも削除
- リアルタイム同期を優先(バッチは補完用)
- イベント名はWorkTimeType.name(例: 早番、遅番)を使用
- 連携解除時は全イベントを削除

---

## 3. 技術仕様

### 3.1 使用API・ライブラリ
- **API**: Google Calendar API v3
- **ライブラリ**: `googleapis` npm パッケージ
- **認証**: OAuth 2.0 Authorization Code Flow

### 3.2 必要なGoogleカレンダーAPIスコープ
```
https://www.googleapis.com/auth/calendar.events
```
※カレンダーイベントの読み書き権限(最小権限の原則)

### 3.3 環境変数
```env
GOOGLE_CLIENT_ID=<Google Cloud ConsoleのクライアントID>
GOOGLE_CLIENT_SECRET=<Google Cloud Consoleのクライアントシークレット>
GOOGLE_REDIRECT_URI=<OAuth認証後のリダイレクトURI>
ENCRYPTION_KEY=<トークン暗号化用の秘密鍵>
```

---

## 4. データベース設計

### 4.1 Userテーブルの拡張

既存の`User`テーブルに以下のフィールドを追加:

```prisma
model User {
  id                      String    @id @default(cuid())
  email                   String    @unique
  password                String
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  // Googleカレンダー連携関連(追加)
  googleAccessToken       String?   @db.Text  // 暗号化して保存
  googleRefreshToken      String?   @db.Text  // 暗号化して保存
  googleTokenExpiry       DateTime? // アクセストークンの有効期限
  googleCalendarSyncEnabled Boolean @default(false) // 連携有効/無効フラグ

  members                 Member[]
  workTimeTypes           WorkTimeType[]
}
```

### 4.2 Shiftテーブルの拡張

既存の`Shift`テーブルに以下のフィールドを追加:

```prisma
model Shift {
  id              String        @id @default(cuid())
  memberId        String
  workTimeTypeId  String?
  date            DateTime      @db.Date
  note            String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Googleカレンダー連携関連(追加)
  googleEventId   String?       // Googleカレンダーのイベントを一意に識別するID
  lastSyncedAt    DateTime?     // 最後に同期した日時
  syncStatus      SyncStatus    @default(PENDING) // 同期状態

  member          Member        @relation(fields: [memberId], references: [id], onDelete: Cascade)
  workTimeType    WorkTimeType? @relation(fields: [workTimeTypeId], references: [id], onDelete: SetNull)

  @@unique([memberId, date])
}

enum SyncStatus {
  PENDING    // 同期待ち
  SYNCED     // 同期済み
  FAILED     // 同期失敗
  DELETED    // Googleカレンダーから削除済み
}
```

---

## 5. 同期仕様

### 5.1 同期対象の判定ロジック

以下の条件を**すべて**満たすシフトのみを同期:

1. `Member.isSelf = true` (ログインユーザー自身のシフト)
2. `Member.userId` = ログイン中のユーザーID
3. `User.googleCalendarSyncEnabled = true` (連携が有効)
4. `Shift.workTimeTypeId` が null でない (シフトパターンが設定されている)

### 5.2 Googleカレンダーイベント形式

```typescript
{
  summary: string        // WorkTimeType.name (例: "早番", "遅番")
  description: string    // Shift.note (なければ空文字)
  start: {
    dateTime: string     // ISO 8601形式 (例: "2025-10-19T07:00:00+09:00")
    timeZone: string     // "Asia/Tokyo"
  }
  end: {
    dateTime: string     // ISO 8601形式 (例: "2025-10-19T16:00:00+09:00")
    timeZone: string     // "Asia/Tokyo"
  }
  colorId: string        // WorkTimeType.color に基づいて変換
}
```

### 5.3 同期タイミング

#### 5.3.1 リアルタイム同期(優先)

以下のタイミングで即座にGoogle Calendar APIを呼び出し:

- **シフト作成時**: `POST /api/shifts` → `calendar.events.insert()`
- **シフト更新時**: `PUT /api/shifts/:id` → `calendar.events.update()`
- **シフト削除時**: `DELETE /api/shifts/:id` → `calendar.events.delete()`

#### 5.3.2 バッチ同期(補完)

以下のケースに対応するため、定期的なバッチ処理を実装:

- リアルタイム同期が失敗した場合の再試行
- ネットワークエラーなどで同期漏れが発生した場合の補正
- `syncStatus = PENDING` または `FAILED` のレコードを対象に同期

**実行頻度**: 1日1回(深夜2時など)

```typescript
// バッチ処理の対象クエリ例
const pendingShifts = await prisma.shift.findMany({
  where: {
    member: {
      isSelf: true,
      user: {
        googleCalendarSyncEnabled: true
      }
    },
    syncStatus: { in: ['PENDING', 'FAILED'] },
    workTimeTypeId: { not: null }
  },
  include: {
    member: { include: { user: true } },
    workTimeType: true
  }
});
```

### 5.4 同期時のエラーハンドリング

#### 5.4.1 トークンリフレッシュ

アクセストークンの有効期限切れ時は自動的にリフレッシュ:

```typescript
if (user.googleTokenExpiry && user.googleTokenExpiry < new Date()) {
  const newTokens = await refreshGoogleAccessToken(user.googleRefreshToken);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      googleAccessToken: encrypt(newTokens.access_token),
      googleTokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000)
    }
  });
}
```

#### 5.4.2 リトライロジック

API呼び出しが失敗した場合は以下のルールで再試行:

- **ネットワークエラー**: 指数バックオフで最大3回リトライ
- **認証エラー**: トークンリフレッシュ後に1回リトライ
- **その他エラー**: `syncStatus = FAILED` に設定し、バッチ処理に委ねる

#### 5.4.3 失敗時のUI表示

- 設定画面に同期ステータスを表示
- `syncStatus = FAILED` のシフトがある場合、警告メッセージを表示
- 「手動で再同期」ボタンを提供

---

## 6. UI仕様

### 6.1 設定画面(/settings)

#### 6.1.1 連携前の表示

```
┌─────────────────────────────────────┐
│ Googleカレンダー連携                │
├─────────────────────────────────────┤
│ 状態: 未連携                        │
│                                     │
│ 自分のシフトをGoogleカレンダーに    │
│ 自動的に同期できます。              │
│                                     │
│ [Googleと連携する]                  │
└─────────────────────────────────────┘
```

#### 6.1.2 連携後の表示

```
┌─────────────────────────────────────┐
│ Googleカレンダー連携                │
├─────────────────────────────────────┤
│ 状態: 連携済み ✓                    │
│ アカウント: user@example.com        │
│                                     │
│ 最終同期: 2025-10-19 14:30          │
│ 同期済みシフト: 15件                │
│ 同期待ち: 0件                       │
│                                     │
│ [今すぐ同期]  [連携を解除]          │
└─────────────────────────────────────┘
```

#### 6.1.3 連携エラー時の表示

```
┌─────────────────────────────────────┐
│ Googleカレンダー連携                │
├─────────────────────────────────────┤
│ 状態: 同期エラー ⚠️                 │
│ アカウント: user@example.com        │
│                                     │
│ 最終同期: 2025-10-19 14:30          │
│ 同期失敗: 3件                       │
│                                     │
│ ⚠️ 一部のシフトが同期できませんでした│
│                                     │
│ [再試行]  [連携を解除]              │
└─────────────────────────────────────┘
```

### 6.2 連携フロー

1. **「Googleと連携する」ボタンをクリック**
   - OAuth 2.0認証画面にリダイレクト
   - Googleアカウントでログイン
   - カレンダー権限の許可

2. **認証成功後**
   - リダイレクトURIにコールバック
   - アクセストークン・リフレッシュトークンを取得
   - 暗号化してDBに保存
   - `googleCalendarSyncEnabled = true` に設定
   - 設定画面に戻り「連携済み」を表示

3. **既存シフトの初回同期**
   - 連携完了後、過去30日分の自分のシフトを一括同期
   - 進捗状況をローディング表示

### 6.3 連携解除フロー

1. **「連携を解除」ボタンをクリック**
   - 確認ダイアログを表示:
     ```
     Googleカレンダーとの連携を解除しますか?

     同期済みのイベントはすべて削除されます。
     この操作は取り消せません。

     [キャンセル]  [解除する]
     ```

2. **「解除する」を選択**
   - 同期済みの全イベントをGoogleカレンダーから削除
   - DBの `googleAccessToken`, `googleRefreshToken` をクリア
   - `googleCalendarSyncEnabled = false` に設定
   - Shift.googleEventId をクリア
   - 設定画面を「未連携」状態に戻す

---

## 7. セキュリティ仕様

### 7.1 トークンの暗号化

アクセストークンとリフレッシュトークンは平文でDBに保存せず、AES-256-GCMで暗号化:

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32バイト

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 7.2 認可チェック

すべてのAPI呼び出しで以下を確認:

1. ユーザーが認証済み(`auth()`)
2. 操作対象のシフトが自分のものである(`member.userId === session.user.id`)
3. Googleカレンダー連携が有効(`user.googleCalendarSyncEnabled === true`)

### 7.3 スコープの最小化

必要最小限の権限のみをリクエスト:
- ✅ `https://www.googleapis.com/auth/calendar.events` (イベントの読み書きのみ)
- ❌ `https://www.googleapis.com/auth/calendar` (カレンダー全体の管理権限は不要)

---

## 8. API設計

### 8.1 OAuth認証エンドポイント

#### `GET /api/google-calendar/auth`
Googleの認証画面にリダイレクト

**クエリパラメータ**: なし

**レスポンス**: 302 Redirect to Google OAuth

---

#### `GET /api/google-calendar/callback`
OAuth認証後のコールバック

**クエリパラメータ**:
- `code`: 認証コード
- `state`: CSRF対策用ステート

**処理内容**:
1. 認証コードをアクセストークンに交換
2. トークンを暗号化してDBに保存
3. 過去30日分のシフトを一括同期
4. `/settings` にリダイレクト

---

### 8.2 同期管理エンドポイント

#### `POST /api/google-calendar/sync`
手動で全シフトを再同期

**リクエストボディ**: なし

**レスポンス**:
```json
{
  "success": true,
  "syncedCount": 15,
  "failedCount": 0
}
```

---

#### `DELETE /api/google-calendar/disconnect`
連携を解除し、全イベントを削除

**リクエストボディ**: なし

**レスポンス**:
```json
{
  "success": true,
  "deletedCount": 15
}
```

---

### 8.3 シフトAPI拡張

既存のシフトAPIに同期ロジックを追加:

#### `POST /api/shifts`
シフト作成後、Googleカレンダーにイベントを作成

#### `PUT /api/shifts/:id`
シフト更新後、Googleカレンダーのイベントを更新

#### `DELETE /api/shifts/:id`
シフト削除後、Googleカレンダーのイベントを削除

---

## 9. バッチ処理設計

### 9.1 実装方法

Next.js API RouteをCronジョブ(Vercel Cronなど)で定期実行:

#### `GET /api/cron/sync-calendar`

**処理フロー**:
1. `syncStatus = PENDING or FAILED` のシフトを取得
2. 各ユーザーのトークンをデコード
3. トークンが期限切れならリフレッシュ
4. Google Calendar APIを呼び出し
5. 成功したら `syncStatus = SYNCED` に更新
6. 失敗したら `syncStatus = FAILED` に保持(次回再試行)

**認証**:
- `Authorization: Bearer <CRON_SECRET>` ヘッダーで保護

### 9.2 Vercel Cron設定例

`vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/sync-calendar",
    "schedule": "0 2 * * *"
  }]
}
```
※毎日深夜2時に実行

---

## 10. テスト仕様

### 10.1 単体テスト

- トークンの暗号化/復号化
- 同期対象シフトの判定ロジック
- Googleカレンダーイベントの変換ロジック

### 10.2 統合テスト

- OAuth認証フロー
- シフト作成→Googleカレンダーに同期
- シフト更新→Googleカレンダーに反映
- シフト削除→Googleカレンダーから削除
- 連携解除→全イベント削除

### 10.3 E2Eテスト

- ユーザーが設定画面で連携ボタンをクリック
- Google認証画面でログイン
- 連携完了後、既存シフトが同期される
- 新しいシフトを作成すると即座にカレンダーに反映される
- 連携解除すると全イベントが削除される

---

## 11. エラーケース

### 11.1 想定されるエラー

| エラー内容 | 原因 | 対処方法 |
|----------|------|---------|
| 401 Unauthorized | トークン期限切れ | リフレッシュトークンで再取得 |
| 403 Forbidden | スコープ不足 | 再認証を促す |
| 404 Not Found | イベントが既に削除されている | `syncStatus = DELETED` に設定 |
| 429 Too Many Requests | レート制限 | 指数バックオフで再試行 |
| 500 Internal Server Error | Google API障害 | バッチ処理で再試行 |

### 11.2 フォールバック動作

- リアルタイム同期が失敗しても、ユーザーにはエラーを表示せずバックグラウンドで再試行
- 設定画面で同期状態を確認可能
- バッチ処理が最終的に同期を補完

---

## 12. パフォーマンス考慮事項

### 12.1 レート制限対策

Google Calendar APIのクォータ制限を考慮:
- **ユーザーあたり**: 1秒あたり10リクエスト
- **プロジェクト全体**: 1日あたり100万リクエスト

対策:
- バッチ処理では各ユーザーのリクエスト間隔を100ms以上空ける
- エラー時の再試行は指数バックオフを使用

### 12.2 DB負荷軽減

- `syncStatus` にインデックスを作成
- バッチ処理では一度に処理する件数を制限(例: 100件/回)

---

## 13. 今後の拡張可能性

### 13.1 将来的な検討事項

- 双方向同期(Googleカレンダー → 本アプリ)
- 複数カレンダーへの同期(プライベート/仕事用など)
- 他のカレンダーサービス対応(Outlook、Apple Calendar)
- スタッフ全員のシフトを別カレンダーに同期
- リマインダー通知の設定

---

## 14. 実装優先度

### Phase 1: MVP(最小機能)
1. OAuth認証フロー
2. DBスキーマ拡張
3. 設定画面UI
4. リアルタイム同期(作成・更新・削除)
5. 連携解除機能

### Phase 2: 安定化
1. エラーハンドリング強化
2. トークン暗号化
3. バッチ処理実装
4. 手動再同期機能

### Phase 3: 改善
1. 同期ステータス詳細表示
2. パフォーマンス最適化
3. E2Eテスト整備
4. ユーザーガイド作成

---

## 15. 関連ドキュメント

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Next.js Authentication Best Practices](https://nextjs.org/docs/app/building-your-application/authentication)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

---

**最終更新日**: 2025-10-19
**作成者**: 開発チーム
**バージョン**: 1.0
