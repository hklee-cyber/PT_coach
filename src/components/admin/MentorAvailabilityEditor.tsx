"use client";

import { useState } from "react";
import { setMentorAvailability } from "@/app/actions/schedule";
import { SLOTS, DAYS, type DayOfWeek } from "@/lib/schedule";

interface AssignedStudent {
  day_of_week: DayOfWeek;
  slot: number;
  student_name: string;
}

interface Props {
  mentorId: string;
  /** 현재 저장된 가용 슬롯 */
  initialAvailable: { day_of_week: DayOfWeek; slot: number }[];
  /** 해당 멘토에게 배정된 학생별 스케줄 */
  assignedStudents: AssignedStudent[];
}

export default function MentorAvailabilityEditor({
  mentorId,
  initialAvailable,
  assignedStudents,
}: Props) {
  // Set<"월-1"> 형태로 관리
  const toKey = (d: DayOfWeek, s: number) => `${d}-${s}`;

  const [checked, setChecked] = useState<Set<string>>(() => {
    const s = new Set<string>();
    initialAvailable.forEach((a) => s.add(toKey(a.day_of_week, a.slot)));
    return s;
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // 배정된 슬롯 맵
  const assignedMap = new Map<string, string>();
  assignedStudents.forEach((a) => assignedMap.set(toKey(a.day_of_week, a.slot), a.student_name));

  function toggle(day: DayOfWeek, slot: number) {
    const key = toKey(day, slot);
    setChecked((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const slots = Array.from(checked).map((k) => {
        const [d, s] = k.split("-");
        return { day_of_week: d as DayOfWeek, slot: parseInt(s) };
      });
      await setMentorAvailability(mentorId, slots);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">가용 시간 설정</h3>
          <p className="text-xs text-gray-400 mt-0.5">코칭 가능한 요일·교시를 체크하세요</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600 font-medium">✓ 저장됨</span>}
          {error && <span className="text-xs text-red-500">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-100 px-3 py-2.5 text-xs font-semibold text-gray-400 text-left w-28">
                교시 / 시간
              </th>
              {DAYS.map((d) => (
                <th key={d} className="border border-gray-100 px-3 py-2.5 text-xs font-bold text-gray-700 text-center w-[90px]">
                  {d}요일
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map(({ slot, startTime, endTime }) => (
              <tr key={slot} className="hover:bg-gray-50/50 transition-colors">
                {/* 교시 헤더 */}
                <td className="border border-gray-100 px-3 py-3 bg-gray-50/60">
                  <p className="font-semibold text-gray-800 text-xs">{slot}교시</p>
                  <p className="text-gray-400 text-[10px]">{startTime}–{endTime}</p>
                </td>

                {DAYS.map((day) => {
                  const key        = toKey(day, slot);
                  const isChecked  = checked.has(key);
                  const assigned   = assignedMap.get(key);

                  return (
                    <td
                      key={day}
                      onClick={() => toggle(day, slot)}
                      className={`border border-gray-100 px-2 py-2 text-center cursor-pointer transition-colors select-none ${
                        assigned
                          ? "bg-blue-50/60"
                          : isChecked
                          ? "bg-emerald-50/60"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {/* 체크박스 */}
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isChecked && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                            </svg>
                          )}
                        </div>
                        {/* 배정 학생 이름 */}
                        {assigned && (
                          <span className="text-[10px] font-semibold text-blue-600 whitespace-nowrap max-w-[70px] truncate">
                            {assigned}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-blue-600 border-2 border-blue-600 flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <span className="text-[11px] text-gray-500">코칭 가능</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-blue-50 border-2 border-blue-200"/>
          <span className="text-[11px] text-gray-500">배정된 학생 있음</span>
        </div>
      </div>
    </div>
  );
}
