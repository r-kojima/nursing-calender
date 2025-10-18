import { DayCell } from "../DayCell";
import type { CalendarDay } from "../types";

type CalendarGridProps = {
  days: CalendarDay[];
  onDayClick?: (date: Date) => void;
  selectedDate?: Date;
  isLoading?: boolean;
};

const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];

export function CalendarGrid({
  days,
  onDayClick,
  selectedDate,
  isLoading = false,
}: CalendarGridProps) {
  return (
    <div className="w-full">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 mb-2">
        {weekdayNames.map((day, index) => {
          const isSunday = index === 0;
          const isSaturday = index === 6;
          const colorClass = isSunday
            ? "text-error"
            : isSaturday
              ? "text-accent-blue"
              : "text-foreground";

          return (
            <div
              key={day}
              className={`text-center py-2 text-sm font-semibold ${colorClass}`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((day, index) => {
          const isSelected =
            selectedDate &&
            day.date.getFullYear() === selectedDate.getFullYear() &&
            day.date.getMonth() === selectedDate.getMonth() &&
            day.date.getDate() === selectedDate.getDate();

          return (
            <DayCell
              key={`${day.date.getTime()}-${index}`}
              day={day}
              onClick={onDayClick}
              isSelected={isSelected}
              isLoading={isLoading}
            />
          );
        })}
      </div>
    </div>
  );
}
