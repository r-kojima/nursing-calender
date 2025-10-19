import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/app/lib/auth";
import { GoogleCalendarSettings } from "./_components/GoogleCalendarSettings";

export default async function GoogleCalendarSettingsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <Link
            href="/settings"
            className="inline-flex items-center text-primary hover:text-primary-dark transition-colors mb-4"
          >
            <svg
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
            設定に戻る
          </Link>
          <h1 className="text-3xl font-bold text-foreground">
            Googleカレンダー連携
          </h1>
          <p className="mt-2 text-foreground/70">
            自分のシフトをGoogleカレンダーに自動的に同期できます
          </p>
        </div>

        <GoogleCalendarSettings />
      </div>
    </div>
  );
}
