import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { DELETE } from "./route";

// モック
vi.mock("@/app/lib/auth");
vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    shift: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("DELETE /api/shifts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証されていない場合は401を返す", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const request = new Request("http://localhost:3000/api/shifts/shift-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "shift-1" } });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("ユーザーが見つからない場合は404を返す", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/shifts/shift-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "shift-1" } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("User not found");
  });

  it("シフトが見つからない場合は404を返す", async () => {
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
    vi.mocked(prisma.shift.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/shifts/shift-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "shift-1" } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Shift not found");
  });

  it("他のユーザーのシフトを削除しようとすると403を返す", async () => {
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
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({
      id: "shift-1",
      memberId: "member-1",
      workTimeTypeId: "wtt-1",
      date: new Date("2024-05-01"),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      member: {
        id: "member-1",
        userId: "other-user-id", // 別のユーザーのメンバー
        name: "Other Member",
        isSelf: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);

    const request = new Request("http://localhost:3000/api/shifts/shift-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "shift-1" } });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Forbidden");
  });

  it("正常にシフトを削除できる", async () => {
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
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({
      id: "shift-1",
      memberId: "member-1",
      workTimeTypeId: "wtt-1",
      date: new Date("2024-05-01"),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      member: {
        id: "member-1",
        userId: "user-1",
        name: "Test Member",
        isSelf: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);
    vi.mocked(prisma.shift.delete).mockResolvedValue({
      id: "shift-1",
      memberId: "member-1",
      workTimeTypeId: "wtt-1",
      date: new Date("2024-05-01"),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request("http://localhost:3000/api/shifts/shift-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "shift-1" } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // deleteが正しいIDで呼ばれたことを確認
    expect(vi.mocked(prisma.shift.delete)).toHaveBeenCalledWith({
      where: { id: "shift-1" },
    });
  });
});
