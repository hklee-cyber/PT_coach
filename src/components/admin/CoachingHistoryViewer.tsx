"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CoachingContent, SubjectContent, InquirySubjectContent } from "@/types/database";
import { deleteCoachingRecord, updateCoachingRecord } from "@/app/actions/coaching-record";

// ── 타입 ──────────────────────────────────────────────────────
interface HistoryRecord {
  id: string;
  date: string;
  content: CoachingContent;
}

interface Props {
  records: HistoryRecord[];
  studentName: string;
  studentId: string;
}

// ── 행/그룹 정의 ──────────────────────────────────────────────
type FieldKey = keyof SubjectContent;

interface RowDef {
  field: FieldKey;
  label: string;
  group: string;
  groupRows: number;
  isGroupFirst: boolean;
  groupColor: string;
  rowColor: string;
}

const ROWS: RowDef[] = [
  { field: "grade_goal",     label: "등급목표",               group: "학습 전략",          groupRows: 4, isGroupFirst: true,  groupColor: "bg-blue-100",    rowColor: "bg-blue-50/70"    },
  { field: "materials",      label: "교재/인강/현강",          group: "학습 전략",          groupRows: 4, isGroupFirst: false, groupColor: "bg-blue-100",    rowColor: "bg-blue-50/70"    },
  { field: "study_strategy", label: "과목별\n공부전략",        group: "학습 전략",          groupRows: 4, isGroupFirst: false, groupColor: "bg-blue-100",    rowColor: "bg-blue-50/70"    },
  { field: "planner_check",  label: "플래너 체크\n(순공시간)", group: "학습 전략",          groupRows: 4, isGroupFirst: false, groupColor: "bg-blue-100",    rowColor: "bg-blue-50/70"    },
  { field: "last_progress",  label: "지난주\n학습진도",        group: "Review &\nFeedback", groupRows: 3, isGroupFirst: true,  groupColor: "bg-emerald-100", rowColor: "bg-emerald-50/70" },
  { field: "review_habits",  label: "복습&습관",               group: "Review &\nFeedback", groupRows: 3, isGroupFirst: false, groupColor: "bg-emerald-100", rowColor: "bg-emerald-50/70" },
  { field: "self_check",     label: "자기점검\n(Test)",        group: "Review &\nFeedback", groupRows: 3, isGroupFirst: false, groupColor: "bg-emerald-100", rowColor: "bg-emerald-50/70" },
  { field: "next_plan",      label: "다음 주 계획",            group: "Action\nPlan",       groupRows: 2, isGroupFirst: true,  groupColor: "bg-orange-100",  rowColor: "bg-orange-50/70"  },
  { field: "focus_training", label: "집중훈련",                group: "Action\nPlan",       groupRows: 2, isGroupFirst: false, groupColor: "bg-orange-100",  rowColor: "bg-orange-50/70"  },
];

type SubjectKey = "korean" | "math" | "english" | "inquiry1" | "inquiry2";

const FIXED_SUBJECTS: { key: SubjectKey; label: string }[] = [
  { key: "korean",  label: "국어" },
  { key: "math",    label: "수학" },
  { key: "english", label: "영어" },
];

// ── 편집 가능 테이블 ──────────────────────────────────────────
function EditableTable({
  content,
  onChange,
}: {
  content: CoachingContent;
  onChange: (updated: CoachingContent) => void;
}) {
  const inquiry1Name = (content.inquiry1 as InquirySubjectContent).subject_name;
  const inquiry2Name = (content.inquiry2 as InquirySubjectContent).subject_name;

  const subjects: { key: SubjectKey; label: string }[] = [
    ...FIXED_SUBJECTS,
    { key: "inquiry1", label: inquiry1Name ? `탐구1\n(${inquiry1Name})` : "탐구 1" },
    { key: "inquiry2", label: inquiry2Name ? `탐구2\n(${inquiry2Name})` : "탐구 2" },
  ];

  function setCell(subjectKey: SubjectKey, field: FieldKey | "subject_name", value: string) {
    const updated: CoachingContent = {
      ...content,
      [subjectKey]: {
        ...(content[subjectKey] as SubjectContent),
        [field]: value,
      },
    };
    onChange(updated);
  }

  function setMeta(field: "admission_type" | "grade", value: string) {
    onChange({ ...content, [field]: value });
  }

  return (
    <div className="space-y-3">
      {/* 메타 정보 */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">입시 유형</label>
          <select
            value={content.admission_type}
            onChange={(e) => setMeta("admission_type", e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          >
            <option value="">선택</option>
            <option value="정시">정시</option>
            <option value="수시">수시</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">성적</label>
          <input
            type="text"
            value={content.grade}
            onChange={(e) => setMeta("grade", e.target.value)}
            placeholder="예: 2~3등급"
            className="text-xs border border-gray-200 rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* 탐구 과목명 입력 */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">탐구1 과목명</label>
          <input
            type="text"
            value={(content.inquiry1 as InquirySubjectContent).subject_name}
            onChange={(e) => setCell("inquiry1", "subject_name", e.target.value)}
            placeholder="예: 생윤"
            className="text-xs border border-gray-200 rounded px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">탐구2 과목명</label>
          <input
            type="text"
            value={(content.inquiry2 as InquirySubjectContent).subject_name}
            onChange={(e) => setCell("inquiry2", "subject_name", e.target.value)}
            placeholder="예: 사문"
            className="text-xs border border-gray-200 rounded px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* 편집 가능 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "68px" }} />
            <col style={{ width: "84px" }} />
            <col /><col /><col /><col /><col />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="border border-gray-200 px-2 py-2.5 text-center text-xs font-bold text-gray-500">구분</th>
              <th className="border border-gray-200 px-2 py-2.5 text-center text-xs font-bold text-gray-500">항목</th>
              {subjects.map((s) => (
                <th key={s.key} className="border border-gray-200 px-2 py-2.5 text-center text-xs font-bold text-gray-800 whitespace-pre-line">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.field} className="align-top">
                {row.isGroupFirst && (
                  <td
                    rowSpan={row.groupRows}
                    className={`border border-gray-200 px-2 py-2 text-center text-xs font-bold text-gray-700 whitespace-pre-line align-middle ${row.groupColor}`}
                  >
                    {row.group}
                  </td>
                )}
                <td className={`border border-gray-200 px-2 py-2 text-xs font-medium text-gray-700 whitespace-pre-line align-middle ${row.rowColor}`}>
                  {row.label}
                </td>
                {subjects.map((s) => {
                  const val = ((content[s.key] as SubjectContent)[row.field] as string) ?? "";
                  return (
                    <td key={s.key} className="border border-gray-200 p-1 align-top">
                      <textarea
                        value={val}
                        onChange={(e) => setCell(s.key, row.field, e.target.value)}
                        rows={3}
                        className="w-full text-xs text-gray-800 leading-relaxed resize-none rounded border border-transparent focus:border-blue-300 focus:ring-1 focus:ring-blue-200 focus:outline-none px-1.5 py-1 bg-white/60 hover:bg-white transition placeholder:text-gray-300"
                        placeholder="—"
                      />
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

// ── 토스트 ────────────────────────────────────────────────────
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-lg">
      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function CoachingHistoryViewer({ records: initialRecords, studentName, studentId }: Props) {
  const router = useRouter();
  const [localRecords, setLocalRecords] = useState(initialRecords);
  const [showList,     setShowList]     = useState(false);
  const [editRecord,   setEditRecord]   = useState<HistoryRecord | null>(null);
  const [editContent,  setEditContent]  = useState<CoachingContent | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);

  const count = localRecords.length;

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }

  function handleOpenEdit(rec: HistoryRecord) {
    setEditRecord(rec);
    setEditContent(JSON.parse(JSON.stringify(rec.content)) as CoachingContent);
  }

  function handleBackToList() {
    setEditRecord(null);
    setEditContent(null);
  }

  async function handleSave() {
    if (!editRecord || !editContent) return;
    setSaving(true);
    try {
      await updateCoachingRecord(editRecord.id, editContent, studentId);
      setLocalRecords((prev) =>
        prev.map((r) => (r.id === editRecord.id ? { ...r, content: editContent } : r))
      );
      router.refresh();
      showToast("저장되었습니다.");
      handleBackToList();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 코칭 기록을 삭제하시겠습니까?")) return;
    setDeletingId(id);
    try {
      await deleteCoachingRecord(id, studentId);
      setLocalRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  if (count === 0) {
    return (
      <div className="flex items-center gap-3">
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-md text-sm font-semibold cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          PT 코칭 기록 없음
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 트리거 버튼 */}
      <div>
        <button
          onClick={() => {
            setShowList((v) => !v);
            if (showList) handleBackToList();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition ${
            showList
              ? "bg-blue-700 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          PT 코칭 기록 보기
          <span className="ml-0.5 text-blue-200 font-normal">({count}회차)</span>
          <svg
            className={`w-3.5 h-3.5 ml-0.5 transition-transform ${showList ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showList && (
          <div className="mt-3 bg-white rounded-2xl border border-gray-200 overflow-hidden">

            {/* ── 편집 화면 ── */}
            {editRecord && editContent ? (
              <>
                {/* 편집 헤더 */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBackToList}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition px-2.5 py-1.5 rounded-lg hover:bg-gray-100"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      목록으로
                    </button>
                    <div className="w-px h-4 bg-gray-200" />
                    <div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 mr-2">
                        {count - localRecords.findIndex((r) => r.id === editRecord.id)}회차
                      </span>
                      <span className="text-sm font-bold text-gray-800">{editRecord.date} 코칭 기록 편집</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">학생: {studentName}</p>
                </div>

                {/* 편집 폼 */}
                <div className="p-5">
                  <EditableTable content={editContent} onChange={setEditContent} />
                </div>

                {/* 저장 버튼 */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/60">
                  <button
                    onClick={handleBackToList}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        저장 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        수정 완료 및 저장
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* ── 목록 화면 ── */
              <>
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    코칭 기록 목록 · 총 {count}회차
                  </p>
                  <p className="text-xs text-gray-400">회차 클릭 시 편집</p>
                </div>

                <ul className="divide-y divide-gray-50">
                  {localRecords.map((rec, idx) => {
                    const roundNo = count - idx;
                    const inquiry1 = (rec.content.inquiry1 as InquirySubjectContent).subject_name;
                    const inquiry2 = (rec.content.inquiry2 as InquirySubjectContent).subject_name;

                    return (
                      <li
                        key={rec.id}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50/40 transition cursor-pointer group"
                        onClick={() => handleOpenEdit(rec)}
                      >
                        {/* 회차 */}
                        <span className="text-xs font-bold text-gray-400 w-8 shrink-0">{roundNo}회</span>

                        {/* 날짜 */}
                        <span className="text-sm font-semibold text-blue-600 group-hover:underline underline-offset-2 shrink-0">
                          {rec.date}
                        </span>

                        {/* 배지들 */}
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {rec.content.admission_type && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                              {rec.content.admission_type}
                            </span>
                          )}
                          {rec.content.grade && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {rec.content.grade}
                            </span>
                          )}
                          {inquiry1 && (
                            <span className="text-[11px] text-gray-400">탐구1: {inquiry1}</span>
                          )}
                          {inquiry2 && (
                            <span className="text-[11px] text-gray-400">탐구2: {inquiry2}</span>
                          )}
                        </div>

                        {/* 편집 / 삭제 */}
                        <div className="ml-auto shrink-0 flex items-center gap-2">
                          <span className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:text-blue-600 transition">
                            편집
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(rec.id); }}
                            disabled={deletingId === rec.id}
                            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                            title="기록 삭제"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toastMsg && <Toast message={toastMsg} />}
    </>
  );
}
