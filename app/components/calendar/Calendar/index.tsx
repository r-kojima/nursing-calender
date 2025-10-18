"use client";

import { useEffect, useState } from "react";
import { CalendarHeader } from "../CalendarHeader";
import { ShiftEditModal } from "../ShiftEditModal";
import type { Member, MemberRow, ShiftData, WorkTimeType } from "../types";

export function Calendar() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [workTimeTypes, setWorkTimeTypes] = useState<WorkTimeType[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(true);
  const [membersLoading, setMembersLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // モーダル関連の状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<{
    id: string;
    workTimeTypeId: string | null;
    note: string | null;
  } | null>(null);

  // メンバーごとのカレンダーデータを生成
  const generateMemberRows = (): MemberRow[] => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return members.map((member) => {
      const days = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split("T")[0];
        const shift =
          shifts.find((s) => s.memberId === member.id && s.date === dateStr) ||
          null;

        days.push({
          date,
          isCurrentMonth: true,
          isToday: date.getTime() === today.getTime(),
          shift,
        });
      }

      return {
        member,
        days,
      };
    });
  };

  // メンバー一覧を取得
  useEffect(() => {
    const fetchMembers = async () => {
      setMembersLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/members");

        if (!response.ok) {
          throw new Error("Failed to fetch members");
        }

        const data = await response.json();
        setMembers(data.members || []);
      } catch (err) {
        setError("メンバーデータの取得に失敗しました");
        console.error("Error fetching members:", err);
      } finally {
        setMembersLoading(false);
      }
    };

    fetchMembers();
  }, []);

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

  // 月が変わったら選択日を1日に変更
  useEffect(() => {
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth() + 1;

    // 選択中の日付が表示中の月と異なる場合、選択日を表示中の月の1日に変更
    if (selectedYear !== year || selectedMonth !== month) {
      const newSelectedDate = new Date(year, month - 1, 1);
      newSelectedDate.setHours(0, 0, 0, 0);
      setSelectedDate(newSelectedDate);
    }
  }, [year, month, selectedDate]);

  // 月が変わったらシフトデータを再取得（全メンバー分）
  useEffect(() => {
    const fetchShifts = async () => {
      setShiftsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/shifts?year=${year}&month=${month}`);

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

  const handleDayClick = (
    member: Member,
    date: Date,
    shift: ShiftData | null,
  ) => {
    setEditingMember(member);
    setEditingDate(date);
    if (shift) {
      setEditingShift({
        id: shift.id,
        workTimeTypeId: shift.workTimeType?.id || null,
        note: shift.note,
      });
    } else {
      setEditingShift(null);
    }
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingMember(null);
    setEditingDate(null);
    setEditingShift(null);
  };

  const handleSaveShift = async (data: {
    memberId: string;
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
    const response = await fetch(`/api/shifts?year=${year}&month=${month}`);
    const result = await response.json();
    setShifts(result.shifts || []);
  };

  const handleDeleteShift = async (shiftId: string) => {
    await fetch(`/api/shifts/${shiftId}`, {
      method: "DELETE",
    });

    // シフトデータを再取得
    const response = await fetch(`/api/shifts?year=${year}&month=${month}`);
    const result = await response.json();
    setShifts(result.shifts || []);
  };

  const memberRows = generateMemberRows();
  const isLoading = shiftsLoading || membersLoading;

  return (
    <div className="w-full mx-auto">
      <CalendarHeader
        year={year}
        month={month}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />
      {error && (
        <div className="flex items-center justify-center p-4 mb-4 bg-error/10 rounded-lg">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-foreground/60">読み込み中...</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-background">
                <th className="sticky left-0 z-10 bg-background border border-foreground/20 p-2 text-sm font-semibold text-foreground min-w-[100px]">
                  メンバー
                </th>
                {Array.from(
                  { length: new Date(year, month, 0).getDate() },
                  (_, i) => {
                    const day = i + 1;
                    return (
                      <th
                        key={`day-${day}`}
                        className="border border-foreground/20 p-2 text-sm font-semibold text-foreground min-w-[80px]"
                      >
                        {day}
                      </th>
                    );
                  },
                )}
              </tr>
            </thead>
            <tbody>
              {memberRows.map((row) => (
                <tr key={row.member.id}>
                  <td className="sticky left-0 z-10 bg-background border border-foreground/20 p-2 text-sm font-medium text-foreground">
                    {row.member.name}
                  </td>
                  {row.days.map((day) => {
                    const dateKey = day.date.toISOString().split("T")[0];
                    return (
                      <td
                        key={dateKey}
                        className="border border-foreground/20 p-1 cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() =>
                          handleDayClick(row.member, day.date, day.shift)
                        }
                      >
                        {day.shift ? (
                          <div
                            className="rounded px-1 py-2 text-xs relative"
                            style={{
                              backgroundColor:
                                day.shift.workTimeType?.color || "#e5e7eb",
                              color: "#000",
                            }}
                          >
                            <div className="font-semibold truncate">
                              {day.shift.workTimeType?.name || "休み"}
                            </div>
                            {day.shift.workTimeType && (
                              <div className="text-xs opacity-80">
                                {day.shift.workTimeType.startTime}-
                                {day.shift.workTimeType.endTime}
                              </div>
                            )}
                            {day.shift.note && (
                              <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-black rounded-full" />
                            )}
                          </div>
                        ) : (
                          <div className="h-12" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ShiftEditModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        member={editingMember}
        date={editingDate}
        initialShift={editingShift}
        workTimeTypes={workTimeTypes}
        onSave={handleSaveShift}
        onDelete={handleDeleteShift}
      />
    </div>
  );
}
