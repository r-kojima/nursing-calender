export type WorkTimeType = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string | null;
  isActive?: boolean;
};

export type Member = {
  id: string;
  name: string;
  isSelf: boolean;
};

export type ShiftData = {
  id: string;
  memberId: string;
  date: string; // ISO 8601形式
  note: string | null;
  workTimeType: WorkTimeType | null; // nullの場合は休み
  member: Member;
};

export type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  shift: ShiftData | null;
};

export type MemberRow = {
  member: Member;
  days: CalendarDay[];
};
