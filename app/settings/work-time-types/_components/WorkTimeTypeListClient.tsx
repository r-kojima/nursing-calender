"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WorkTimeType } from "@/app/components/calendar/types";
import { WorkTimeTypeCard } from "./WorkTimeTypeCard";
import { WorkTimeTypeModal } from "./WorkTimeTypeModal";

type WorkTimeTypeListClientProps = {
  workTimeTypes: WorkTimeType[];
};

export function WorkTimeTypeListClient({
  workTimeTypes,
}: WorkTimeTypeListClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkTimeType, setEditingWorkTimeType] =
    useState<WorkTimeType | null>(null);

  const handleCreate = () => {
    setEditingWorkTimeType(null);
    setIsModalOpen(true);
  };

  const handleEdit = (workTimeType: WorkTimeType) => {
    setEditingWorkTimeType(workTimeType);
    setIsModalOpen(true);
  };

  const handleSuccess = () => {
    // ページをリフレッシュしてサーバーから最新データを取得
    router.refresh();
  };

  const handleToggle = () => {
    // トグル後にページをリフレッシュして最新データを取得
    router.refresh();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingWorkTimeType(null);
  };

  return (
    <>
      <div className="space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              シフトパターンの設定
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              シフトで使用するシフトパターンを管理します
            </p>
          </div>

          {/* 作成ボタン */}
          <button
            type="button"
            onClick={handleCreate}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
          >
            + 新規作成
          </button>
        </div>

        {/* シフトパターン一覧 */}
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
                シフトパターンがまだ登録されていません
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {workTimeTypes.map((workTimeType) => (
              <WorkTimeTypeCard
                key={workTimeType.id}
                workTimeType={workTimeType}
                onEdit={handleEdit}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* モーダル */}
      <WorkTimeTypeModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        workTimeType={editingWorkTimeType || undefined}
      />
    </>
  );
}
