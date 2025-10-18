import { getWorkTimeTypes } from "../_lib/getWorkTimeTypes";
import { WorkTimeTypeCard } from "./WorkTimeTypeCard";

export async function WorkTimeTypeListPage() {
  const workTimeTypes = await getWorkTimeTypes();

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
