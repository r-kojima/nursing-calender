"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkTimeType } from "@/app/components/calendar/types";

// 時間の選択肢（0-23時）
function generateHourOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    options.push(hour.toString().padStart(2, "0"));
  }
  return options;
}

// 分の選択肢（5分刻み）
function generateMinuteOptions(): string[] {
  const options: string[] = [];
  for (let minute = 0; minute < 60; minute += 5) {
    options.push(minute.toString().padStart(2, "0"));
  }
  return options;
}

type WorkTimeTypeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workTimeType?: WorkTimeType; // 編集時のみ渡される
};

export function WorkTimeTypeModal({
  isOpen,
  onClose,
  onSuccess,
  workTimeType,
}: WorkTimeTypeModalProps) {
  const isEditing = !!workTimeType;
  const hourOptions = useMemo(() => generateHourOptions(), []);
  const minuteOptions = useMemo(() => generateMinuteOptions(), []);

  const [name, setName] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMinute, setEndMinute] = useState("");
  const [color, setColor] = useState("#FF6B35");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 編集時は初期値をセット
  useEffect(() => {
    if (workTimeType) {
      setName(workTimeType.name);
      const [sHour, sMinute] = workTimeType.startTime.split(":");
      const [eHour, eMinute] = workTimeType.endTime.split(":");
      setStartHour(sHour);
      setStartMinute(sMinute);
      setEndHour(eHour);
      setEndMinute(eMinute);
      setColor(workTimeType.color || "#FF6B35");
    } else {
      // 新規作成時はリセット
      setName("");
      setStartHour("");
      setStartMinute("");
      setEndHour("");
      setEndMinute("");
      setColor("#FF6B35");
    }
    setError(null);
  }, [workTimeType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // バリデーション
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }

    if (!startHour || !startMinute || !endHour || !endMinute) {
      setError("開始時刻と終了時刻を入力してください");
      return;
    }

    const startTime = `${startHour}:${startMinute}`;
    const endTime = `${endHour}:${endMinute}`;

    if (startTime >= endTime) {
      setError("開始時刻は終了時刻より前である必要があります");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing
        ? `/api/work-time-types/${workTimeType.id}`
        : "/api/work-time-types";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          startTime,
          endTime,
          color,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save work time type");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving work time type:", err);
      setError(
        err instanceof Error
          ? err.message
          : "シフトパターンの保存に失敗しました",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;

    if (
      !window.confirm(
        "このシフトパターンを完全に削除してもよろしいですか？\nこの操作は取り消せません。\n関連するシフトのシフトパターンは「休み」に変更されます。",
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/work-time-types/${workTimeType.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete work time type");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error deleting work time type:", err);
      setError(
        err instanceof Error
          ? err.message
          : "シフトパターンの削除に失敗しました",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* モーダルコンテンツ */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">
            {isEditing ? "シフトパターンの編集" : "シフトパターンの作成"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <title>Close</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 名前 */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground mb-1"
            >
              名前 <span className="text-error">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 早番"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* 開始時刻 */}
          <div>
            <span className="block text-sm font-medium text-foreground mb-1">
              開始時刻 <span className="text-error">*</span>
            </span>
            <div className="flex items-center gap-2">
              <select
                id="startHour"
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">時</option>
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <span className="text-foreground">:</span>
              <select
                id="startMinute"
                value={startMinute}
                onChange={(e) => setStartMinute(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">分</option>
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 終了時刻 */}
          <div>
            <span className="block text-sm font-medium text-foreground mb-1">
              終了時刻 <span className="text-error">*</span>
            </span>
            <div className="flex items-center gap-2">
              <select
                id="endHour"
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">時</option>
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <span className="text-foreground">:</span>
              <select
                id="endMinute"
                value={endMinute}
                onChange={(e) => setEndMinute(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">分</option>
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 色 */}
          <div>
            <label
              htmlFor="color"
              className="block text-sm font-medium text-foreground mb-1"
            >
              カレンダー表示色
            </label>
            <div className="flex items-center gap-3">
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {color}
              </span>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex items-center justify-between pt-4">
            {/* 削除ボタン（編集時のみ） */}
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-error hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                削除
              </button>
            )}

            {/* 保存・キャンセルボタン */}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "保存中..." : isEditing ? "更新" : "作成"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
