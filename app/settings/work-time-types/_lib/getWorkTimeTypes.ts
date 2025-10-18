import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function getWorkTimeTypes() {
  const session = await auth();

  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  // ユーザーを取得
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // WorkTimeTypeを取得（displayOrderでソート、isActiveなもののみ）
  const workTimeTypes = await prisma.workTimeType.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    orderBy: {
      displayOrder: "asc",
    },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      color: true,
      displayOrder: true,
    },
  });

  return workTimeTypes;
}
