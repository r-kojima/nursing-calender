import { ShiftBadge } from "../ShiftBadge";
import type { CalendarDay } from "../types";

type DayCellProps = {
  day: CalendarDay;
  dayIndex: number;
  onClick: (day: CalendarDay) => void;
  isShiftSetupMode?: boolean;
};

export function DayCell({
  day,
  dayIndex,
  onClick,
  isShiftSetupMode = false,
}: DayCellProps) {
  const handleClick = () => {
    onClick(day);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(day);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        min-h-[80px] sm:min-h-[120px] border rounded p-1 sm:p-2 cursor-pointer transition-all flex flex-col
        ${day.isCurrentMonth ? "bg-background hover:bg-primary/5" : "bg-foreground/5"}
        ${day.isToday ? "ring-2 ring-primary" : "border-foreground/20"}
        ${day.isSelected ? "bg-primary-pale ring-2 ring-primary" : ""}
        ${isShiftSetupMode && day.isCurrentMonth ? "hover:ring-2 hover:ring-primary/50" : ""}
      `}
    >
      {/* 日付（左上固定） */}
      <div
        className={`text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1 self-start ${
          day.isCurrentMonth
            ? dayIndex === 0
              ? "text-error"
              : dayIndex === 6
                ? "text-accent-blue"
                : "text-foreground"
            : "text-foreground/40"
        }`}
      >
        {day.day}
      </div>
      {/* シフト情報 */}
      {day.shift && day.isCurrentMonth && (
        <div className="mt-auto w-full px-1 pb-1">
          <ShiftBadge
            workTimeType={day.shift.workTimeType}
            hasNote={!!day.shift.note}
            className="w-full"
          />
        </div>
      )}
    </button>
  );
}
