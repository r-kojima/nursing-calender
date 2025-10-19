import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CalendarDay } from "../types";
import { DayCell } from ".";

describe("DayCell", () => {
  const createDay = (overrides?: Partial<CalendarDay>): CalendarDay => ({
    date: new Date("2024-05-15"),
    isCurrentMonth: true,
    isToday: false,
    shift: null,
    ...overrides,
  });

  it("日付が表示される", () => {
    const day = createDay();
    render(<DayCell day={day} />);
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("本日の場合は特別なボーダーが表示される", () => {
    const day = createDay({ isToday: true });
    const { container } = render(<DayCell day={day} />);
    const cell = container.firstChild as HTMLElement;
    expect(cell).toHaveClass("border-primary");
  });

  it("当月でない場合はグレーアウト表示される", () => {
    const day = createDay({ isCurrentMonth: false });
    const { container } = render(<DayCell day={day} />);
    const cell = container.firstChild as HTMLElement;
    expect(cell).toHaveClass("bg-gray-50");
  });

  it("シフトがある場合はShiftBadgeが表示される", () => {
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
    render(<DayCell day={day} />);
    expect(screen.getByText("早番")).toBeInTheDocument();
  });

  it("シフトがない場合はShiftBadgeが表示されない", () => {
    const day = createDay({ shift: null });
    render(<DayCell day={day} />);
    expect(screen.queryByText("休")).not.toBeInTheDocument();
  });

  it("onClickが指定されている場合はクリックイベントが発火する", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const day = createDay();
    render(<DayCell day={day} onClick={onClick} />);

    const cell = screen.getByRole("button");
    await user.click(cell);

    expect(onClick).toHaveBeenCalledWith(day.date);
  });

  it("onClickが指定されていない場合はクリックイベントが発火しない", async () => {
    const user = userEvent.setup();
    const day = createDay();
    const { container } = render(<DayCell day={day} />);

    const cell = container.firstChild as HTMLElement;
    await user.click(cell);

    // エラーが発生しないことを確認（特にアサーションなし）
    expect(cell).toBeInTheDocument();
  });

  it("onClickが指定されている場合はキーボード操作でイベントが発火する", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const day = createDay();
    render(<DayCell day={day} onClick={onClick} />);

    const cell = screen.getByRole("button");
    cell.focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledWith(day.date);
  });

  it("onClickが指定されている場合はホバー時にスタイルが変わる", () => {
    const onClick = vi.fn();
    const day = createDay();
    const { container } = render(<DayCell day={day} onClick={onClick} />);

    const cell = container.firstChild as HTMLElement;
    expect(cell).toHaveClass("cursor-pointer");
    expect(cell).toHaveClass("hover:bg-gray-100");
  });
});
