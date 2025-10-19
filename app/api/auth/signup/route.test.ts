import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/app/lib/prisma";

// Mock next/server
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => {
      return {
        json: async () => body,
        status: init?.status || 200,
      };
    },
  },
}));

// Mock Prisma
vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    member: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock bcrypt
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}));

// Import after mocks
const { POST } = await import("./route");

describe("POST /api/auth/signup", () => {
  const mockRequest = (body: unknown) =>
    ({
      json: async () => body,
    }) as NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("バリデーション", () => {
    it("email, password, nameが必須である", async () => {
      const request = mockRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("メールアドレス、パスワード、名前は必須です");
    });

    it("無効なメールアドレスでエラーを返す", async () => {
      const request = mockRequest({
        email: "invalid-email",
        password: "password123",
        name: "Test User",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("有効なメールアドレスを入力してください");
    });

    it("8文字未満のパスワードでエラーを返す", async () => {
      const request = mockRequest({
        email: "test@example.com",
        password: "short",
        name: "Test User",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("パスワードは8文字以上である必要があります");
    });

    it("既存ユーザーの場合エラーを返す", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "existing-user-id",
        email: "test@example.com",
        password: "hashed",
        name: "Existing User",
        emailVerified: null,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleCalendarEmail: null,
        googleCalendarLastSync: null,
        googleCalendarSyncEnabled: false
      });

      const request = mockRequest({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("このメールアドレスは既に登録されています");
    });
  });

  describe("User + Member作成", () => {
    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    });

    it("UserとMemberを同時に作成する", async () => {
      const mockUser = {
        id: "new-user-id",
        email: "newuser@example.com",
        password: "hashed-password",
        name: "New User",
        emailVerified: null,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // トランザクション内でUserとMemberを作成
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === "function") {
          const txMock = {
            user: {
              create: vi.fn().mockResolvedValue(mockUser),
            },
            member: {
              create: vi.fn().mockResolvedValue({
                id: "new-member-id",
                userId: mockUser.id,
                name: mockUser.name,
                isSelf: true,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            },
          };
          return callback(txMock as never);
        }
        return mockUser;
      });

      const request = mockRequest({
        email: "newuser@example.com",
        password: "password123",
        name: "New User",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("アカウントが作成されました");
      expect(data.user.email).toBe("newuser@example.com");
      expect(data.user.name).toBe("New User");
      expect(data.user.password).toBeUndefined(); // パスワードは除外

      // トランザクションが呼ばれたことを確認
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("作成されるMemberのisSelfがtrueである", async () => {
      const mockUser = {
        id: "new-user-id",
        email: "newuser@example.com",
        password: "hashed-password",
        name: "New User",
        emailVerified: null,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let memberCreateData: unknown = null;

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === "function") {
          const txMock = {
            user: {
              create: vi.fn().mockResolvedValue(mockUser),
            },
            member: {
              create: vi.fn().mockImplementation((args) => {
                memberCreateData = args.data;
                return Promise.resolve({
                  id: "new-member-id",
                  userId: mockUser.id,
                  name: mockUser.name,
                  isSelf: true,
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }),
            },
          };
          return callback(txMock as never);
        }
        return mockUser;
      });

      const request = mockRequest({
        email: "newuser@example.com",
        password: "password123",
        name: "New User",
      });

      await POST(request);

      expect(memberCreateData).toEqual({
        userId: "new-user-id",
        name: "New User",
        isSelf: true,
        isActive: true,
      });
    });

    it("User作成失敗時にMemberも作成されない（トランザクション）", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error("Database error"),
      );

      const request = mockRequest({
        email: "newuser@example.com",
        password: "password123",
        name: "New User",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("アカウント作成中にエラーが発生しました");
    });
  });
});
