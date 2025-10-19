"use client";

import { useEffect, useState } from "react";
import { CalendarHeader } from "../CalendarHeader";
import { ShiftEditModal } from "../ShiftEditModal";
import type { ShiftData, WorkTimeType } from "../types";

type CalendarDay = {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  shift: ShiftData | null;
};

type CalendarWeek = CalendarDay[];

export function Calendar() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [workTimeTypes, setWorkTimeTypes] = useState<WorkTimeType[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // モーダル関連の状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<{
    id: string;
    workTimeTypeId: string | null;
    note: string | null;
  } | null>(null);

  // シフト設定モード
  const [isShiftSetupMode, setIsShiftSetupMode] = useState(false);

  // 月のカレンダーグリッドを生成（週ごと）
  const generateCalendarWeeks = (): CalendarWeek[] => {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weeks: CalendarWeek[] = [];
    let currentWeek: CalendarDay[] = [];

    // 月初の曜日（0=日曜日）
    const firstDayOfWeek = firstDayOfMonth.getDay();

    // 前月の日付で埋める
    if (firstDayOfWeek > 0) {
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const date = new Date(year, month - 2, day);
        currentWeek.push({
          date,
          day,
          isCurrentMonth: false,
          isToday: false,
          isSelected: false,
          shift: null,
        });
      }
    }

    // 当月の日付
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = date.toISOString().split("T")[0];
      const shift = shifts.find((s) => s.date === dateStr) || null;
      const isToday = date.getTime() === today.getTime();
      const isSelected =
        isShiftSetupMode &&
        date.getTime() === selectedDate.getTime() &&
        date.getMonth() === selectedDate.getMonth();

      currentWeek.push({
        date,
        day,
        isCurrentMonth: true,
        isToday,
        isSelected,
        shift,
      });

      // 土曜日になったら週を確定
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // 最終週に翌月の日付で埋める
    if (currentWeek.length > 0) {
      const remainingDays = 7 - currentWeek.length;
      for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month, i);
        currentWeek.push({
          date,
          day: i,
          isCurrentMonth: false,
          isToday: false,
          isSelected: false,
          shift: null,
        });
      }
      weeks.push(currentWeek);
    }

    return weeks;
  };

  // WorkTimeTypes一覧を取得
  useEffect(() => {
    const fetchWorkTimeTypes = async () => {
      try {
        const response = await fetch("/api/work-time-types");

        if (!response.ok) {
          throw new Error("Failed to fetch work time types");
        }

        const data = await response.json();
        setWorkTimeTypes(data.workTimeTypes || []);
      } catch (err) {
        console.error("Error fetching work time types:", err);
      }
    };

    fetchWorkTimeTypes();
  }, []);

  // 月が変わったら選択日を1日または今日に変更
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;

    // 表示中の月が今月の場合は今日を選択、それ以外は1日を選択
    if (year === todayYear && month === todayMonth) {
      setSelectedDate(today);
    } else {
      const newSelectedDate = new Date(year, month - 1, 1);
      newSelectedDate.setHours(0, 0, 0, 0);
      setSelectedDate(newSelectedDate);
    }
  }, [year, month]);

  // 月が変わったらシフトデータを再取得（自分のシフトのみ）
  useEffect(() => {
    const fetchShifts = async () => {
      setShiftsLoading(true);
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
        setShiftsLoading(false);
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

  const handleDayClick = (day: CalendarDay) => {
    if (isShiftSetupMode) {
      // シフト設定モード: 日付を選択
      if (day.isCurrentMonth) {
        setSelectedDate(day.date);
      }
    } else {
      // 通常モード: シフト編集モーダルを開く
      if (!day.isCurrentMonth) return;

      setEditingDate(day.date);
      if (day.shift) {
        setEditingShift({
          id: day.shift.id,
          workTimeTypeId: day.shift.workTimeType?.id || null,
          note: day.shift.note,
        });
      } else {
        setEditingShift(null);
      }
      setIsModalOpen(true);
    }
  };

  const handleToggleShiftSetupMode = () => {
    setIsShiftSetupMode(!isShiftSetupMode);
  };

  const handlePatternClick = async (workTimeTypeId: string | null) => {
    if (!isShiftSetupMode) return;

    const dateStr = selectedDate.toISOString().split("T")[0];

    // 楽観的UI更新
    const newShift: ShiftData = {
      id: "temp-id",
      memberId: "temp-member",
      date: dateStr,
      note: null,
      workTimeType: workTimeTypeId
        ? workTimeTypes.find((wtt) => wtt.id === workTimeTypeId) || null
        : null,
      member: { id: "temp-member", name: "", isSelf: true },
    };

    setShifts((prev) => {
      const filtered = prev.filter((s) => s.date !== dateStr);
      return [...filtered, newShift];
    });

    // 選択日を翌日に移動
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // 月末を超えた場合は翌月の1日に移動
    if (nextDate.getMonth() !== selectedDate.getMonth()) {
      setYear(nextDate.getFullYear());
      setMonth(nextDate.getMonth() + 1);
    }
    setSelectedDate(nextDate);

    // バックグラウンドでAPI呼び出し
    try {
      await fetch("/api/shifts/upsert", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          workTimeTypeId,
        }),
      });

      // 成功したらデータを再取得
      const response = await fetch(
        `/api/shifts/my?year=${year}&month=${month}`,
      );
      const result = await response.json();
      setShifts(result.shifts || []);
    } catch (err) {
      // エラー時はトースト通知（簡易版: console.error）
      console.error("Failed to save shift:", err);
      // シフトデータを元に戻す
      setShifts((prev) => prev.filter((s) => s.date !== dateStr));
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingDate(null);
    setEditingShift(null);
  };

  const handleSaveShift = async (data: {
    date: string;
    workTimeTypeId: string | null;
    note: string;
  }) => {
    await fetch("/api/shifts/upsert", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    // シフトデータを再取得
    const response = await fetch(`/api/shifts/my?year=${year}&month=${month}`);
    const result = await response.json();
    setShifts(result.shifts || []);
  };

  const handleDeleteShift = async (shiftId: string) => {
    await fetch(`/api/shifts/${shiftId}`, {
      method: "DELETE",
    });

    // シフトデータを再取得
    const response = await fetch(`/api/shifts/my?year=${year}&month=${month}`);
    const result = await response.json();
    setShifts(result.shifts || []);
  };

  const calendarWeeks = generateCalendarWeeks();

  return (
    <div className="w-full mx-auto">
      <CalendarHeader
        year={year}
        month={month}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
        isShiftSetupMode={isShiftSetupMode}
        onToggleShiftSetupMode={handleToggleShiftSetupMode}
      />
      {error && (
        <div className="flex items-center justify-center p-4 mb-4 bg-error/10 rounded-lg">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}
      {shiftsLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-foreground/60">読み込み中...</div>
        </div>
      ) : (
        <div>
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {["日", "月", "火", "水", "木", "金", "土"].map((day, i) => (
              <div
                key={day}
                className={`text-center text-xs sm:text-sm font-semibold py-1 ${
                  i === 0
                    ? "text-error"
                    : i === 6
                      ? "text-accent-blue"
                      : "text-foreground"
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          {/* カレンダーグリッド */}
          <div className="space-y-0.5">
            {calendarWeeks.map((week) => (
              <div
                key={week[0].date.toISOString()}
                className="grid grid-cols-7 gap-0.5"
              >
                {week.map((day, dayIndex) => {
                  const dateKey = day.date.toISOString().split("T")[0];
                  return (
                    <button
                      type="button"
                      key={dateKey}
                      onClick={() => handleDayClick(day)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleDayClick(day);
                        }
                      }}
                      className={`
                        min-h-[80px] sm:min-h-[120px] border rounded p-1 sm:p-2 cursor-pointer transition-all flex flex-col
                        ${day.isCurrentMonth ? "bg-background hover:bg-primary/5" : "bg-foreground/5"}
                        ${day.isToday ? "ring-2 ring-primary" : "border-foreground/20"}
                        ${day.isSelected ? "bg-primary-pale ring-2 ring-primary" : ""}
                        ${isShiftSetupMode && day.isCurrentMonth ? "hover:ring-2 hover:ring-primary/50" : ""}
                      `}
                    >
                      {/* 日付（左上固定） */}
                      <div
                        className={`text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1 self-start ${
                          day.isCurrentMonth
                            ? dayIndex === 0
                              ? "text-error"
                              : dayIndex === 6
                                ? "text-accent-blue"
                                : "text-foreground"
                            : "text-foreground/40"
                        }`}
                      >
                        {day.day}
                      </div>
                      {/* シフト情報 */}
                      {day.shift && day.isCurrentMonth && (
                        <div
                          className="rounded px-1 sm:px-2 py-0.5 sm:py-1 text-xs relative w-full"
                          style={{
                            backgroundColor:
                              day.shift.workTimeType?.color || "#e5e7eb",
                            color: "#000",
                          }}
                        >
                          <div className="font-semibold truncate text-[10px] sm:text-xs">
                            {day.shift.workTimeType?.name || "休み"}
                          </div>
                          {day.shift.workTimeType && (
                            <div className="text-[9px] sm:text-xs opacity-80 truncate">
                              {day.shift.workTimeType.startTime}-
                              {day.shift.workTimeType.endTime}
                            </div>
                          )}
                          {day.shift.note && (
                            <div className="absolute top-0.5 right-0.5 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-black rounded-full" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* シフト設定モード */}
      {isShiftSetupMode && (
        <div className="mt-4 p-4 bg-background border border-primary rounded-lg">
          <p className="text-sm font-medium text-foreground mb-3">
            シフトパターンをクリックしてください
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePatternClick(null)}
              className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-all hover:scale-105"
            >
              休み
            </button>
            {workTimeTypes
              .filter((wtt) => wtt.isActive)
              .map((wtt) => (
                <button
                  key={wtt.id}
                  type="button"
                  onClick={() => handlePatternClick(wtt.id)}
                  className="px-4 py-2 text-sm font-medium rounded-md transition-all hover:scale-105"
                  style={{
                    backgroundColor: wtt.color || "#e5e7eb",
                    color: "#000",
                  }}
                >
                  <div className="font-semibold">{wtt.name}</div>
                  <div className="text-xs opacity-80">
                    {wtt.startTime}-{wtt.endTime}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
      <ShiftEditModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        date={editingDate}
        initialShift={editingShift}
        workTimeTypes={workTimeTypes}
        onSave={handleSaveShift}
        onDelete={handleDeleteShift}
      />
    </div>
  );
}
