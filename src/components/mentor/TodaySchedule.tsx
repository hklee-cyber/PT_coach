"use client";

import Link from "next/link";
import { SLOTS, type DayOfWeek } from "@/lib/schedule";

interface SlotData {
  slot: number;
  student_id: string | null;
  student_name: string | null;
  target_university: string | null;
}

interface Props {
  today: DayOfWeek | null;   // null = 일요일 (코칭 없는 날)
  slots: SlotData[];          // 슬롯 1~6 데이터
}

export default function TodaySchedule({ today, slots }: Props) {
  // 일요일
  if (!today) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
          </svg>
        </div>
        <p className="text-gray-400 font-medium">오늘은 코칭 없는 날입니다.</p>
        <p className="text-gray-300 text-sm mt-1">월요일~토요일 18:00부터 운영됩니다.</p>
      </div>
    );
  }

  // 슬롯 맵 (slot 번호 → 데이터)
  const slotMap = new Map<number, SlotData>();
  slots.forEach((s) => slotMap.set(s.slot, s));

  const assignedCount = slots.filter((s) => s.student_id !== null).length;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">오늘의 코칭 시간표</p>
          <h3 className="text-lg font-black text-gray-900">
            {today}요일
            <span className="text-sm font-normal text-gray-400 ml-2">18:00 – 22:00</span>
          </h3>
        </div>
        <span className="text-sm text-gray-400">
          배정 <span className="font-bold text-gray-900">{assignedCount}</span>
          <span className="text-gray-300 mx-1">/</span>6교시
        </span>
      </div>

      {/* 슬롯 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SLOTS.map(({ slot, startTime, endTime }) => {
          const data    = slotMap.get(slot);
          const hasStudent = data?.student_id != null;

          return hasStudent && data ? (
            // 배정된 교시 — 클릭하면 코칭 입력 화면으로
            <Link
              key={slot}
              href={`/mentor/students/${data.student_id}`}
              className="group relative flex flex-col gap-2 p-4 rounded-2xl border-2 border-blue-500 bg-blue-600 hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-[0.97]"
            >
              {/* 교시 배지 */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-blue-200 uppercase tracking-wider">{slot}교시</span>
                <svg className="w-3.5 h-3.5 text-blue-300 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </div>
              {/* 시간 */}
              <p className="text-[11px] text-blue-200">{startTime}–{endTime}</p>
              {/* 구분선 */}
              <div className="h-px bg-blue-400/50"/>
              {/* 학생 이름 */}
              <p className="text-base font-black text-white leading-tight">{data.student_name}</p>
              {data.target_university && (
                <p className="text-[10px] text-blue-200 leading-snug line-clamp-2">{data.target_university}</p>
              )}
              {/* 하단 CTA */}
              <p className="text-[10px] text-blue-300 font-semibold mt-auto">코칭 기록 작성 →</p>
            </Link>
          ) : (
            // 빈 교시
            <div
              key={slot}
              className="flex flex-col gap-2 p-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50"
            >
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider">{slot}교시</span>
              <p className="text-[11px] text-gray-300">{startTime}–{endTime}</p>
              <div className="h-px bg-gray-100"/>
              <p className="text-sm font-semibold text-gray-300 mt-1">빈 교시</p>
              <p className="text-[10px] text-gray-300 mt-auto">배정 없음</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
