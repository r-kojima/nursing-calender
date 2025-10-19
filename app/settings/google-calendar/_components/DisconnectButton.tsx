"use client";

import { useState } from "react";

interface DisconnectButtonProps {
  onDisconnect: () => void;
}

export function DisconnectButton({ onDisconnect }: DisconnectButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
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
      setShowConfirm(false);
      onDisconnect();
    } catch (err) {
      alert("連携解除に失敗しました");
      console.error(err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="px-6 py-3 bg-white dark:bg-gray-700 text-error border-2 border-error rounded-lg font-medium hover:bg-error hover:text-white transition-all duration-200"
      >
        連携を解除
      </button>

      {/* 確認モーダル */}
      {showConfirm && (
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
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={disconnecting}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-foreground rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {disconnecting ? "処理中..." : "解除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
