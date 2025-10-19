"use client";

import { useEffect, useState } from "react";
import { ConnectionStatus } from "./ConnectionStatus";
import { SyncStats } from "./SyncStats";
import { ConnectButton } from "./ConnectButton";
import { DisconnectButton } from "./DisconnectButton";

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
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
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
            type="button"
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
            <DisconnectButton onDisconnect={fetchStatus} />
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
              シフトを作成・変更・削除すると、即座にGoogleカレンダーに反映されます
            </span>
          </li>
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
