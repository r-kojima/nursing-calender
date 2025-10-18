"use client";

import { useState } from "react";
import type { WorkTimeType } from "@/app/components/calendar/types";
import { ToggleSwitch } from "./ToggleSwitch";

type WorkTimeTypeCardProps = {
  workTimeType: WorkTimeType;
  onEdit: (workTimeType: WorkTimeType) => void;
  onToggle: () => void;
};

export function WorkTimeTypeCard({
  workTimeType,
  onEdit,
  onToggle,
}: WorkTimeTypeCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const { name, startTime, endTime, color } = workTimeType;
  const bgColor = color || "#FF6B35";

  // 背景色の明度から文字色を決定
  const getTextColor = (hexColor: string): string => {
    const r = Number.parseInt(hexColor.slice(1, 3), 16);
    const g = Number.parseInt(hexColor.slice(3, 5), 16);
    const b = Number.parseInt(hexColor.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? "#000000" : "#FFFFFF";
  };

  const textColor = getTextColor(bgColor);

  const handleToggle = async (enabled: boolean) => {
    setIsToggling(true);
    try {
      const response = await fetch(
        `/api/work-time-types/${workTimeType.id}/toggle`,
        {
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to toggle work time type");
      }

      onToggle();
    } catch (error) {
      console.error("Error toggling work time type:", error);
      alert("シフトパターンの切り替えに失敗しました");
    } finally {
      setIsToggling(false);
    }
  };

  const isActive = workTimeType.isActive ?? true;

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-all ${
        isActive ? "" : "opacity-50"
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        {/* 色プレビュー */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-xs font-medium shadow-sm"
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          {startTime.slice(0, 2)}
        </div>

        {/* シフトパターン情報 */}
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">
            {name}
            {!isActive && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                (無効)
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {startTime} - {endTime}
          </p>
        </div>
      </div>

      {/* トグルスイッチと編集ボタン */}
      <div className="flex items-center gap-4">
        <ToggleSwitch
          enabled={isActive}
          onChange={handleToggle}
          disabled={isToggling}
        />
        <button
          type="button"
          onClick={() => onEdit(workTimeType)}
          className="px-4 py-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
        >
          編集
        </button>
      </div>
    </div>
  );
}
