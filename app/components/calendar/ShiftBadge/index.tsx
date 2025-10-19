import type { WorkTimeType } from "../types";

type ShiftBadgeProps = {
  workTimeType: WorkTimeType | null;
  hasNote?: boolean;
  className?: string;
};

export function ShiftBadge({
  workTimeType,
  hasNote = false,
  className = "",
}: ShiftBadgeProps) {
  if (!workTimeType) {
    // 休みの表示
    return (
      <div
        className={`rounded px-1.5 sm:px-2 py-1 sm:py-1 text-s relative ${className}`}
        style={{
          backgroundColor: "#e5e7eb",
          color: "#000",
        }}
      >
        <div className="font-semibold truncate text-[12px] sm:text-s">
          休み
        </div>
        {hasNote && (
          <div className="absolute top-0.5 right-0.5 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-black rounded-full" />
        )}
      </div>
    );
  }

  // WorkTimeTypeの色を背景に使用
  const bgColor = workTimeType.color || "#e5e7eb";

  return (
    <div
      className={`rounded px-1.5 sm:px-2 py-1 sm:py-1 text-s relative ${className}`}
      style={{
        backgroundColor: bgColor,
        color: "#000",
      }}
    >
      <div className="font-semibold truncate text-[12px] sm:text-s">
        {workTimeType.name}
      </div>
      {hasNote && (
        <div className="absolute top-0.5 right-0.5 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-black rounded-full" />
      )}
    </div>
  );
}
