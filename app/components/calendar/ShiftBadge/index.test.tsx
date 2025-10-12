import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShiftBadge } from ".";

describe("ShiftBadge", () => {
  it("休みの場合は「休」と表示される", () => {
    render(<ShiftBadge workTimeType={null} />);
    expect(screen.getByText("休")).toBeInTheDocument();
  });

  it("WorkTimeTypeが指定されている場合は名前が表示される", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: "#FF6B35",
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
    };

    render(<ShiftBadge workTimeType={workTimeType} />);
    const badge = screen.getByText("早番");
    expect(badge).toHaveStyle({ backgroundColor: "#FF6B35" });
  });

  it("色が指定されていない場合はデフォルト色が使用される", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: null,
    };

    render(<ShiftBadge workTimeType={workTimeType} />);
    const badge = screen.getByText("早番");
    expect(badge).toHaveStyle({ backgroundColor: "#FF6B35" });
  });

  it("明るい背景色の場合は黒いテキストが表示される", () => {
    const workTimeType = {
      id: "1",
      name: "遅番",
      startTime: "10:00",
      endTime: "19:00",
      color: "#FFFF00", // 黄色（明るい）
    };

    render(<ShiftBadge workTimeType={workTimeType} />);
    const badge = screen.getByText("遅番");
    expect(badge).toHaveStyle({ color: "#000000" });
  });

  it("暗い背景色の場合は白いテキストが表示される", () => {
    const workTimeType = {
      id: "1",
      name: "夜勤",
      startTime: "22:00",
      endTime: "07:00",
      color: "#000080", // ネイビー（暗い）
    };

    render(<ShiftBadge workTimeType={workTimeType} />);
    const badge = screen.getByText("夜勤");
    expect(badge).toHaveStyle({ color: "#FFFFFF" });
  });

  it("classNameが渡された場合は適用される", () => {
    const workTimeType = {
      id: "1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      color: "#FF6B35",
    };

    render(<ShiftBadge workTimeType={workTimeType} className="custom-class" />);
    const badge = screen.getByText("早番");
    expect(badge).toHaveClass("custom-class");
  });
});
