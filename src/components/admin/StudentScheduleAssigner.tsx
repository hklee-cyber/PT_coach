"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAvailableMentors, assignStudentSchedule, removeStudentSchedule } from "@/app/actions/schedule";
import { SLOTS, DAYS, type DayOfWeek } from "@/lib/schedule";

interface CurrentSchedule {
  mentor_id: string;
  mentor_name: string;
  day_of_week: DayOfWeek;
  slot: number;
}

interface Props {
  studentId: string;
  studentName: string;
  current: CurrentSchedule | null;
}

export default function StudentScheduleAssigner({ studentId, studentName, current }: Props) {
  const router = useRouter();

  const [schedule,   setSchedule]   = useState<CurrentSchedule | null>(current);
  const [showForm,   setShowForm]   = useState(false);
  const [day,        setDay]        = useState<DayOfWeek>("월");
  const [slot,       setSlot]       = useState<number>(1);
  const [mentors,    setMentors]    = useState<{ id: string; full_name: string }[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [selectedM,  setSelectedM]  = useState<string>("");
  const [saving,     setSaving]     = useState(false);
  const [removing,   setRemoving]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSearch() {
    setSearching(true);
    setError(null);
    setMentors([]);
    setSelectedM("");
    try {
      const list = await getAvailableMentors(day, slot, studentId);
      setMentors(list);
      if (list.length === 0) setError("해당 시간에 배정 가능한 멘토가 없습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setSearching(false);
    }
  }

  async function handleAssign() {
    if (!selectedM) return;
    setSaving(true);
    setError(null);
    try {
      await assignStudentSchedule(studentId, selectedM, day, slot);
      const mentor = mentors.find((m) => m.id === selectedM);
      const newSchedule: CurrentSchedule = {
        mentor_id: selectedM,
        mentor_name: mentor?.full_name ?? "",
        day_of_week: day,
        slot,
      };
      setSchedule(newSchedule);
      setShowForm(false);
      setMentors([]);
      setSelectedM("");
      showToast(`${day}요일 ${slot}교시 · ${mentor?.full_name ?? ""} 멘토로 배정 완료`, true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "배정 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm(`'${studentName}' 학생의 스케줄 배정을 해제하시겠습니까?`)) return;
    setRemoving(true);
    try {
      await removeStudentSchedule(studentId);
      setSchedule(null);
      setShowForm(false);
      showToast("배정이 해제되었습니다.", true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "해제 실패");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? "bg-gray-900" : "bg-red-500"}`}>
          {toast.ok
            ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {toast.msg}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">코칭 스케줄 배정</h3>
          <p className="text-xs text-gray-400 mt-0.5">요일·교시를 선택하면 가능한 멘토를 보여드립니다</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* 현재 배정 상태 */}
          {schedule ? (
            <div className="flex items-center justify-between p-3.5 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900">
                    {schedule.day_of_week}요일 {schedule.slot}교시
                    <span className="text-xs font-normal text-blue-500 ml-2">
                      {SLOTS[schedule.slot - 1]?.startTime}–{SLOTS[schedule.slot - 1]?.endTime}
                    </span>
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">담당 멘토: {schedule.mentor_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowForm(true); setDay(schedule.day_of_week); setSlot(schedule.slot); }}
                  className="px-3 py-1.5 text-xs font-semibold border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                >
                  변경
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                >
                  {removing ? "해제 중…" : "배정 해제"}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center">
              <p className="text-sm text-gray-400">스케줄이 배정되지 않았습니다.</p>
            </div>
          )}

          {/* 배정 폼 */}
          {(!schedule || showForm) && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3 flex-wrap">
                {/* 요일 선택 */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">요일</label>
                  <div className="flex gap-1">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setDay(d); setMentors([]); setSelectedM(""); }}
                        className={`w-9 h-9 rounded-lg text-sm font-bold transition ${
                          day === d
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 교시 선택 */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">교시</label>
                  <div className="flex gap-1 flex-wrap">
                    {SLOTS.map(({ slot: s, startTime }) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setSlot(s); setMentors([]); setSelectedM(""); }}
                        className={`px-2.5 h-9 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                          slot === s
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {s}교시<span className="text-[10px] ml-0.5 opacity-70">{startTime}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 조회 버튼 */}
                <div className="flex flex-col gap-1 mt-auto">
                  <label className="text-[11px] font-semibold text-transparent">.</label>
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-4 h-9 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
                  >
                    {searching ? "조회 중…" : "멘토 조회"}
                  </button>
                </div>
              </div>

              {/* 오류 */}
              {error && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* 멘토 목록 */}
              {mentors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    배정 가능 멘토 ({mentors.length}명)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {mentors.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedM(m.id)}
                        className={`p-3 rounded-xl border text-sm font-semibold text-left transition ${
                          selectedM === m.id
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-800 hover:border-gray-400"
                        }`}
                      >
                        {m.full_name}
                        {selectedM === m.id && (
                          <span className="ml-1.5 text-[10px] text-blue-500">선택됨</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 배정 버튼 */}
              {selectedM && (
                <div className="flex gap-2">
                  <button
                    onClick={handleAssign}
                    disabled={saving}
                    className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {saving ? "배정 중…" : `${day}요일 ${slot}교시로 배정`}
                  </button>
                  {showForm && (
                    <button
                      onClick={() => { setShowForm(false); setMentors([]); setSelectedM(""); setError(null); }}
                      className="px-5 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
                    >
                      취소
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
