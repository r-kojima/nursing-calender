import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CalendarDay } from "../types";
import { CalendarGrid } from ".";

describe("CalendarGrid", () => {
  const createDay = (
    date: Date,
    isCurrentMonth: boolean,
    isToday = false,
  ): CalendarDay => ({
    date,
    isCurrentMonth,
    isToday,
    shift: null,
  });

  it("曜日ヘッダーが表示される", () => {
    const days: CalendarDay[] = [];
    render(<CalendarGrid days={days} />);

    expect(screen.getByText("日")).toBeInTheDocument();
    expect(screen.getByText("月")).toBeInTheDocument();
    expect(screen.getByText("火")).toBeInTheDocument();
    expect(screen.getByText("水")).toBeInTheDocument();
    expect(screen.getByText("木")).toBeInTheDocument();
    expect(screen.getByText("金")).toBeInTheDocument();
    expect(screen.getByText("土")).toBeInTheDocument();
  });

  it("日曜日は赤色で表示される", () => {
    const days: CalendarDay[] = [];
    render(<CalendarGrid days={days} />);

    const sunday = screen.getByText("日");
    expect(sunday).toHaveClass("text-error");
  });

  it("土曜日は青色で表示される", () => {
    const days: CalendarDay[] = [];
    render(<CalendarGrid days={days} />);

    const saturday = screen.getByText("土");
    expect(saturday).toHaveClass("text-accent-blue");
  });

  it("平日はデフォルト色で表示される", () => {
    const days: CalendarDay[] = [];
    render(<CalendarGrid days={days} />);

    const monday = screen.getByText("月");
    expect(monday).toHaveClass("text-foreground");
  });

  it("7列のグリッドレイアウトが適用される", () => {
    const days: CalendarDay[] = [];
    const { container } = render(<CalendarGrid days={days} />);

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-7");
  });

  it("CalendarDayの配列が渡された場合、すべての日が表示される", () => {
    const days: CalendarDay[] = [
      createDay(new Date("2024-05-01"), true),
      createDay(new Date("2024-05-02"), true),
      createDay(new Date("2024-05-03"), true),
    ];

    render(<CalendarGrid days={days} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("onDayClickが渡された場合、日付クリックでイベントが発火する", async () => {
    const user = userEvent.setup();
    const onDayClick = vi.fn();
    const days: CalendarDay[] = [createDay(new Date("2024-05-01"), true)];

    render(<CalendarGrid days={days} onDayClick={onDayClick} />);

    const dayButton = screen.getByRole("button");
    await user.click(dayButton);

    expect(onDayClick).toHaveBeenCalledWith(days[0].date);
  });

  it("onDayClickが渡されていない場合、クリックイベントは発火しない", () => {
    const days: CalendarDay[] = [createDay(new Date("2024-05-01"), true)];
    const { container } = render(<CalendarGrid days={days} />);

    // ボタンではなくdivが表示されることを確認
    const button = container.querySelector("button");
    expect(button).not.toBeInTheDocument();
  });

  it("空の配列が渡された場合でも曜日ヘッダーは表示される", () => {
    const days: CalendarDay[] = [];
    render(<CalendarGrid days={days} />);

    expect(screen.getByText("日")).toBeInTheDocument();
    expect(screen.getByText("土")).toBeInTheDocument();
  });
});
