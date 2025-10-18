export type WorkTimeType = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string | null;
  isActive?: boolean;
};

export type ShiftData = {
  id: string;
  date: string; // ISO 8601形式
  note: string | null;
  workTimeType: WorkTimeType | null; // nullの場合は休み
};

export type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  shift: ShiftData | null;
};
