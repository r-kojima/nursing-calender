# Google Calendar 連携セットアップガイド

このガイドでは、Google Calendar連携機能を使用するために必要なGoogle Cloud Consoleの設定手順を説明します。

## 前提条件

- Googleアカウントを持っていること
- 開発サーバーが`http://localhost:3000`で動作していること

## セットアップ手順

### 1. Google Cloud Consoleへアクセス

1. [Google Cloud Console](https://console.cloud.google.com)にアクセス
2. Googleアカウントでログイン

### 2. プロジェクトの作成

1. 画面上部の「プロジェクトを選択」をクリック
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: `nursing-calendar-dev`）
4. 「作成」をクリック
5. 作成したプロジェクトを選択

### 3. Google Calendar API の有効化

1. 左側メニューから「APIとサービス」→「ライブラリ」を選択
2. 検索ボックスに「Google Calendar API」と入力
3. 「Google Calendar API」をクリック
4. 「有効にする」ボタンをクリック

### 4. OAuth 同意画面の設定

1. 左側メニューから「APIとサービス」→「OAuth同意画面」を選択
2. **ユーザータイプ**で「外部」を選択して「作成」
3. **アプリ情報**を入力:
   - アプリ名: `Nursing Calendar` (任意)
   - ユーザーサポートメール: あなたのメールアドレス
   - デベロッパーの連絡先情報: あなたのメールアドレス
4. 「保存して次へ」をクリック

5. **スコープ**画面で「スコープを追加または削除」をクリック
6. フィルタに「calendar」と入力
7. `https://www.googleapis.com/auth/calendar.events` を選択
8. 「更新」→「保存して次へ」をクリック

9. **テストユーザー**画面で「ユーザーを追加」をクリック
10. テスト用のGoogleアカウントのメールアドレスを入力
11. 「保存して次へ」をクリック

12. 「ダッシュボードに戻る」をクリック

### 5. OAuth クライアント ID の作成

1. 左側メニューから「APIとサービス」→「認証情報」を選択
2. 「認証情報を作成」→「OAuthクライアントID」をクリック
3. アプリケーションの種類で「ウェブアプリケーション」を選択
4. 名前を入力（例: `Nursing Calendar Web Client`）
5. **承認済みのリダイレクトURI**で「URIを追加」をクリック
6. 以下のURIを入力:
   ```
   http://localhost:3000/api/google-calendar/callback
   ```
7. 「作成」をクリック

8. 表示されたダイアログから以下の情報をコピー:
   - **クライアントID** (例: `123456789012-abcdefghijk...apps.googleusercontent.com`)
   - **クライアントシークレット** (例: `GOCSPX-abc...`)

### 6. 環境変数の設定

1. プロジェクトのルートディレクトリにある `.env` ファイルを開く
2. 以下の値を、先ほどコピーした値に置き換える:

```env
# Google Calendar Integration
GOOGLE_CLIENT_ID="<コピーしたクライアントID>"
GOOGLE_CLIENT_SECRET="<コピーしたクライアントシークレット>"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google-calendar/callback"
ENCRYPTION_KEY="<既存の値をそのまま使用>"
```

**例:**
```env
GOOGLE_CLIENT_ID="123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-abcdefghijklmnopqrstuvwx"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google-calendar/callback"
ENCRYPTION_KEY="f239dbbcd24771f1e56e98190faa7c759963ac60158a6fca9b4a1985a4f996da"
```

3. ファイルを保存

### 7. 開発サーバーの再起動

環境変数を変更したため、開発サーバーを再起動する必要があります:

```bash
# 開発サーバーを停止 (Ctrl+C)
# 再起動
npm run dev
```

### 8. 動作確認

1. ブラウザで `http://localhost:3000/settings` にアクセス
2. 「Googleカレンダー連携」カードの「Googleと連携する」ボタンをクリック
3. Google認証画面が表示されることを確認
4. テストユーザーとしてログイン
5. カレンダーへのアクセス権限を許可
6. 設定画面にリダイレクトされ、「連携済み」と表示されることを確認

## トラブルシューティング

### "Missing required parameter: client_id" エラー

**原因:** 環境変数が設定されていない、または開発サーバーが再起動されていない

**解決策:**
1. `.env` ファイルに正しい値が設定されているか確認
2. 開発サーバーを再起動 (`npm run dev`)

### "redirect_uri_mismatch" エラー

**原因:** Google Cloud Consoleに登録したリダイレクトURIと、環境変数の値が一致していない

**解決策:**
1. Google Cloud Consoleで設定したリダイレクトURIを確認
2. `.env`の`GOOGLE_REDIRECT_URI`と一致しているか確認
3. 完全に一致する必要があります（`http://`や末尾のスラッシュも含めて）

### "Access blocked: This app's request is invalid"

**原因:** OAuth同意画面でスコープが正しく設定されていない

**解決策:**
1. Google Cloud Consoleの「OAuth同意画面」で設定を確認
2. `https://www.googleapis.com/auth/calendar.events` スコープが追加されているか確認

### テストユーザーでログインできない

**原因:** OAuth同意画面のテストユーザーに追加されていない

**解決策:**
1. Google Cloud Consoleの「OAuth同意画面」→「テストユーザー」を確認
2. 使用するGoogleアカウントが追加されているか確認
3. 追加されていない場合は「ユーザーを追加」で追加

## セキュリティに関する注意事項

### 本番環境への移行時

本番環境にデプロイする際は、以下の点に注意してください:

1. **新しいOAuthクライアントIDを作成**
   - 本番環境用の新しいクライアントIDを作成
   - リダイレクトURIを本番環境のURLに変更（例: `https://your-domain.com/api/google-calendar/callback`）

2. **環境変数の管理**
   - 本番環境の環境変数はVercelなどのホスティングサービスの管理画面で設定
   - `.env`ファイルは絶対にGitにコミットしない（`.gitignore`で除外済み）

3. **OAuth同意画面の公開**
   - 開発中は「テストモード」で問題ありませんが、本番環境では「公開」する必要があります
   - Googleの審査が必要になる場合があります

### 暗号化キーの取り扱い

- `ENCRYPTION_KEY`は絶対に外部に漏らさないでください
- 本番環境では別の暗号化キーを生成して使用してください:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## 関連ドキュメント

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- 詳細設計: `docs/google-calendar-integration/03-oauth-security.md`
