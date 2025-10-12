import { redirect } from "next/navigation";
import { Calendar } from "./components/calendar/Calendar";
import { auth } from "./lib/auth";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">保育士カレンダー</h1>
          <p className="mt-2 text-sm text-foreground">
            ようこそ、{session.user?.name} さん
          </p>
        </div>
        <Calendar />
      </div>
    </div>
  );
}
