import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../lib/auth";

export default async function SettingsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-primary hover:text-primary-dark transition-colors mb-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <title>Back arrow</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            カレンダーに戻る
          </Link>
          <h1 className="text-3xl font-bold text-foreground">設定</h1>
          <p className="mt-2 text-foreground/70">
            アプリケーションの各種設定を管理できます
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* シフトパターン設定 */}
          <Link
            href="/settings/work-time-types"
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border-2 border-transparent hover:border-primary group"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 p-3 bg-primary-pale dark:bg-primary-dark/20 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-primary group-hover:text-white"
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
              </div>
              <div className="ml-4 flex-1">
                <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                  シフトパターン設定
                </h2>
                <p className="mt-2 text-sm text-foreground/70">
                  勤務時間パターンの登録・編集・削除を行います。シフトの時間帯や色の設定ができます。
                </p>
              </div>
            </div>
          </Link>

          {/* 将来の拡張用プレースホルダー */}
          <div className="p-6 bg-gray-100 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 opacity-50">
            <div className="flex items-start">
              <div className="flex-shrink-0 p-3 bg-gray-200 dark:bg-gray-700 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <title>Coming soon icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <h2 className="text-xl font-semibold text-gray-400">
                  その他の設定
                </h2>
                <p className="mt-2 text-sm text-gray-400">今後追加予定</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
