import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CalendarDay } from "../types";
import { DayCell } from ".";

describe("DayCell", () => {
  const createDay = (overrides?: Partial<CalendarDay>): CalendarDay => ({
    date: new Date("2024-05-15"),
    day: 15,
    isCurrentMonth: true,
    isToday: false,
    isSelected: false,
    shift: null,
    ...overrides,
  });

  it("日付が表示される", () => {
    const day = createDay();
    const onClick = vi.fn();
    render(<DayCell day={day} dayIndex={3} onClick={onClick} />);
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("本日の場合は特別なリングが表示される", () => {
    const day = createDay({ isToday: true });
    const onClick = vi.fn();
    const { container } = render(
      <DayCell day={day} dayIndex={3} onClick={onClick} />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell).toHaveClass("ring-2");
    expect(cell).toHaveClass("ring-primary");
  });

  it("当月でない場合はグレーアウト表示される", () => {
    const day = createDay({ isCurrentMonth: false });
    const onClick = vi.fn();
    const { container } = render(
      <DayCell day={day} dayIndex={3} onClick={onClick} />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell).toHaveClass("bg-foreground/5");
  });

  it("選択されている場合は特別な背景色が表示される", () => {
    const day = createDay({ isSelected: true });
    const onClick = vi.fn();
    const { container } = render(
      <DayCell day={day} dayIndex={3} onClick={onClick} />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell).toHaveClass("bg-primary-pale");
    expect(cell).toHaveClass("ring-2");
    expect(cell).toHaveClass("ring-primary");
  });

  it("日曜日（dayIndex=0）の場合は日付が赤色で表示される", () => {
    const day = createDay();
    const onClick = vi.fn();
    render(<DayCell day={day} dayIndex={0} onClick={onClick} />);
    const dateElement = screen.getByText("15");
    expect(dateElement).toHaveClass("text-error");
  });

  it("土曜日（dayIndex=6）の場合は日付が青色で表示される", () => {
    const day = createDay();
    const onClick = vi.fn();
    render(<DayCell day={day} dayIndex={6} onClick={onClick} />);
    const dateElement = screen.getByText("15");
    expect(dateElement).toHaveClass("text-accent-blue");
  });

  it("シフトがある場合はシフト情報が表示される", () => {
    const day = createDay({
      shift: {
        id: "1",
        memberId: "self-member-1",
        date: "2024-05-15",
        note: null,
        workTimeType: {
          id: "1",
          name: "早番",
          startTime: "07:00",
          endTime: "16:00",
          color: "#FF6B35",
          isActive: true,
        },
        member: {
          id: "self-member-1",
          name: "自分",
          isSelf: true,
        },
      },
    });
    const onClick = vi.fn();
    render(<DayCell day={day} dayIndex={3} onClick={onClick} />);
    expect(screen.getByText("早番")).toBeInTheDocument();
  });

  it("シフトがない場合はシフト情報が表示されない", () => {
    const day = createDay({ shift: null });
    const onClick = vi.fn();
    render(<DayCell day={day} dayIndex={3} onClick={onClick} />);
    expect(screen.queryByText("休み")).not.toBeInTheDocument();
  });

  it("シフトにメモがある場合はインジケーターが表示される", () => {
    const day = createDay({
      shift: {
        id: "1",
        memberId: "self-member-1",
        date: "2024-05-15",
        note: "テストメモ",
        workTimeType: {
          id: "1",
          name: "早番",
          startTime: "07:00",
          endTime: "16:00",
          color: "#FF6B35",
          isActive: true,
        },
        member: {
          id: "self-member-1",
          name: "自分",
          isSelf: true,
        },
      },
    });
    const onClick = vi.fn();
    const { container } = render(
      <DayCell day={day} dayIndex={3} onClick={onClick} />,
    );
    // メモインジケーター（黒い丸）が存在することを確認
    const indicator = container.querySelector(".bg-black.rounded-full");
    expect(indicator).toBeInTheDocument();
  });

  it("クリックイベントが発火する", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const day = createDay();
    render(<DayCell day={day} dayIndex={3} onClick={onClick} />);

    const cell = screen.getByRole("button");
    await user.click(cell);

    expect(onClick).toHaveBeenCalledWith(day);
  });

  it("キーボード操作（Enter）でイベントが発火する", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const day = createDay();
    render(<DayCell day={day} dayIndex={3} onClick={onClick} />);

    const cell = screen.getByRole("button");
    cell.focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledWith(day);
  });

  it("キーボード操作（Space）でイベントが発火する", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const day = createDay();
    render(<DayCell day={day} dayIndex={3} onClick={onClick} />);

    const cell = screen.getByRole("button");
    cell.focus();
    await user.keyboard("{ }");

    expect(onClick).toHaveBeenCalledWith(day);
  });

  it("シフト設定モードの場合は特別なホバースタイルが適用される", () => {
    const onClick = vi.fn();
    const day = createDay();
    const { container } = render(
      <DayCell day={day} dayIndex={3} onClick={onClick} isShiftSetupMode />,
    );

    const cell = container.firstChild as HTMLElement;
    expect(cell).toHaveClass("hover:ring-2");
    expect(cell).toHaveClass("hover:ring-primary/50");
  });
});
