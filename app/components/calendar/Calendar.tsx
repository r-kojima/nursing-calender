"use client";

import { useEffect, useState } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarHeader } from "./CalendarHeader";
import type { CalendarDay, ShiftData } from "./types";

export function Calendar() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // カレンダーの日付データを生成
  const generateCalendarDays = (): CalendarDay[] => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const firstDayOfWeek = firstDay.getDay(); // 0 (Sunday) - 6 (Saturday)
    const daysInMonth = lastDay.getDate();

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 前月の日付を追加
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 2, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        shift: null,
      });
    }

    // 当月の日付を追加
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = date.toISOString().split("T")[0];
      const shift = shifts.find((s) => s.date === dateStr) || null;

      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        shift,
      });
    }

    // 次月の日付を追加（グリッドを埋めるため）
    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      for (let day = 1; day <= remainingCells; day++) {
        const date = new Date(year, month, day);
        days.push({
          date,
          isCurrentMonth: false,
          isToday: date.getTime() === today.getTime(),
          shift: null,
        });
      }
    }

    return days;
  };

  // 月が変わったらシフトデータを再取得
  useEffect(() => {
    const fetchShifts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/shifts/my?year=${year}&month=${month}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch shifts");
        }

        const data = await response.json();
        setShifts(data.shifts || []);
      } catch (err) {
        setError("シフトデータの取得に失敗しました");
        console.error("Error fetching shifts:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchShifts();
  }, [year, month]);

  // ナビゲーションハンドラー
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-error">{error}</p>
      </div>
    );
  }

  const calendarDays = generateCalendarDays();

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <CalendarHeader
        year={year}
        month={month}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />
      <CalendarGrid days={calendarDays} />
    </div>
  );
}
