import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShiftBadge } from ".";

describe("ShiftBadge", () => {
  it("休みの場合は「休み」と表示される", () => {
    render(<ShiftBadge workTimeType={null} />);
    expect(screen.getByText("休み")).toBeInTheDocument();
  });

  it("WorkTimeTypeが指定されている場合は名前が表示される", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: "#FF6B35",
      isActive: true,
    };

    render(<ShiftBadge workTimeType={workTimeType} />);
    expect(screen.getByText("早番")).toBeInTheDocument();
  });

  it("WorkTimeTypeの色が背景色として適用される", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: "#FF6B35",
      isActive: true,
    };

    const { container } = render(<ShiftBadge workTimeType={workTimeType} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveStyle({ backgroundColor: "#FF6B35" });
  });

  it("色が指定されていない場合はデフォルト色が使用される", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: null,
      isActive: true,
    };

    const { container } = render(<ShiftBadge workTimeType={workTimeType} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveStyle({ backgroundColor: "#e5e7eb" });
  });

  it("常に黒いテキストが表示される", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: "#FF6B35",
      isActive: true,
    };

    const { container } = render(<ShiftBadge workTimeType={workTimeType} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveStyle({ color: "#000" });
  });

  it("classNameが渡された場合は適用される", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: "#FF6B35",
      isActive: true,
    };

    const { container } = render(
      <ShiftBadge workTimeType={workTimeType} className="custom-class" />,
    );
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass("custom-class");
  });

  it("hasNoteがtrueの場合はメモインジケーターが表示される", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: "#FF6B35",
      isActive: true,
    };

    const { container } = render(
      <ShiftBadge workTimeType={workTimeType} hasNote />,
    );
    const indicator = container.querySelector(".bg-black.rounded-full");
    expect(indicator).toBeInTheDocument();
  });

  it("hasNoteがfalseの場合はメモインジケーターが表示されない", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: "#FF6B35",
      isActive: true,
    };

    const { container } = render(
      <ShiftBadge workTimeType={workTimeType} hasNote={false} />,
    );
    const indicator = container.querySelector(".bg-black.rounded-full");
    expect(indicator).not.toBeInTheDocument();
  });

  it("休みの場合でもhasNoteがtrueならメモインジケーターが表示される", () => {
    const { container } = render(<ShiftBadge workTimeType={null} hasNote />);
    const indicator = container.querySelector(".bg-black.rounded-full");
    expect(indicator).toBeInTheDocument();
  });

  it("レスポンシブクラスが適用されている", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: "#FF6B35",
      isActive: true,
    };

    const { container } = render(<ShiftBadge workTimeType={workTimeType} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass("sm:px-2");
    expect(badge).toHaveClass("sm:py-1");
  });
});
