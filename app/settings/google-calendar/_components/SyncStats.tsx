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
        <div
          className={`rounded-lg p-3 ${
            stats.pending > 0
              ? "bg-warning/5"
              : "bg-gray-50 dark:bg-gray-700/50"
          }`}
        >
          <div
            className={`text-2xl font-bold ${
              stats.pending > 0 ? "text-warning" : "text-foreground/40"
            }`}
          >
            {stats.pending}
          </div>
          <div className="text-xs text-foreground/70 mt-1">同期待ち</div>
        </div>
        <div
          className={`rounded-lg p-3 ${
            stats.failed > 0 ? "bg-error/5" : "bg-gray-50 dark:bg-gray-700/50"
          }`}
        >
          <div
            className={`text-2xl font-bold ${
              stats.failed > 0 ? "text-error" : "text-foreground/40"
            }`}
          >
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
                {stats.failed > 0 &&
                  `${stats.failed}件のシフトが同期に失敗しました。`}
                {stats.pending > 0 &&
                  `${stats.pending}件のシフトが同期待ちです。`}
                手動同期を実行してください。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
