import { ShiftBadge } from "./ShiftBadge";
import type { CalendarDay } from "./types";

type DayCellProps = {
  day: CalendarDay;
  onClick?: (date: Date) => void;
};

export function DayCell({ day, onClick }: DayCellProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(day.date);
    }
  };

  const baseClasses =
    "min-h-20 p-2 border border-gray-200 dark:border-gray-700";
  const todayClasses = day.isToday
    ? "border-2 border-primary dark:border-primary"
    : "";
  const currentMonthClasses = day.isCurrentMonth
    ? "bg-white dark:bg-gray-800"
    : "bg-gray-50 dark:bg-gray-900";
  const clickableClasses = onClick
    ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
    : "";

  const dateTextClasses = day.isCurrentMonth
    ? "text-foreground"
    : "text-gray-400 dark:text-gray-600";

  if (onClick) {
    return (
      <button
        type="button"
        className={`${baseClasses} ${todayClasses} ${currentMonthClasses} ${clickableClasses} w-full text-left`}
        onClick={handleClick}
      >
        {/* 日付表示 */}
        <div className={`text-sm font-medium mb-1 ${dateTextClasses}`}>
          {day.date.getDate()}
        </div>

        {/* シフトバッジ */}
        {day.shift && (
          <ShiftBadge
            workTimeType={day.shift.workTimeType}
            className="w-full text-center"
          />
        )}
      </button>
    );
  }

  return (
    <div className={`${baseClasses} ${todayClasses} ${currentMonthClasses}`}>
      {/* 日付表示 */}
      <div className={`text-sm font-medium mb-1 ${dateTextClasses}`}>
        {day.date.getDate()}
      </div>

      {/* シフトバッジ */}
      {day.shift && (
        <ShiftBadge
          workTimeType={day.shift.workTimeType}
          className="w-full text-center"
        />
      )}
    </div>
  );
}
