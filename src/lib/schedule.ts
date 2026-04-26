// ── 슬롯 정의 (18:00부터 40분 단위, 6교시) ─────────────────────
export const SLOTS = [
  { slot: 1, startTime: "18:00", endTime: "18:40" },
  { slot: 2, startTime: "18:40", endTime: "19:20" },
  { slot: 3, startTime: "19:20", endTime: "20:00" },
  { slot: 4, startTime: "20:00", endTime: "20:40" },
  { slot: 5, startTime: "20:40", endTime: "21:20" },
  { slot: 6, startTime: "21:20", endTime: "22:00" },
] as const;

export type SlotNumber = 1 | 2 | 3 | 4 | 5 | 6;

// ── 요일 정의 ─────────────────────────────────────────────────
export const DAYS = ["월", "화", "수", "목", "금", "토"] as const;
export type DayOfWeek = typeof DAYS[number];

// JS Date.getDay() (0=일,1=월,...,6=토) → 한국어 요일 (null = 일요일)
export const DAY_INDEX_MAP: Record<number, DayOfWeek | null> = {
  0: null,
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

export function getSlotLabel(slot: number): string {
  return `${slot}교시`;
}

export function getSlotTime(slot: number): string {
  return `${SLOTS[slot - 1]?.startTime ?? ""} – ${SLOTS[slot - 1]?.endTime ?? ""}`;
}

export function getTodayKorean(): DayOfWeek | null {
  return DAY_INDEX_MAP[new Date().getDay()] ?? null;
}
