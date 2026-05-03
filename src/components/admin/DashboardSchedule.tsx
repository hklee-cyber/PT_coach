"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SLOTS, DAY_INDEX_MAP, type DayOfWeek } from "@/lib/schedule";
import {
  toggleCancelSession,
  addMakeupSession,
  deleteMakeupSession,
  updateMakeupSession,
} from "@/app/actions/schedule";

// ── 공개 타입 ─────────────────────────────────────────────

export interface ScheduleItem {
  student_id:   string;
  student_name: string;
  student_seat: string | null;
  mentor_id:    string;
  mentor_name:  string;
  day_of_week:  DayOfWeek;
  slot:         number;
}

export interface ScheduleOverride {
  id:           string;
  student_id:   string;
  session_date: string; // "YYYY-MM-DD"
  slot:         number;
  status:       "취소";
}

export interface MakeupSession {
  id:            string;
  student_id:    string;
  student_name:  string;
  student_seat:  string | null;
  mentor_id:     string;
  mentor_name:   string;
  makeup_date:   string; // "YYYY-MM-DD"
  slot:          number;
  original_date: string | null;
  status:        "대기" | "진행중" | "완료" | "취소";
}

interface Props {
  schedules:  ScheduleItem[];
  overrides:  ScheduleOverride[];
  makeups:    MakeupSession[];
  mentors:    { id: string; full_name: string }[];
  /** 서버에서 전달한 ISO 시각 문자열 — 초기 렌더링 시 skeleton 방지용 */
  serverDate: string;
}

// ── 내부 타입 ─────────────────────────────────────────────

type PopupRegularItem = ScheduleItem & {
  type:         "regular";
  is_cancelled: boolean;
};

type PopupMakeupItem = MakeupSession & {
  type: "makeup";
};

type PopupItem = PopupRegularItem | PopupMakeupItem;

interface MakeupFormData {
  date:         string;  // "YYYY-MM-DD"
  slot:         number;
  mentorId:     string;
  changeMentor: boolean;
}

// ── 상태 계산 ─────────────────────────────────────────────

type SlotStatus = "대기" | "진행중" | "완료" | "취소";

function calcStatus(slot: number, now: Date): Exclude<SlotStatus, "취소"> {
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
  "완료":   "bg-blue-50 text-blue-400",
  "취소":   "bg-red-100 text-red-500",
};

// ── 날짜 유틸 ────────────────────────────────────────────

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 기준 날짜 기준 이번 주(offset=0) 또는 다음 주(offset=1) 월~토 Date 배열 */
function getWeekDates(base: Date, offset: 0 | 1): Date[] {
  const dow = base.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(base);
  monday.setDate(base.getDate() - daysFromMon + offset * 7);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatMMDD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDayKo(d: Date): string {
  return ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function DashboardSchedule({ schedules, overrides, makeups, mentors, serverDate }: Props) {
  const router = useRouter();

  // serverDate(서버 시각)로 즉시 초기화 → 첫 렌더부터 캘린더 표시
  const [now,           setNow]           = useState<Date>(() => new Date(serverDate));
  const [popup,         setPopup]         = useState<{ date: Date; slot: number } | null>(null);
  const [loadingKey,      setLoadingKey]      = useState<string | null>(null);
  const [makeupForms,     setMakeupForms]     = useState<Record<string, MakeupFormData>>({});
  const [submittingKey,   setSubmittingKey]   = useState<string | null>(null);
  // 보강 수정/삭제 전용 상태 (key = makeup.id)
  const [editMakeupForms, setEditMakeupForms] = useState<Record<string, MakeupFormData>>({});
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [updatingId,      setUpdatingId]      = useState<string | null>(null);
  // Optimistic update — 서버 응답 전에 UI 즉시 반영 (key: "studentId-date-slot")
  const [optimisticCancels, setOptimisticCancels] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 클라이언트 실제 시각으로 보정 (서버/클라이언트 시차 최소화)
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setPopup(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // ── 데이터 계산 ─────────────────────────────────────────

  /** Optimistic 상태와 서버 props를 합산한 최종 취소 여부 */
  function isCancelled(studentId: string, dateStr: string, slot: number): boolean {
    const key = `${studentId}-${dateStr}-${slot}`;
    if (key in optimisticCancels) return optimisticCancels[key];
    return overrides.some(
      (o) => o.student_id === studentId && o.session_date === dateStr && o.slot === slot
    );
  }

  function getRegularItems(date: Date, slot: number): PopupRegularItem[] {
    const dayKey = DAY_INDEX_MAP[date.getDay()];
    if (!dayKey) return [];
    const dateStr = toISODate(date);
    return schedules
      .filter((s) => s.day_of_week === dayKey && s.slot === slot)
      .map((s) => ({
        type:         "regular" as const,
        ...s,
        is_cancelled: isCancelled(s.student_id, dateStr, slot),
      }));
  }

  function getMakeupItems(date: Date, slot: number): PopupMakeupItem[] {
    const dateStr = toISODate(date);
    return makeups
      .filter((m) => m.makeup_date === dateStr && m.slot === slot)
      .map((m) => ({ type: "makeup" as const, ...m }));
  }

  function getActiveCount(date: Date, slot: number): number {
    const reg = getRegularItems(date, slot).filter((i) => !i.is_cancelled).length;
    const mu  = getMakeupItems(date, slot).filter((i) => i.status !== "취소").length;
    return reg + mu;
  }

  function getTotalCount(date: Date, slot: number): number {
    return getRegularItems(date, slot).length + getMakeupItems(date, slot).length;
  }

  // ── 이벤트 핸들러 ────────────────────────────────────────

  async function handleToggleCancel(studentId: string, dateStr: string, slot: number) {
    const optKey    = `${studentId}-${dateStr}-${slot}`;
    const loadKey   = `cancel-${optKey}`;
    const wasCancelled = isCancelled(studentId, dateStr, slot);

    // ① 즉시 UI 반영 (Optimistic)
    setOptimisticCancels((prev) => ({ ...prev, [optKey]: !wasCancelled }));
    setLoadingKey(loadKey);

    try {
      await toggleCancelSession(studentId, dateStr, slot);
      router.refresh();
    } catch {
      // 실패 시 롤백
      setOptimisticCancels((prev) => ({ ...prev, [optKey]: wasCancelled }));
    } finally {
      setLoadingKey(null);
      // 서버 동기화 완료 → optimistic 항목 제거 (props가 최신값 반영)
      setOptimisticCancels((prev) => { const n = { ...prev }; delete n[optKey]; return n; });
    }
  }

  function openMakeupForm(studentId: string, defaultMentorId: string, defaultSlot: number) {
    setMakeupForms((prev) => ({
      ...prev,
      [studentId]: {
        date:         tomorrowISO(),
        slot:         defaultSlot,
        mentorId:     defaultMentorId,
        changeMentor: false,
      },
    }));
  }

  function closeMakeupForm(studentId: string) {
    setMakeupForms((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  }

  function updateMakeupForm(studentId: string, patch: Partial<MakeupFormData>) {
    setMakeupForms((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], ...patch },
    }));
  }

  async function handleAddMakeup(studentId: string) {
    const form = makeupForms[studentId];
    if (!form?.date) return;
    const key = `makeup-${studentId}`;
    setSubmittingKey(key);
    try {
      await addMakeupSession(
        studentId,
        form.mentorId,
        form.date,
        form.slot,
        popup ? toISODate(popup.date) : (todayDateStr || undefined)
      );
      closeMakeupForm(studentId);
      router.refresh();
    } finally {
      setSubmittingKey(null);
    }
  }

  // ── 보강 수정/삭제 핸들러 ───────────────────────────────

  function openEditMakeupForm(mu: PopupMakeupItem) {
    setEditMakeupForms((prev) => ({
      ...prev,
      [mu.id]: { date: mu.makeup_date, slot: mu.slot, mentorId: mu.mentor_id, changeMentor: false },
    }));
  }

  function closeEditMakeupForm(makeupId: string) {
    setEditMakeupForms((prev) => { const n = { ...prev }; delete n[makeupId]; return n; });
  }

  function patchEditMakeupForm(makeupId: string, patch: Partial<MakeupFormData>) {
    setEditMakeupForms((prev) => ({ ...prev, [makeupId]: { ...prev[makeupId], ...patch } }));
  }

  async function handleDeleteMakeup(makeupId: string) {
    setDeletingId(makeupId);
    try {
      await deleteMakeupSession(makeupId);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpdateMakeup(makeupId: string) {
    const form = editMakeupForms[makeupId];
    if (!form?.date) return;
    setUpdatingId(makeupId);
    try {
      await updateMakeupSession(makeupId, {
        makeup_date: form.date,
        slot: form.slot,
        mentor_id: form.mentorId,
      });
      closeEditMakeupForm(makeupId);
      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  // ── 렌더 헬퍼 ───────────────────────────────────────────

  // now는 항상 Date (serverDate로 초기화) → null 체크 불필요
  const todayDateStr = toISODate(now);
  const todayDayKey  = DAY_INDEX_MAP[now.getDay()]; // DayOfWeek | null (일요일=null)

  const todayItems = schedules
    .filter((s) => s.day_of_week === todayDayKey)
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({
      ...s,
      is_cancelled: isCancelled(s.student_id, todayDateStr, s.slot),
    }));

  const todayLabel = now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });

  // 팝업 데이터
  const popupItems: PopupItem[] = popup
    ? [...getRegularItems(popup.date, popup.slot), ...getMakeupItems(popup.date, popup.slot)]
    : [];

  const popupDateStr = popup ? toISODate(popup.date) : "";
  const popupLabel   = popup
    ? `${formatMMDD(popup.date)}(${formatDayKo(popup.date)}) ${popup.slot}교시`
    : "";

  // ── 캘린더 주 섹션 렌더 ─────────────────────────────────

  function renderWeekTable(weekDates: Date[], weekLabel: string) {
    const rangeLabel = weekDates.length >= 6
      ? `${formatMMDD(weekDates[0])} ~ ${formatMMDD(weekDates[5])}`
      : "";

    return (
      <div key={weekLabel}>
        {/* 주 레이블 */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-xs font-bold text-gray-700">{weekLabel}</span>
          <span className="text-[11px] text-gray-400">{rangeLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-100 bg-gray-50 px-2 py-2 text-[10px] font-semibold text-gray-400 text-left w-20">
                  교시
                </th>
                {weekDates.map((d) => {
                  const isToday = now && toISODate(d) === todayDateStr;
                  return (
                    <th
                      key={toISODate(d)}
                      className={`border border-gray-100 px-2 py-2 text-center min-w-[56px] ${
                        isToday ? "bg-blue-50" : "bg-gray-50"
                      }`}
                    >
                      <p className={`text-xs font-bold ${isToday ? "text-blue-700" : "text-gray-700"}`}>
                        {formatMMDD(d)}
                      </p>
                      <p className={`text-[10px] ${isToday ? "text-blue-400" : "text-gray-400"}`}>
                        ({formatDayKo(d)})
                        {isToday && <span className="ml-0.5 text-[8px] font-semibold text-blue-400">TODAY</span>}
                      </p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(({ slot, startTime, endTime }) => (
                <tr key={slot}>
                  <td className="border border-gray-100 px-2 py-2.5 bg-gray-50/60">
                    <p className="font-semibold text-gray-800 text-[11px]">{slot}교시</p>
                    <p className="text-gray-400 text-[9px] mt-0.5">{startTime}–{endTime}</p>
                  </td>
                  {weekDates.map((d) => {
                    const total  = getTotalCount(d, slot);
                    const active = getActiveCount(d, slot);
                    const isToday = now && toISODate(d) === todayDateStr;
                    const hasCancelled = total > active;

                    return (
                      <td
                        key={toISODate(d)}
                        className={`border border-gray-100 text-center transition-colors ${
                          active > 0
                            ? isToday
                              ? "bg-blue-50 hover:bg-blue-100 cursor-pointer"
                              : "bg-emerald-50/60 hover:bg-emerald-100/60 cursor-pointer"
                            : total > 0
                            ? "bg-red-50/40 hover:bg-red-50 cursor-pointer"
                            : isToday
                            ? "bg-blue-50/20"
                            : "hover:bg-gray-50/80"
                        }`}
                        onClick={() => total > 0 && setPopup({ date: d, slot })}
                      >
                        {active > 0 ? (
                          <div className="py-2 flex flex-col items-center gap-0.5">
                            <span className={`text-sm font-bold ${isToday ? "text-blue-700" : "text-emerald-700"}`}>
                              {active}
                            </span>
                            <span className="text-[9px] text-gray-400">명</span>
                            {hasCancelled && (
                              <span className="text-[8px] text-red-400">+{total - active}취소</span>
                            )}
                          </div>
                        ) : total > 0 ? (
                          <div className="py-2 flex flex-col items-center gap-0.5">
                            <span className="text-xs font-semibold text-red-400">{total}</span>
                            <span className="text-[9px] text-red-300">전취소</span>
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
      </div>
    );
  }

  // ── 팝업 아이템 렌더 ─────────────────────────────────────

  function renderPopupItem(item: PopupItem, idx: number) {
    const isRegular       = item.type === "regular";
    const isCancelLoading = loadingKey === `cancel-${item.student_id}-${popupDateStr}-${item.slot}`;
    const isMakeupSubmitting = submittingKey === `makeup-${item.student_id}`;
    const hasMakeupForm   = !!makeupForms[item.student_id];
    const addForm         = makeupForms[item.student_id];

    // 보강 아이템 전용
    const makeupId        = !isRegular ? (item as PopupMakeupItem).id : "";
    const hasEditForm     = !isRegular && !!editMakeupForms[makeupId];
    const editForm        = !isRegular ? editMakeupForms[makeupId] : undefined;
    const isDeleting      = deletingId === makeupId;
    const isUpdating      = updatingId === makeupId;

    return (
      <li key={`${item.type}-${item.student_id}-${idx}`} className="px-5 py-3 border-b border-gray-50 last:border-0">

        {/* ── 학생 정보 + 액션 버튼 행 ── */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300 w-5 shrink-0">{idx + 1}</span>

          {/* 학생 이름 / 멘토 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              {item.student_seat && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 shrink-0">
                  {item.student_seat}
                </span>
              )}
              {item.student_name}
              {!isRegular && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-600">
                  보강
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400">{item.mentor_name} 멘토</p>
          </div>

          {/* ── 일반 수업: 대기/취소 토글 + 보강 버튼 ── */}
          {isRegular && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 대기 ↔ 취소됨 토글 */}
              <button
                disabled={isCancelLoading}
                onClick={() => handleToggleCancel(item.student_id, popupDateStr, item.slot)}
                title={(item as PopupRegularItem).is_cancelled ? "클릭하여 취소 해제" : "클릭하여 취소 처리"}
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                  (item as PopupRegularItem).is_cancelled
                    ? "border-red-200 bg-red-100 text-red-600 hover:bg-red-200"
                    : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                }`}
              >
                {isCancelLoading ? "…" : (item as PopupRegularItem).is_cancelled ? "취소됨" : "대기"}
              </button>

              {/* 보강 신청 */}
              <button
                onClick={() =>
                  hasMakeupForm
                    ? closeMakeupForm(item.student_id)
                    : openMakeupForm(item.student_id, item.mentor_id, item.slot)
                }
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                  hasMakeupForm
                    ? "border-indigo-300 bg-indigo-100 text-indigo-700"
                    : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                }`}
              >
                보강
              </button>
            </div>
          )}

          {/* ── 보강 수업: 수정(연필) + 삭제(휴지통) ── */}
          {!isRegular && (
            <div className="flex items-center gap-1 shrink-0">
              {/* 수정 버튼 */}
              <button
                onClick={() =>
                  hasEditForm
                    ? closeEditMakeupForm(makeupId)
                    : openEditMakeupForm(item as PopupMakeupItem)
                }
                title="보강 일정 수정"
                className={`p-1.5 rounded-lg border transition-colors ${
                  hasEditForm
                    ? "border-indigo-300 bg-indigo-100 text-indigo-700"
                    : "border-gray-200 text-gray-400 hover:border-indigo-200 hover:text-indigo-500 hover:bg-indigo-50"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
                </svg>
              </button>

              {/* 삭제 버튼 */}
              <button
                disabled={isDeleting}
                onClick={() => handleDeleteMakeup(makeupId)}
                title="보강 일정 삭제"
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <span className="text-[9px]">…</span>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1m-7 0H5m14 0h-2" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── 보강 신청 인라인 폼 (일반 수업용) ── */}
        {isRegular && hasMakeupForm && addForm && (
          <MakeupInlineForm
            title="보강 일정 등록"
            form={addForm}
            mentors={mentors}
            defaultMentorName={item.mentor_name}
            isSubmitting={isMakeupSubmitting}
            onPatch={(patch) => updateMakeupForm(item.student_id, patch)}
            onCancel={() => closeMakeupForm(item.student_id)}
            onSubmit={() => handleAddMakeup(item.student_id)}
            submitLabel="보강 등록"
          />
        )}

        {/* ── 보강 수정 인라인 폼 (보강 아이템용) ── */}
        {!isRegular && hasEditForm && editForm && (
          <MakeupInlineForm
            title="보강 일정 수정"
            form={editForm}
            mentors={mentors}
            defaultMentorName={item.mentor_name}
            isSubmitting={isUpdating}
            onPatch={(patch) => patchEditMakeupForm(makeupId, patch)}
            onCancel={() => closeEditMakeupForm(makeupId)}
            onSubmit={() => handleUpdateMakeup(makeupId)}
            submitLabel="저장"
          />
        )}
      </li>
    );
  }

  // ── 최종 렌더 ────────────────────────────────────────────

  // now는 항상 Date → 바로 계산
  const week1 = getWeekDates(now, 0);
  const week2 = getWeekDates(now, 1);

  return (
    <section className="mt-12">
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          실시간 PT 일정 현황
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── 왼쪽: 오늘의 PT 일정 ─────────────────────────── */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">📅 오늘의 PT 일정</h3>
              <p className="text-xs text-gray-400 mt-0.5">{todayLabel}</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {todayDayKey === null ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">오늘(일요일)은 PT 일정이 없습니다.</p>
                </div>
              ) : todayItems.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <svg className="w-8 h-8 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-400">오늘 예정된 PT 일정이 없습니다.</p>
                </div>
              ) : (
                todayItems.map((item) => {
                  const slotDef         = SLOTS[item.slot - 1];
                  const isCancelLoading = loadingKey === `cancel-${item.student_id}-${todayDateStr}-${item.slot}`;
                  const isMakeupSubmit  = submittingKey === `makeup-${item.student_id}`;
                  const hasMakeupForm   = !!makeupForms[item.student_id];
                  const addForm         = makeupForms[item.student_id];

                  return (
                    <div key={`${item.student_id}-${item.slot}`} className="border-b border-gray-50 last:border-0">
                      {/* ── 메인 행 ── */}
                      <div className="px-4 py-3 flex items-center gap-2">
                        {/* 교시 */}
                        <div className="shrink-0 w-12 text-center">
                          <p className="text-xs font-bold text-gray-700">{item.slot}교시</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{slotDef.startTime}</p>
                        </div>
                        <div className="w-px h-8 bg-gray-100 shrink-0" />
                        {/* 이름 / 멘토 */}
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
                        {/* 액션 버튼 */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* 대기 ↔ 취소됨 토글 */}
                          <button
                            disabled={isCancelLoading}
                            onClick={() => handleToggleCancel(item.student_id, todayDateStr, item.slot)}
                            title={item.is_cancelled ? "클릭하여 취소 해제" : "클릭하여 취소 처리"}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                              item.is_cancelled
                                ? "border-red-200 bg-red-100 text-red-600 hover:bg-red-200"
                                : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                            }`}
                          >
                            {isCancelLoading ? "…" : item.is_cancelled ? "취소됨" : "대기"}
                          </button>
                          {/* 보강 */}
                          <button
                            onClick={() =>
                              hasMakeupForm
                                ? closeMakeupForm(item.student_id)
                                : openMakeupForm(item.student_id, item.mentor_id, item.slot)
                            }
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                              hasMakeupForm
                                ? "border-indigo-300 bg-indigo-100 text-indigo-700"
                                : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                            }`}
                          >
                            보강
                          </button>
                        </div>
                      </div>
                      {/* ── 보강 폼 ── */}
                      {hasMakeupForm && addForm && (
                        <div className="px-4 pb-3">
                          <MakeupInlineForm
                            title="보강 일정 등록"
                            form={addForm}
                            mentors={mentors}
                            defaultMentorName={item.mentor_name}
                            isSubmitting={isMakeupSubmit}
                            onPatch={(patch) => updateMakeupForm(item.student_id, patch)}
                            onCancel={() => closeMakeupForm(item.student_id)}
                            onSubmit={() => handleAddMakeup(item.student_id)}
                            submitLabel="보강 등록"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {todayItems.length > 0 && (
              <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/40">
                <p className="text-[11px] text-gray-400 text-center">
                  총 {todayItems.length}건 · 1분마다 상태 갱신
                </p>
              </div>
            )}
          </div>

          {/* ── 오른쪽: 2주 캘린더 ──────────────────────────── */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">📊 2주 PT 캘린더</h3>
                <p className="text-xs text-gray-400 mt-0.5">날짜 칸을 클릭하면 배정 명단과 관리 옵션을 볼 수 있습니다</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap justify-end">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />오늘
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />배정
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />전취소
                </span>
              </div>
            </div>

            <div className="p-4 space-y-5 overflow-y-auto max-h-[480px]">
              {renderWeekTable(week1, "이번 주")}
              <div className="border-t border-dashed border-gray-200" />
              {renderWeekTable(week2, "다음 주")}
            </div>

            <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/40 flex items-center gap-4">
              <p className="text-[11px] text-gray-400">
                전체 배정: <span className="font-bold text-gray-600">{schedules.length}명</span>
              </p>
              <p className="text-[11px] text-gray-400">
                오늘 배정: <span className="font-bold text-gray-600">{todayItems.length}명</span>
              </p>
              {makeups.length > 0 && (
                <p className="text-[11px] text-gray-400">
                  보강 예정: <span className="font-bold text-indigo-600">{makeups.filter(m => m.status !== "취소").length}건</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 팝업 모달 ────────────────────────────────────────── */}
      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPopup(null); }}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={() => setPopup(null)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {popupLabel} 배정 명단
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {SLOTS[popup.slot - 1].startTime}–{SLOTS[popup.slot - 1].endTime}
                  {" · "}
                  활성 {popupItems.filter(i => i.type === "regular" ? !i.is_cancelled : i.status !== "취소").length}명
                  {popupItems.length > 0 && ` / 전체 ${popupItems.length}명`}
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

            {/* 안내 */}
            <div className="px-5 py-2 bg-gray-50/60 border-b border-gray-100">
              <p className="text-[10px] text-gray-400">
                <span className="font-semibold text-slate-500">상태 버튼</span>: 클릭 시 수업 취소 처리 (토글)
                &nbsp;·&nbsp;
                <span className="font-semibold text-indigo-500">보강</span> 버튼: 보강 일정 등록
              </p>
            </div>

            {/* 명단 */}
            <ul className="max-h-96 overflow-y-auto">
              {popupItems.length === 0 ? (
                <li className="px-5 py-8 text-center text-sm text-gray-400">
                  배정된 학생이 없습니다.
                </li>
              ) : (
                popupItems.map((item, idx) => renderPopupItem(item, idx))
              )}
            </ul>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-[11px] text-gray-400 text-center">
                Esc 또는 바깥 영역 클릭으로 닫기
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── 보강 인라인 폼 (등록/수정 공용) ─────────────────────────

interface MakeupInlineFormProps {
  title:             string;
  form:              MakeupFormData;
  mentors:           { id: string; full_name: string }[];
  defaultMentorName: string;
  isSubmitting:      boolean;
  onPatch:           (patch: Partial<MakeupFormData>) => void;
  onCancel:          () => void;
  onSubmit:          () => void;
  submitLabel:       string;
}

function MakeupInlineForm({
  title, form, mentors, defaultMentorName,
  isSubmitting, onPatch, onCancel, onSubmit, submitLabel,
}: MakeupInlineFormProps) {
  return (
    <div className="mt-2.5 ml-8 p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-2.5">
      <p className="text-xs font-bold text-indigo-700">{title}</p>

      {/* 날짜 */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-gray-500 w-8 shrink-0">날짜</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => onPatch({ date: e.target.value })}
          className="flex-1 text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
        />
      </div>

      {/* 교시 */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-gray-500 w-8 shrink-0">교시</label>
        <div className="flex gap-1">
          {SLOTS.map(({ slot: s }) => (
            <button
              key={s}
              onClick={() => onPatch({ slot: s })}
              className={`text-[11px] w-8 py-1 rounded-lg transition-colors ${
                form.slot === s
                  ? "bg-indigo-600 text-white font-bold"
                  : "bg-white border border-indigo-200 text-gray-600 hover:bg-indigo-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 멘토 */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-gray-500 w-8 shrink-0">멘토</label>
        {form.changeMentor ? (
          <select
            value={form.mentorId}
            onChange={(e) => onPatch({ mentorId: e.target.value })}
            className="flex-1 text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        ) : (
          <span className="flex-1 text-xs text-gray-700">
            {mentors.find((m) => m.id === form.mentorId)?.full_name ?? defaultMentorName} 멘토
          </span>
        )}
        <button
          onClick={() => onPatch({ changeMentor: !form.changeMentor })}
          className="text-[10px] text-indigo-500 underline hover:text-indigo-700 shrink-0"
        >
          {form.changeMentor ? "원래 멘토로" : "멘토 변경"}
        </button>
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-end gap-2 pt-0.5">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          닫기
        </button>
        <button
          disabled={!form.date || isSubmitting}
          onClick={onSubmit}
          className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {isSubmitting ? "처리 중…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
