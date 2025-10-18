"use client";

import { useEffect, useState } from "react";
import type { Member, WorkTimeType } from "../types";

type ShiftEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  date: Date | null;
  initialShift: {
    id: string;
    workTimeTypeId: string | null;
    note: string | null;
  } | null;
  workTimeTypes: WorkTimeType[];
  onSave: (data: {
    memberId: string;
    date: string;
    workTimeTypeId: string | null;
    note: string;
  }) => Promise<void>;
  onDelete: (shiftId: string) => Promise<void>;
};

export function ShiftEditModal({
  isOpen,
  onClose,
  member,
  date,
  initialShift,
  workTimeTypes,
  onSave,
  onDelete,
}: ShiftEditModalProps) {
  const [workTimeTypeId, setWorkTimeTypeId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダルが開いたら初期値をセット
  useEffect(() => {
    if (isOpen && initialShift) {
      setWorkTimeTypeId(initialShift.workTimeTypeId);
      setNote(initialShift.note || "");
    } else if (isOpen) {
      // 新規作成の場合
      setWorkTimeTypeId(null);
      setNote("");
    }
  }, [isOpen, initialShift]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!member || !date) return;

    setIsSubmitting(true);
    try {
      await onSave({
        memberId: member.id,
        date: date.toISOString().split("T")[0],
        workTimeTypeId,
        note,
      });
      onClose();
    } catch (error) {
      console.error("Error saving shift:", error);
      alert("シフトの保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialShift) return;

    if (!confirm("このシフトを削除してもよろしいですか？")) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onDelete(initialShift.id);
      onClose();
    } catch (error) {
      console.error("Error deleting shift:", error);
      alert("シフトの削除に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !member || !date) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-foreground/20">
          <h2 className="text-lg font-semibold text-foreground">
            {initialShift ? "シフトの編集" : "シフトの登録"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              メンバー
            </label>
            <div className="text-sm text-foreground/80">{member.name}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              日付
            </label>
            <div className="text-sm text-foreground/80">
              {date.toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="workTimeTypeId"
              className="block text-sm font-medium text-foreground mb-1"
            >
              勤務時間 <span className="text-error">*</span>
            </label>
            <select
              id="workTimeTypeId"
              value={workTimeTypeId || ""}
              onChange={(e) => setWorkTimeTypeId(e.target.value || null)}
              className="w-full px-3 py-2 border border-foreground/20 rounded-md bg-background text-foreground"
              required
            >
              <option value="">休み</option>
              {workTimeTypes
                .filter((wtt) => wtt.isActive)
                .map((wtt) => (
                  <option key={wtt.id} value={wtt.id}>
                    {wtt.name} ({wtt.startTime}-{wtt.endTime})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="note"
              className="block text-sm font-medium text-foreground mb-1"
            >
              備考
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-foreground/20 rounded-md bg-background text-foreground resize-none"
              rows={3}
              placeholder="メモを入力（任意）"
            />
          </div>

          <div className="flex justify-between gap-2 pt-2">
            {initialShift && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-error hover:bg-error/10 rounded-md transition-colors disabled:opacity-50"
              >
                削除
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-foreground/10 rounded-md transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium bg-primary text-white hover:bg-primary-dark rounded-md transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
