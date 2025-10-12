import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { GET } from "./route";

// モック
vi.mock("@/app/lib/auth");
vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
    },
    shift: {
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/shifts/my", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証されていない場合は401を返す", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const request = new Request(
      "http://localhost:3000/api/shifts/my?year=2024&month=5",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("yearまたはmonthパラメータがない場合は400を返す", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
    } as any);

    const request = new Request("http://localhost:3000/api/shifts/my");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("year and month are required");
  });

  it("無効なyearまたはmonthの場合は400を返す", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
    } as any);

    const request = new Request(
      "http://localhost:3000/api/shifts/my?year=2024&month=13",
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid year or month");
  });

  it("ユーザーが見つからない場合は404を返す", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/shifts/my?year=2024&month=5",
    );
    const response = await GET(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("User not found");
  });

  it("自分自身のMemberが見つからない場合は404を返す", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      password: "",
      name: "Test User",
      emailVerified: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/shifts/my?year=2024&month=5",
    );
    const response = await GET(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Self member not found");
  });

  it("正常にシフトデータを取得できる", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      password: "",
      name: "Test User",
      emailVerified: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.member.findFirst).mockResolvedValue({
      id: "member-1",
      userId: "user-1",
      name: "Test User",
      isSelf: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.shift.findMany).mockResolvedValue([
      {
        id: "shift-1",
        memberId: "member-1",
        workTimeTypeId: "wtt-1",
        date: new Date("2024-05-01"),
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        workTimeType: {
          id: "wtt-1",
          name: "早番",
          startTime: "07:00",
          endTime: "16:00",
          color: "#FF6B35",
        },
      },
      {
        id: "shift-2",
        memberId: "member-1",
        workTimeTypeId: null,
        date: new Date("2024-05-02"),
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        workTimeType: null,
      },
    ] as any);

    const request = new Request(
      "http://localhost:3000/api/shifts/my?year=2024&month=5",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shifts).toHaveLength(2);
    expect(data.shifts[0].workTimeType?.name).toBe("早番");
    expect(data.shifts[1].workTimeType).toBeNull();
  });
});
