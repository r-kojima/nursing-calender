import type { WorkTimeType } from "../types";

type ShiftBadgeProps = {
  workTimeType: WorkTimeType | null;
  className?: string;
};

export function ShiftBadge({ workTimeType, className = "" }: ShiftBadgeProps) {
  if (!workTimeType) {
    // 休みの表示
    return (
      <div
        className={`inline-block rounded px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 ${className}`}
      >
        休
      </div>
    );
  }

  // WorkTimeTypeの色を背景に使用
  const bgColor = workTimeType.color || "#FF6B35";
  // 背景色に基づいてテキスト色を決定（明度で判定）
  const textColor = getContrastColor(bgColor);

  return (
    <div
      className={`inline-block rounded px-2 py-1 text-xs font-medium ${className}`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {workTimeType.name}
    </div>
  );
}

// 背景色に対して十分なコントラストを持つテキスト色を返す
function getContrastColor(hexColor: string): string {
  // #を除去
  const hex = hexColor.replace("#", "");

  // RGBに変換
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);

  // 相対輝度を計算（WCAG 2.0の式）
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // 輝度が0.5以上なら黒、未満なら白
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}
