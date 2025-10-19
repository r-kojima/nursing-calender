import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../lib/auth";
import { redirect } from "next/navigation";
import SettingsPage from "./page";

// Next.jsのモジュールをモック
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// 認証モジュールをモック
vi.mock("../lib/auth");

describe("SettingsPage", () => {
  const mockAuth = vi.mocked(auth);
  const mockRedirect = vi.mocked(redirect);

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("認証チェック", () => {
    it("未ログインの場合はログイン画面にリダイレクトする", async () => {
      mockAuth.mockResolvedValue(null);

      await SettingsPage();

      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("ログイン済みの場合は設定画面を表示する", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-1",
          name: "テストユーザー",
          email: "test@example.com",
        },
        expires: "2024-12-31",
      });

      const result = await SettingsPage();
      render(result);

      expect(mockRedirect).not.toHaveBeenCalled();
      expect(screen.getByText("設定")).toBeInTheDocument();
    });
  });

  describe("UI表示", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-1",
          name: "テストユーザー",
          email: "test@example.com",
        },
        expires: "2024-12-31",
      });
    });

    it("ページタイトルと説明が表示される", async () => {
      const result = await SettingsPage();
      render(result);

      expect(screen.getByText("設定")).toBeInTheDocument();
      expect(
        screen.getByText("アプリケーションの各種設定を管理できます"),
      ).toBeInTheDocument();
    });

    it("カレンダーに戻るリンクが表示される", async () => {
      const result = await SettingsPage();
      render(result);

      const backLink = screen.getByText("カレンダーに戻る").closest("a");
      expect(backLink).toHaveAttribute("href", "/");
    });

    it("シフトパターン設定カードが表示される", async () => {
      const result = await SettingsPage();
      render(result);

      expect(screen.getByText("シフトパターン設定")).toBeInTheDocument();
      expect(
        screen.getByText(/勤務時間パターンの登録・編集・削除を行います/),
      ).toBeInTheDocument();
    });

    it("シフトパターン設定カードに正しいリンクが設定されている", async () => {
      const result = await SettingsPage();
      render(result);

      const settingCard = screen.getByText("シフトパターン設定").closest("a");
      expect(settingCard).toHaveAttribute("href", "/settings/work-time-types");
    });

    it("将来の拡張用プレースホルダーが表示される", async () => {
      const result = await SettingsPage();
      render(result);

      expect(screen.getByText("その他の設定")).toBeInTheDocument();
      expect(screen.getByText("今後追加予定")).toBeInTheDocument();
    });
  });

  describe("アクセシビリティ", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-1",
          name: "テストユーザー",
          email: "test@example.com",
        },
        expires: "2024-12-31",
      });
    });

    it("すべてのアイコンにtitleが設定されている", async () => {
      const result = await SettingsPage();
      const { container } = render(result);

      const titles = container.querySelectorAll("title");
      expect(titles.length).toBeGreaterThan(0);
      expect(titles[0]).toHaveTextContent("Back arrow");
      expect(titles[1]).toHaveTextContent("Clock icon");
      expect(titles[2]).toHaveTextContent("Coming soon icon");
    });
  });
});
