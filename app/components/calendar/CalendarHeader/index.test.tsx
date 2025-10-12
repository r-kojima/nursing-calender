import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarHeader } from ".";

describe("CalendarHeader", () => {
  it("年月が表示される", () => {
    const onPrevMonth = vi.fn();
    const onNextMonth = vi.fn();
    const onToday = vi.fn();

    render(
      <CalendarHeader
        year={2024}
        month={5}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onToday={onToday}
      />,
    );

    expect(screen.getByText("2024年5月")).toBeInTheDocument();
  });

  it("前月ボタンをクリックするとonPrevMonthが呼ばれる", async () => {
    const user = userEvent.setup();
    const onPrevMonth = vi.fn();
    const onNextMonth = vi.fn();
    const onToday = vi.fn();

    render(
      <CalendarHeader
        year={2024}
        month={5}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onToday={onToday}
      />,
    );

    const prevButton = screen.getByLabelText("前月");
    await user.click(prevButton);

    expect(onPrevMonth).toHaveBeenCalledTimes(1);
  });

  it("次月ボタンをクリックするとonNextMonthが呼ばれる", async () => {
    const user = userEvent.setup();
    const onPrevMonth = vi.fn();
    const onNextMonth = vi.fn();
    const onToday = vi.fn();

    render(
      <CalendarHeader
        year={2024}
        month={5}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onToday={onToday}
      />,
    );

    const nextButton = screen.getByLabelText("次月");
    await user.click(nextButton);

    expect(onNextMonth).toHaveBeenCalledTimes(1);
  });

  it("今月ボタンをクリックするとonTodayが呼ばれる", async () => {
    const user = userEvent.setup();
    const onPrevMonth = vi.fn();
    const onNextMonth = vi.fn();
    const onToday = vi.fn();

    render(
      <CalendarHeader
        year={2024}
        month={5}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onToday={onToday}
      />,
    );

    const todayButton = screen.getByText("今月");
    await user.click(todayButton);

    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it("1月が正しく表示される", () => {
    const onPrevMonth = vi.fn();
    const onNextMonth = vi.fn();
    const onToday = vi.fn();

    render(
      <CalendarHeader
        year={2024}
        month={1}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onToday={onToday}
      />,
    );

    expect(screen.getByText("2024年1月")).toBeInTheDocument();
  });

  it("12月が正しく表示される", () => {
    const onPrevMonth = vi.fn();
    const onNextMonth = vi.fn();
    const onToday = vi.fn();

    render(
      <CalendarHeader
        year={2024}
        month={12}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onToday={onToday}
      />,
    );

    expect(screen.getByText("2024年12月")).toBeInTheDocument();
  });
});
