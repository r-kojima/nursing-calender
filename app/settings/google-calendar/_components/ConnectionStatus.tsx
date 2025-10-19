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
