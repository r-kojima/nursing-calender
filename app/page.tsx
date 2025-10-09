import { redirect } from "next/navigation";
import { auth } from "./lib/auth";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold text-primary">保育士カレンダー</h1>
      <p className="mt-4 text-foreground">
        ようこそ、{session.user?.name} さん
      </p>
    </div>
  );
}
