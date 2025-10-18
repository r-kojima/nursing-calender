import { ShiftBadge } from "../ShiftBadge";
import type { CalendarDay } from "../types";

type DayCellProps = {
  day: CalendarDay;
  onClick?: (date: Date) => void;
  isSelected?: boolean;
  isLoading?: boolean;
};

export function DayCell({
  day,
  onClick,
  isSelected = false,
  isLoading = false,
}: DayCellProps) {
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
  const selectedClasses = isSelected
    ? "bg-primary-pale dark:bg-primary-dark/20"
    : "";
  const currentMonthClasses =
    day.isCurrentMonth && !isSelected
      ? "bg-white dark:bg-gray-800"
      : !isSelected
        ? "bg-gray-50 dark:bg-gray-900"
        : "";
  const clickableClasses = onClick
    ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
    : "";

  const dateTextClasses = day.isCurrentMonth
    ? "text-foreground"
    : "text-gray-400 dark:text-gray-600";

  // シフト情報の表示内容を決定
  const renderShiftContent = () => {
    if (isLoading && day.isCurrentMonth) {
      // ローディング中は当月のセルにスケルトンを表示
      return (
        <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      );
    }
    if (day.shift) {
      return (
        <ShiftBadge
          workTimeType={day.shift.workTimeType}
          className="w-full text-center"
        />
      );
    }
    return null;
  };

  if (onClick) {
    return (
      <button
        type="button"
        className={`${baseClasses} ${todayClasses} ${selectedClasses} ${currentMonthClasses} ${clickableClasses} w-full text-left`}
        onClick={handleClick}
      >
        {/* 日付表示 */}
        <div className={`text-sm font-medium mb-1 ${dateTextClasses}`}>
          {day.date.getDate()}
        </div>

        {/* シフトバッジまたはローディング */}
        {renderShiftContent()}
      </button>
    );
  }

  return (
    <div
      className={`${baseClasses} ${todayClasses} ${selectedClasses} ${currentMonthClasses}`}
    >
      {/* 日付表示 */}
      <div className={`text-sm font-medium mb-1 ${dateTextClasses}`}>
        {day.date.getDate()}
      </div>

      {/* シフトバッジまたはローディング */}
      {renderShiftContent()}
    </div>
  );
}
