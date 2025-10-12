type CalendarHeaderProps = {
  year: number;
  month: number; // 1-12
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

export function CalendarHeader({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 px-2">
      {/* 年月表示 */}
      <h2 className="text-xl font-bold text-foreground">
        {year}年{month}月
      </h2>

      {/* ナビゲーションボタン */}
      <div className="flex items-center gap-2">
        {/* 今月ボタン */}
        <button
          type="button"
          onClick={onToday}
          className="px-3 py-1 text-sm font-medium text-primary hover:bg-primary-pale dark:hover:bg-gray-700 rounded transition-colors"
        >
          今月
        </button>

        {/* 前月ボタン */}
        <button
          type="button"
          onClick={onPrevMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="前月"
        >
          <svg
            className="w-5 h-5 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* 次月ボタン */}
        <button
          type="button"
          onClick={onNextMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="次月"
        >
          <svg
            className="w-5 h-5 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
