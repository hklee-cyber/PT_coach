"use client";

import { useState, useEffect } from "react";
import { SLOTS, DAYS, type DayOfWeek } from "@/lib/schedule";

export interface ScheduleItem {
  student_id: string;
  student_name: string;
  student_seat: string | null;
  mentor_id: string;
  mentor_name: string;
  day_of_week: DayOfWeek;
  slot: number;
}

interface Props {
  schedules: ScheduleItem[];
}

// ── 현재 시각 기준 슬롯 상태 ───────────────────────────────────

type SlotStatus = "대기" | "진행중" | "완료";

function calcStatus(slot: number, now: Date): SlotStatus {
  const total = now.getHours() * 60 + now.getMinutes();
  const def   = SLOTS[slot - 1];
  const [sh, sm] = def.startTime.split(":").map(Number);
  const [eh, em] = def.endTime.split(":").map(Number);
  if (total < sh * 60 + sm) return "대기";
  if (total >= eh * 60 + em) return "완료";
  return "진행중";
}

const STATUS_STYLE: Record<SlotStatus, string> = {
  "대기":   "bg-slate-100 text-slate-500",
  "진행중": "bg-green-100 text-green-700",
  "완료":   "bg-blue-50  text-blue-400",
};

// ── 오늘 요일 (JS 0=일) ───────────────────────────────────────

const DAY_BY_INDEX: Record<number, DayOfWeek | null> = {
  0: null, 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토",
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────

export default function DashboardSchedule({ schedules }: Props) {
  const [now,    setNow]    = useState<Date | null>(null);
  const [popup,  setPopup]  = useState<{ day: DayOfWeek; slot: number } | null>(null);

  // 클라이언트 마운트 후 시각 설정 (hydration mismatch 방지)
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000); // 1분마다 갱신
    return () => clearInterval(id);
  }, []);

  const todayKey   = now ? DAY_BY_INDEX[now.getDay()] : null;
  const todayLabel = now
    ? now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })
    : "";

  // 오늘 일정 (슬롯 순)
  const todayItems = schedules
    .filter((s) => s.day_of_week === todayKey)
    .sort((a, b) => a.slot - b.slot);

  // 주간 그리드 — (day, slot) → 학생 배열
  function cellStudents(day: DayOfWeek, slot: number) {
    return schedules.filter((s) => s.day_of_week === day && s.slot === slot);
  }

  const popupItems = popup ? cellStudents(popup.day, popup.slot) : [];

  // ── 렌더링 ─────────────────────────────────────────────────

  return (
    <section className="mt-12">
      {/* 배경 컨테이너 */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          실시간 PT 일정 현황
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ──────────────────────────────────────────────────
              왼쪽: 오늘의 PT 일정
          ────────────────────────────────────────────────── */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">📅 오늘의 PT 일정</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {todayLabel || "날짜 로딩 중…"}
              </p>
            </div>

            {/* 리스트 */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {!now ? (
                // 마운트 전 스켈레톤
                <div className="px-5 py-8 text-center">
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4 mx-auto" />
                </div>
              ) : todayKey === null ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">오늘(일요일)은 PT 일정이 없습니다.</p>
                </div>
              ) : todayItems.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <svg className="w-8 h-8 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-400">오늘 예정된 PT 일정이 없습니다.</p>
                </div>
              ) : (
                todayItems.map((item) => {
                  const status   = calcStatus(item.slot, now);
                  const slotDef  = SLOTS[item.slot - 1];
                  return (
                    <div
                      key={`${item.student_id}-${item.slot}`}
                      className="px-5 py-3.5 flex items-center gap-3"
                    >
                      {/* 교시 */}
                      <div className="shrink-0 w-14 text-center">
                        <p className="text-xs font-bold text-gray-700">{item.slot}교시</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{slotDef.startTime}</p>
                      </div>

                      <div className="w-px h-8 bg-gray-100 shrink-0" />

                      {/* 학생 / 멘토 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                          {item.student_seat && (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 shrink-0">
                              {item.student_seat}
                            </span>
                          )}
                          {item.student_name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{item.mentor_name} 멘토</p>
                      </div>

                      {/* 상태 뱃지 */}
                      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>
                        {status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* 푸터 */}
            {todayItems.length > 0 && (
              <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/40">
                <p className="text-[11px] text-gray-400 text-center">
                  총 {todayItems.length}건 · 1분마다 상태 갱신
                </p>
              </div>
            )}
          </div>

          {/* ──────────────────────────────────────────────────
              오른쪽: 주간 PT 현황 그리드
          ────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">📊 주간 PT 현황</h3>
                <p className="text-xs text-gray-400 mt-0.5">칸을 클릭하면 배정 명단을 볼 수 있습니다</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />
                  오늘
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
                  배정 있음
                </span>
              </div>
            </div>

            {/* 그리드 */}
            <div className="overflow-x-auto p-4">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-400 text-left w-28 rounded-tl-lg">
                      교시 / 시간
                    </th>
                    {DAYS.map((day) => {
                      const isToday = now && DAY_BY_INDEX[now.getDay()] === day;
                      return (
                        <th
                          key={day}
                          className={`border border-gray-100 px-3 py-2.5 text-xs font-bold text-center ${
                            isToday ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          {day}요일
                          {isToday && (
                            <span className="ml-1 text-[9px] font-semibold text-blue-400">TODAY</span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map(({ slot, startTime, endTime }) => (
                    <tr key={slot}>
                      {/* 교시 헤더 */}
                      <td className="border border-gray-100 px-3 py-3 bg-gray-50/60">
                        <p className="font-semibold text-gray-800 text-xs">{slot}교시</p>
                        <p className="text-gray-400 text-[10px] mt-0.5">{startTime}–{endTime}</p>
                      </td>

                      {DAYS.map((day) => {
                        const items   = cellStudents(day, slot);
                        const count   = items.length;
                        const isToday = now && DAY_BY_INDEX[now.getDay()] === day;

                        return (
                          <td
                            key={day}
                            className={`border border-gray-100 text-center transition-colors ${
                              count > 0
                                ? isToday
                                  ? "bg-blue-50 hover:bg-blue-100 cursor-pointer"
                                  : "bg-emerald-50/60 hover:bg-emerald-100/60 cursor-pointer"
                                : isToday
                                ? "bg-blue-50/30"
                                : "hover:bg-gray-50/80"
                            }`}
                            onClick={() => count > 0 && setPopup({ day, slot })}
                          >
                            {count > 0 ? (
                              <div className="py-2 flex flex-col items-center gap-0.5">
                                <span className={`text-base font-bold ${isToday ? "text-blue-700" : "text-emerald-700"}`}>
                                  {count}
                                </span>
                                <span className="text-[9px] text-gray-400">명</span>
                              </div>
                            ) : (
                              <div className="py-2">
                                <span className="text-gray-200 text-xs">—</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 요약 푸터 */}
            <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/40 flex items-center gap-4">
              <p className="text-[11px] text-gray-400">
                전체 배정 학생 수: <span className="font-bold text-gray-600">{schedules.length}명</span>
              </p>
              <p className="text-[11px] text-gray-400">
                오늘({todayKey ?? "—"}) 배정: <span className="font-bold text-gray-600">{todayItems.length}명</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 배정 명단 팝업 모달 ─────────────────────────────── */}
      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPopup(null); }}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={() => setPopup(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {popup.day}요일 {popup.slot}교시 배정 명단
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {SLOTS[popup.slot - 1].startTime}–{SLOTS[popup.slot - 1].endTime} · {popupItems.length}명
                </p>
              </div>
              <button
                onClick={() => setPopup(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 명단 */}
            <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {popupItems.map((item, idx) => (
                <li key={item.student_id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs font-semibold text-gray-300 w-5 shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                      {item.student_seat && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 shrink-0">
                          {item.student_seat}
                        </span>
                      )}
                      {item.student_name}
                    </p>
                    <p className="text-xs text-gray-400">{item.mentor_name} 멘토</p>
                  </div>
                  {now && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[calcStatus(item.slot, now)]}`}>
                      {calcStatus(item.slot, now)}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 text-center">
                Esc 또는 바깥 영역 클릭으로 닫기
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
