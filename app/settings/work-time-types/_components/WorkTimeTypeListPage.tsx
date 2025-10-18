"use client";

import { useEffect, useState } from "react";
import type { WorkTimeType } from "@/app/components/calendar/types";
import { WorkTimeTypeCard } from "./WorkTimeTypeCard";

export function WorkTimeTypeListPage() {
  const [workTimeTypes, setWorkTimeTypes] = useState<WorkTimeType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkTimeTypes = async () => {
      try {
        const response = await fetch("/api/work-time-types");

        if (!response.ok) {
          throw new Error("Failed to fetch work time types");
        }

        const data = await response.json();
        setWorkTimeTypes(data.workTimeTypes || []);
      } catch (err) {
        setError("勤務時間の取得に失敗しました");
        console.error("Error fetching work time types:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkTimeTypes();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-error font-medium">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">勤務時間の設定</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            シフトで使用する勤務時間を管理します
          </p>
        </div>

        {/* 作成ボタン（将来の実装用） */}
        <button
          type="button"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          disabled
          title="作成機能は未実装です"
        >
          + 新規作成
        </button>
      </div>

      {/* 勤務時間一覧 */}
      {workTimeTypes.length === 0 ? (
        <div className="flex items-center justify-center py-16 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <title>Clock icon</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              未設定
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              勤務時間がまだ登録されていません
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {workTimeTypes.map((workTimeType) => (
            <WorkTimeTypeCard
              key={workTimeType.id}
              workTimeType={workTimeType}
            />
          ))}
        </div>
      )}
    </div>
  );
}
