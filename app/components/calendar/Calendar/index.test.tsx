import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "./index";

// Mock fetch
global.fetch = vi.fn();

describe("Calendar", () => {
  const mockShifts = [
    {
      id: "1",
      date: "2024-05-15",
      note: null,
      workTimeType: {
        id: "1",
        name: "早番",
        startTime: "07:00",
        endTime: "16:00",
        color: "#FF6B35",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ shifts: mockShifts }),
    } as Response);
  });

  it("現在の年月が表示される", async () => {
    render(<Calendar />);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await waitFor(() => {
      expect(screen.getByText(`${year}年${month}月`)).toBeInTheDocument();
    });
  });

  it("曜日ヘッダーが表示される", async () => {
    render(<Calendar />);

    await waitFor(() => {
      expect(screen.getByText("日")).toBeInTheDocument();
      expect(screen.getByText("月")).toBeInTheDocument();
      expect(screen.getByText("火")).toBeInTheDocument();
      expect(screen.getByText("水")).toBeInTheDocument();
      expect(screen.getByText("木")).toBeInTheDocument();
      expect(screen.getByText("金")).toBeInTheDocument();
      expect(screen.getByText("土")).toBeInTheDocument();
    });
  });

  it("前月ボタンをクリックすると前月に遷移する", async () => {
    const user = userEvent.setup();
    render(<Calendar />);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    await waitFor(() => {
      expect(
        screen.getByText(`${currentYear}年${currentMonth}月`),
      ).toBeInTheDocument();
    });

    const prevButton = screen.getByLabelText("前月");
    await user.click(prevButton);

    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    await waitFor(() => {
      expect(
        screen.getByText(`${prevYear}年${prevMonth}月`),
      ).toBeInTheDocument();
    });
  });

  it("次月ボタンをクリックすると次月に遷移する", async () => {
    const user = userEvent.setup();
    render(<Calendar />);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    await waitFor(() => {
      expect(
        screen.getByText(`${currentYear}年${currentMonth}月`),
      ).toBeInTheDocument();
    });

    const nextButton = screen.getByLabelText("次月");
    await user.click(nextButton);

    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    await waitFor(() => {
      expect(
        screen.getByText(`${nextYear}年${nextMonth}月`),
      ).toBeInTheDocument();
    });
  });

  it("今月ボタンをクリックすると現在の月に戻る", async () => {
    const user = userEvent.setup();
    render(<Calendar />);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    await waitFor(() => {
      expect(
        screen.getByText(`${currentYear}年${currentMonth}月`),
      ).toBeInTheDocument();
    });

    // 次月に移動
    const nextButton = screen.getByLabelText("次月");
    await user.click(nextButton);

    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    await waitFor(() => {
      expect(
        screen.getByText(`${nextYear}年${nextMonth}月`),
      ).toBeInTheDocument();
    });

    // 今月ボタンで戻る
    const todayButton = screen.getByText("今月");
    await user.click(todayButton);

    await waitFor(() => {
      expect(
        screen.getByText(`${currentYear}年${currentMonth}月`),
      ).toBeInTheDocument();
    });
  });

  it("APIからシフトデータを取得する", async () => {
    render(<Calendar />);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/shifts/my?year=${year}&month=${month}`,
      );
    });
  });

  it("シフトデータ取得中はローディングメッセージが表示される", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ shifts: mockShifts }),
              } as Response),
            100,
          );
        }),
    );

    render(<Calendar />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("シフトデータ取得失敗時はエラーメッセージが表示される", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    } as Response);

    render(<Calendar />);

    await waitFor(() => {
      expect(
        screen.getByText("シフトデータの取得に失敗しました"),
      ).toBeInTheDocument();
    });
  });

  it("月が変わるとAPIが再度呼ばれる", async () => {
    const user = userEvent.setup();
    render(<Calendar />);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/shifts/my?year=${currentYear}&month=${currentMonth}`,
      );
    });

    vi.clearAllMocks();

    const nextButton = screen.getByLabelText("次月");
    await user.click(nextButton);

    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/shifts/my?year=${nextYear}&month=${nextMonth}`,
      );
    });
  });
});
