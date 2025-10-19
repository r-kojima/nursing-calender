# UI実装詳細

## 1. 概要

本ドキュメントでは、Googleカレンダー連携機能のユーザーインターフェース（UI）実装について詳細に記述します。設定画面の構成、コンポーネント設計、状態管理、およびユーザーエクスペリエンス（UX）について説明します。

---

## 2. 画面構成

### 2.1 設定画面の拡張

既存の設定画面（`/settings`）にGoogleカレンダー連携のカードを追加します。

#### 2.1.1 ページ構造

```
/settings
├── シフトパターン設定 (既存)
└── Googleカレンダー連携 (新規追加)
```

#### 2.1.2 レイアウト

```
┌─────────────────────────────────────────────────┐
│  ← カレンダーに戻る                              │
│  設定                                           │
│  アプリケーションの各種設定を管理できます          │
├─────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────────────┐  │
│  │ シフトパターン │  │ Googleカレンダー連携   │  │
│  │     設定      │  │                       │  │
│  │               │  │  [連携状態の表示]      │  │
│  │               │  │  [アクションボタン]    │  │
│  └───────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 3. コンポーネント設計

### 3.1 ファイル構成

```
app/settings/
├── page.tsx (既存: 設定トップページ)
├── google-calendar/ (新規)
│   ├── page.tsx (Googleカレンダー設定ページ)
│   └── _components/
│       ├── GoogleCalendarCard.tsx (カード表示)
│       ├── ConnectionStatus.tsx (連携状態表示)
│       ├── SyncStats.tsx (同期統計表示)
│       ├── ConnectButton.tsx (連携ボタン)
│       ├── DisconnectButton.tsx (連携解除ボタン)
│       ├── ManualSyncButton.tsx (手動同期ボタン)
│       └── DisconnectConfirmModal.tsx (解除確認ダイアログ)
```

### 3.2 設定トップページの拡張

```tsx
// app/settings/page.tsx (拡張部分)
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

export default async function SettingsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Googleカレンダー連携状態を取得
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: {
      googleCalendarSyncEnabled: true,
      googleCalendarEmail: true,
    },
  });

  const isConnected = user?.googleCalendarSyncEnabled || false;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 既存のヘッダー */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-primary hover:text-primary-dark transition-colors mb-4"
          >
            <svg className="h-5 w-5 mr-2" /* ... */>
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            カレンダーに戻る
          </Link>
          <h1 className="text-3xl font-bold text-foreground">設定</h1>
          <p className="mt-2 text-foreground/70">
            アプリケーションの各種設定を管理できます
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 既存: シフトパターン設定 */}
          <Link
            href="/settings/work-time-types"
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border-2 border-transparent hover:border-primary group"
          >
            {/* 既存の内容 */}
          </Link>

          {/* 新規: Googleカレンダー連携 */}
          <Link
            href="/settings/google-calendar"
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border-2 border-transparent hover:border-primary group"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 p-3 bg-primary-pale dark:bg-primary-dark/20 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                <svg
                  className="h-6 w-6 text-primary group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <title>Calendar icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                    Googleカレンダー連携
                  </h2>
                  {isConnected && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                      連携済み
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-foreground/70">
                  {isConnected
                    ? `自分のシフトを${user?.googleCalendarEmail}のGoogleカレンダーに同期中`
                    : "自分のシフトをGoogleカレンダーに自動同期できます"}
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Googleカレンダー設定ページ

### 4.1 メインページコンポーネント

```tsx
// app/settings/google-calendar/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/app/lib/auth";
import { GoogleCalendarSettings } from "./_components/GoogleCalendarSettings";

export default async function GoogleCalendarSettingsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <Link
            href="/settings"
            className="inline-flex items-center text-primary hover:text-primary-dark transition-colors mb-4"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>Back arrow</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            設定に戻る
          </Link>
          <h1 className="text-3xl font-bold text-foreground">
            Googleカレンダー連携
          </h1>
          <p className="mt-2 text-foreground/70">
            自分のシフトをGoogleカレンダーに自動的に同期できます
          </p>
        </div>

        <GoogleCalendarSettings />
      </div>
    </div>
  );
}
```

### 4.2 設定コンポーネント（クライアント）

```tsx
// app/settings/google-calendar/_components/GoogleCalendarSettings.tsx
"use client";

import { useEffect, useState } from "react";
import { ConnectionStatus } from "./ConnectionStatus";
import { SyncStats } from "./SyncStats";
import { ConnectButton } from "./ConnectButton";
import { DisconnectButton } from "./DisconnectButton";
import { ManualSyncButton } from "./ManualSyncButton";

interface SyncStatus {
  connected: boolean;
  syncEnabled: boolean;
  email?: string;
  lastSync?: string;
  isTokenExpired?: boolean;
  stats?: {
    synced: number;
    pending: number;
    failed: number;
    total: number;
  };
}

export function GoogleCalendarSettings() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ステータスを取得
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/google-calendar/status");
      if (!response.ok) {
        throw new Error("Failed to fetch status");
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError("ステータスの取得に失敗しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // URLパラメータからエラー/成功メッセージを取得
    const params = new URLSearchParams(window.location.search);
    const successParam = params.get("success");
    const errorParam = params.get("error");

    if (successParam === "connected") {
      // 連携成功メッセージを表示（一時的）
      setTimeout(() => {
        fetchStatus();
      }, 1000);
    }

    if (errorParam) {
      setError(getErrorMessage(errorParam));
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <div className="text-center">
          <p className="text-error">{error}</p>
          <button
            onClick={fetchStatus}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 連携状態カード */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <ConnectionStatus
          connected={status?.connected || false}
          email={status?.email}
          lastSync={status?.lastSync}
          isTokenExpired={status?.isTokenExpired}
        />

        {/* 同期統計 */}
        {status?.connected && status.stats && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <SyncStats stats={status.stats} />
          </div>
        )}

        {/* アクションボタン */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          {status?.connected ? (
            <>
              <ManualSyncButton onSyncComplete={fetchStatus} />
              <DisconnectButton onDisconnect={fetchStatus} />
            </>
          ) : (
            <ConnectButton />
          )}
        </div>
      </div>

      {/* 説明セクション */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-3">
          連携について
        </h3>
        <ul className="space-y-2 text-sm text-foreground/80">
          <li className="flex items-start">
            <svg
              className="h-5 w-5 text-accent-blue mr-2 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              自分のシフトのみが同期されます（他のスタッフのシフトは同期されません）
            </span>
          </li>
          <li className="flex items-start">
            <svg className="h-5 w-5 text-accent-blue mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              シフトを作成・変更・削除すると、即座にGoogleカレンダーに反映されます
            </span>
          </li>
          <li className="flex items-start">
            <svg className="h-5 w-5 text-accent-blue mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              連携を解除すると、同期済みのイベントはすべて削除されます
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function getErrorMessage(errorCode: string): string {
  const messages: Record<string, string> = {
    unauthorized: "認証が必要です",
    access_denied: "Googleアカウントへのアクセスが拒否されました",
    invalid_callback: "認証に失敗しました",
    invalid_state: "セキュリティエラー: 不正なリクエストです",
    user_not_found: "ユーザーが見つかりません",
    callback_failed: "認証処理に失敗しました",
    reconnect_required: "再認証が必要です",
  };

  return messages[errorCode] || "エラーが発生しました";
}
```

---

## 5. 子コンポーネントの実装

### 5.1 ConnectionStatus（連携状態表示）

```tsx
// app/settings/google-calendar/_components/ConnectionStatus.tsx
"use client";

interface ConnectionStatusProps {
  connected: boolean;
  email?: string;
  lastSync?: string;
  isTokenExpired?: boolean;
}

export function ConnectionStatus({
  connected,
  email,
  lastSync,
  isTokenExpired,
}: ConnectionStatusProps) {
  if (!connected) {
    return (
      <div>
        <div className="flex items-center">
          <div className="flex-shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="ml-4">
            <h2 className="text-xl font-semibold text-foreground">未連携</h2>
            <p className="text-sm text-foreground/70">
              Googleカレンダーと連携していません
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center">
        <div className="flex-shrink-0 w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
          <svg
            className="h-6 w-6 text-success"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="ml-4 flex-1">
          <h2 className="text-xl font-semibold text-foreground">連携済み</h2>
          <p className="text-sm text-foreground/70">
            アカウント: {email || "不明"}
          </p>
          {lastSync && (
            <p className="text-xs text-foreground/60 mt-1">
              最終同期: {formatDateTime(lastSync)}
            </p>
          )}
          {isTokenExpired && (
            <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-warning/10 text-warning">
              <svg
                className="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              認証の有効期限が切れています
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

### 5.2 SyncStats（同期統計）

```tsx
// app/settings/google-calendar/_components/SyncStats.tsx
"use client";

interface SyncStatsProps {
  stats: {
    synced: number;
    pending: number;
    failed: number;
    total: number;
  };
}

export function SyncStats({ stats }: SyncStatsProps) {
  const hasIssues = stats.pending > 0 || stats.failed > 0;

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">同期状態</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-success/5 rounded-lg p-3">
          <div className="text-2xl font-bold text-success">{stats.synced}</div>
          <div className="text-xs text-foreground/70 mt-1">同期済み</div>
        </div>
        <div className={`rounded-lg p-3 ${stats.pending > 0 ? "bg-warning/5" : "bg-gray-50 dark:bg-gray-700/50"}`}>
          <div className={`text-2xl font-bold ${stats.pending > 0 ? "text-warning" : "text-foreground/40"}`}>
            {stats.pending}
          </div>
          <div className="text-xs text-foreground/70 mt-1">同期待ち</div>
        </div>
        <div className={`rounded-lg p-3 ${stats.failed > 0 ? "bg-error/5" : "bg-gray-50 dark:bg-gray-700/50"}`}>
          <div className={`text-2xl font-bold ${stats.failed > 0 ? "text-error" : "text-foreground/40"}`}>
            {stats.failed}
          </div>
          <div className="text-xs text-foreground/70 mt-1">同期失敗</div>
        </div>
      </div>

      {hasIssues && (
        <div className="mt-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-warning mr-2 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-warning">
                同期に問題があります
              </p>
              <p className="text-xs text-foreground/70 mt-1">
                {stats.failed > 0 && `${stats.failed}件のシフトが同期に失敗しました。`}
                {stats.pending > 0 && `${stats.pending}件のシフトが同期待ちです。`}
                手動同期を実行してください。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 5.3 ConnectButton（連携ボタン）

```tsx
// app/settings/google-calendar/_components/ConnectButton.tsx
"use client";

export function ConnectButton() {
  const handleConnect = () => {
    // OAuth認証エンドポイントにリダイレクト
    window.location.href = "/api/google-calendar/auth";
  };

  return (
    <button
      onClick={handleConnect}
      className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center"
    >
      <svg
        className="h-5 w-5 mr-2"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
      </svg>
      Googleと連携する
    </button>
  );
}
```

### 5.4 ManualSyncButton（手動同期ボタン）

```tsx
// app/settings/google-calendar/_components/ManualSyncButton.tsx
"use client";

import { useState } from "react";

interface ManualSyncButtonProps {
  onSyncComplete: () => void;
}

export function ManualSyncButton({ onSyncComplete }: ManualSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      const response = await fetch("/api/google-calendar/sync", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      const result = await response.json();

      // 成功メッセージを表示（オプション）
      alert(
        `同期完了: ${result.syncedCount}件成功, ${result.failedCount}件失敗`
      );

      // 親コンポーネントの状態を更新
      onSyncComplete();
    } catch (err) {
      setError("同期に失敗しました");
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex-1">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full px-6 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {syncing ? (
          <>
            <svg
              className="animate-spin h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            同期中...
          </>
        ) : (
          <>
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            今すぐ同期
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-sm text-error text-center">{error}</p>
      )}
    </div>
  );
}
```

### 5.5 DisconnectButton（連携解除ボタン）

```tsx
// app/settings/google-calendar/_components/DisconnectButton.tsx
"use client";

import { useState } from "react";
import { DisconnectConfirmModal } from "./DisconnectConfirmModal";

interface DisconnectButtonProps {
  onDisconnect: () => void;
}

export function DisconnectButton({ onDisconnect }: DisconnectButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="px-6 py-3 bg-white dark:bg-gray-700 text-error border-2 border-error rounded-lg font-medium hover:bg-error hover:text-white transition-all duration-200"
      >
        連携を解除
      </button>

      <DisconnectConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          onDisconnect();
        }}
      />
    </>
  );
}
```

### 5.6 DisconnectConfirmModal（確認ダイアログ）

```tsx
// app/settings/google-calendar/_components/DisconnectConfirmModal.tsx
"use client";

import { useState } from "react";

interface DisconnectConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DisconnectConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: DisconnectConfirmModalProps) {
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);

    try {
      const response = await fetch("/api/google-calendar/disconnect", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Disconnect failed");
      }

      const result = await response.json();
      alert(`連携を解除しました（${result.deletedCount}件のイベントを削除）`);
      onConfirm();
    } catch (err) {
      alert("連携解除に失敗しました");
      console.error(err);
    } finally {
      setDisconnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-foreground mb-4">
          連携を解除しますか?
        </h3>
        <div className="space-y-3 mb-6">
          <p className="text-sm text-foreground/80">
            Googleカレンダーとの連携を解除すると、以下の処理が実行されます:
          </p>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li className="flex items-start">
              <svg
                className="h-5 w-5 text-error mr-2 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              同期済みのイベントがすべて削除されます
            </li>
            <li className="flex items-start">
              <svg
                className="h-5 w-5 text-error mr-2 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              自動同期が停止されます
            </li>
          </ul>
          <p className="text-sm font-medium text-warning">
            この操作は取り消せません
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={disconnecting}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-foreground rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex-1 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disconnecting ? "処理中..." : "解除する"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. UX改善

### 6.1 ローディング状態

すべての非同期操作でローディング表示を実装:

- OAuth認証中: リダイレクト時にローディング表示
- 手動同期中: ボタンにスピナーアイコン
- 連携解除中: モーダルにローディング状態
- ステータス取得中: スケルトンローダー

### 6.2 エラーハンドリング

ユーザーフレンドリーなエラーメッセージ:

```typescript
const errorMessages: Record<string, string> = {
  unauthorized: "ログインが必要です",
  access_denied: "Googleアカウントへのアクセスが拒否されました。もう一度お試しください。",
  invalid_state: "セキュリティエラーが発生しました。ページを再読み込みしてください。",
  sync_failed: "同期に失敗しました。しばらくしてから再度お試しください。",
  network_error: "ネットワークエラーが発生しました。接続を確認してください。",
};
```

### 6.3 成功フィードバック

操作成功時の視覚的フィードバック:

- 連携成功: 緑のチェックマークアイコン + "連携しました" メッセージ
- 同期成功: 統計数値のアニメーション
- 解除成功: "連携を解除しました" メッセージ

---

## 7. アクセシビリティ

### 7.1 キーボード操作

- すべてのボタンに適切な `tabindex` を設定
- モーダルは `Esc` キーで閉じる
- フォーカス管理（モーダル開閉時）

### 7.2 スクリーンリーダー対応

```tsx
<button
  onClick={handleConnect}
  aria-label="Googleカレンダーと連携する"
  className="..."
>
  Googleと連携する
</button>
```

### 7.3 カラーコントラスト

すべてのテキストで WCAG AA 基準（4.5:1以上）を満たす:

- 通常テキスト: `text-foreground` (高コントラスト)
- 補助テキスト: `text-foreground/70` (中コントラスト)
- エラー: `text-error` (赤、高コントラスト)

---

## 8. レスポンシブデザイン

### 8.1 ブレークポイント

```css
/* モバイル（デフォルト）*/
.container {
  padding: 1rem;
}

/* タブレット */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* デスクトップ */
@media (min-width: 1024px) {
  .container {
    max-width: 768px;
  }
}
```

### 8.2 モバイル最適化

- タッチ操作に適したボタンサイズ（最小44x44px）
- スワイプジェスチャーでモーダルを閉じる（オプション）
- 縦横スクロールの最適化

---

## 9. テスト戦略

### 9.1 コンポーネントテスト

```typescript
// __tests__/components/ConnectionStatus.test.tsx
import { render, screen } from "@testing-library/react";
import { ConnectionStatus } from "@/app/settings/google-calendar/_components/ConnectionStatus";

describe("ConnectionStatus", () => {
  it("should display 'Not Connected' state", () => {
    render(<ConnectionStatus connected={false} />);
    expect(screen.getByText("未連携")).toBeInTheDocument();
  });

  it("should display connected state with email", () => {
    render(
      <ConnectionStatus
        connected={true}
        email="user@example.com"
        lastSync="2025-10-19T14:30:00Z"
      />
    );
    expect(screen.getByText("連携済み")).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
  });
});
```

### 9.2 統合テスト

```typescript
// __tests__/integration/google-calendar-flow.test.tsx
describe("Google Calendar Integration Flow", () => {
  it("should complete connection flow", async () => {
    // 1. 設定ページを開く
    const { getByText } = render(<GoogleCalendarSettings />);

    // 2. 連携ボタンをクリック
    fireEvent.click(getByText("Googleと連携する"));

    // 3. OAuth認証をモック
    // ...

    // 4. 連携済み状態を確認
    await waitFor(() => {
      expect(getByText("連携済み")).toBeInTheDocument();
    });
  });
});
```

---

## 10. まとめ

### 10.1 実装チェックリスト

**ページ構成:**
- [ ] 設定トップページ拡張
- [ ] Googleカレンダー設定ページ作成
- [ ] 各種コンポーネント実装

**コンポーネント:**
- [ ] ConnectionStatus
- [ ] SyncStats
- [ ] ConnectButton
- [ ] ManualSyncButton
- [ ] DisconnectButton
- [ ] DisconnectConfirmModal

**UX/UI:**
- [ ] ローディング状態
- [ ] エラーハンドリング
- [ ] 成功フィードバック
- [ ] レスポンシブデザイン

**アクセシビリティ:**
- [ ] キーボード操作
- [ ] スクリーンリーダー対応
- [ ] カラーコントラスト

**テスト:**
- [ ] コンポーネントテスト
- [ ] 統合テスト

### 10.2 完了

1. ✅ データベーススキーマ設計完了
2. ✅ API設計詳細完了
3. ✅ OAuth認証・セキュリティ詳細完了
4. ✅ 同期ロジック詳細完了
5. ✅ UI実装詳細完了

---

**ドキュメントバージョン:** 1.0
**最終更新日:** 2025-10-19
**レビュー担当者:** （未定）
**次回レビュー予定:** 実装開始前
