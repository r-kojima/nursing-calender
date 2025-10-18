import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { PUT } from "./route";

// モック
vi.mock("@/app/lib/auth");
vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    member: {
      findUnique: vi.fn(),
    },
    shift: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe("PUT /api/shifts/upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証されていない場合は401を返す", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const request = new Request("http://localhost:3000/api/shifts/upsert", {
      method: "PUT",
      body: JSON.stringify({
        memberId: "member-1",
        date: "2024-05-01",
        workTimeTypeId: "wtt-1",
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("memberIdまたはdateが欠けている場合は400を返す", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
    } as any);

    const request = new Request("http://localhost:3000/api/shifts/upsert", {
      method: "PUT",
      body: JSON.stringify({
        memberId: "member-1",
        // dateがない
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("memberId and date are required");
  });

  it("ユーザーが見つからない場合は404を返す", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/shifts/upsert", {
      method: "PUT",
      body: JSON.stringify({
        memberId: "member-1",
        date: "2024-05-01",
        workTimeTypeId: "wtt-1",
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("User not found");
  });

  it("他のユーザーのメンバーへのシフト設定は403を返す", async () => {
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
    // 別のユーザーのメンバー
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: "member-1",
      userId: "other-user-id",
      name: "Other Member",
      isSelf: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request("http://localhost:3000/api/shifts/upsert", {
      method: "PUT",
      body: JSON.stringify({
        memberId: "member-1",
        date: "2024-05-01",
        workTimeTypeId: "wtt-1",
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Forbidden");
  });

  it("新規シフトを作成する（INSERT）", async () => {
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
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: "member-1",
      userId: "user-1",
      name: "Test Member",
      isSelf: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const createdShift = {
      id: "shift-1",
      memberId: "member-1",
      workTimeTypeId: "wtt-1",
      date: new Date("2024-05-01"),
      note: "午後から研修",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.shift.upsert).mockResolvedValue(createdShift);

    const request = new Request("http://localhost:3000/api/shifts/upsert", {
      method: "PUT",
      body: JSON.stringify({
        memberId: "member-1",
        date: "2024-05-01",
        workTimeTypeId: "wtt-1",
        note: "午後から研修",
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shift.id).toBe("shift-1");
    expect(data.shift.memberId).toBe("member-1");
    expect(data.shift.note).toBe("午後から研修");
  });

  it("既存シフトを更新する（UPDATE）", async () => {
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
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: "member-1",
      userId: "user-1",
      name: "Test Member",
      isSelf: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updatedShift = {
      id: "shift-1",
      memberId: "member-1",
      workTimeTypeId: "wtt-2",
      date: new Date("2024-05-01"),
      note: "更新されたメモ",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.shift.upsert).mockResolvedValue(updatedShift);

    const request = new Request("http://localhost:3000/api/shifts/upsert", {
      method: "PUT",
      body: JSON.stringify({
        memberId: "member-1",
        date: "2024-05-01",
        workTimeTypeId: "wtt-2",
        note: "更新されたメモ",
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shift.workTimeTypeId).toBe("wtt-2");
    expect(data.shift.note).toBe("更新されたメモ");
  });

  it("noteが省略された場合は既存値を保持する", async () => {
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
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: "member-1",
      userId: "user-1",
      name: "Test Member",
      isSelf: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updatedShift = {
      id: "shift-1",
      memberId: "member-1",
      workTimeTypeId: "wtt-2",
      date: new Date("2024-05-01"),
      note: "既存のメモ", // 既存値を保持
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.shift.upsert).mockResolvedValue(updatedShift);

    const request = new Request("http://localhost:3000/api/shifts/upsert", {
      method: "PUT",
      body: JSON.stringify({
        memberId: "member-1",
        date: "2024-05-01",
        workTimeTypeId: "wtt-2",
        // noteは省略
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
    // upsertが既存のnoteを保持するように呼ばれていることを確認
    // updateオブジェクトにnoteフィールドが含まれていないことを確認
    const upsertCall = vi.mocked(prisma.shift.upsert).mock.calls[0][0];
    expect(upsertCall.update).not.toHaveProperty("note");
  });

  it("workTimeTypeId=nullで休みを設定できる", async () => {
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
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: "member-1",
      userId: "user-1",
      name: "Test Member",
      isSelf: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const createdShift = {
      id: "shift-1",
      memberId: "member-1",
      workTimeTypeId: null,
      date: new Date("2024-05-01"),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.shift.upsert).mockResolvedValue(createdShift);

    const request = new Request("http://localhost:3000/api/shifts/upsert", {
      method: "PUT",
      body: JSON.stringify({
        memberId: "member-1",
        date: "2024-05-01",
        workTimeTypeId: null,
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shift.workTimeTypeId).toBeNull();
  });
});
