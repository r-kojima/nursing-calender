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
    shift: {
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/shifts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証されていない場合は401を返す", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const request = new Request(
      "http://localhost:3000/api/shifts?year=2024&month=5",
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

    const request = new Request("http://localhost:3000/api/shifts");
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
      "http://localhost:3000/api/shifts?year=2024&month=13",
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
      "http://localhost:3000/api/shifts?year=2024&month=5",
    );
    const response = await GET(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("User not found");
  });

  it("memberIdを指定した場合、特定メンバーのシフトのみ取得する", async () => {
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
        member: {
          id: "member-1",
          name: "山田太郎",
        },
      },
    ] as any);

    const request = new Request(
      "http://localhost:3000/api/shifts?year=2024&month=5&memberId=member-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shifts).toHaveLength(1);
    expect(data.shifts[0].member.id).toBe("member-1");

    // findManyが正しいフィルタで呼ばれていることを確認
    expect(vi.mocked(prisma.shift.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberId: "member-1",
        }),
      }),
    );
  });

  it("memberIdを指定しない場合、全メンバーのシフトを取得する", async () => {
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
        member: {
          id: "member-1",
          name: "山田太郎",
        },
      },
      {
        id: "shift-2",
        memberId: "member-2",
        workTimeTypeId: null,
        date: new Date("2024-05-01"),
        note: "午後から研修",
        createdAt: new Date(),
        updatedAt: new Date(),
        workTimeType: null,
        member: {
          id: "member-2",
          name: "佐藤花子",
        },
      },
    ] as any);

    const request = new Request(
      "http://localhost:3000/api/shifts?year=2024&month=5",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shifts).toHaveLength(2);
    expect(data.shifts[0].member.name).toBe("山田太郎");
    expect(data.shifts[1].member.name).toBe("佐藤花子");
    expect(data.shifts[1].workTimeType).toBeNull();
    expect(data.shifts[1].note).toBe("午後から研修");
  });

  it("日付範囲で正しくフィルタリングする", async () => {
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
    vi.mocked(prisma.shift.findMany).mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/shifts?year=2024&month=5",
    );
    await GET(request);

    // findManyが正しい日付範囲で呼ばれていることを確認
    expect(vi.mocked(prisma.shift.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date(2024, 4, 1), // 2024-05-01
            lte: new Date(2024, 4, 31), // 2024-05-31
          },
        }),
      }),
    );
  });
});
