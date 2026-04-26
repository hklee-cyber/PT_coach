"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, ShadingType,
  HeadingLevel, VerticalAlign,
} from "docx";
import { importWordFile, getCoachingRecordsForExport } from "@/app/actions/word-import";
import { deleteCoachingRecord, updateCoachingRecord } from "@/app/actions/coaching-record";
import type { CoachingContent, SubjectContent, InquirySubjectContent } from "@/types/database";

// ── 타입 ──────────────────────────────────────────────────────
interface HistoryRecord {
  id: string;
  date: string;
  content: CoachingContent;
}

interface Props {
  records: HistoryRecord[];
  studentId: string;
  studentName: string;
  mentorId: string;
  mentorName: string;
  targetUniversity: string | null;
}

// ── 코칭 테이블 행 정의 ───────────────────────────────────────
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

// ── 읽기 전용 테이블 ──────────────────────────────────────────
function ReadOnlyTable({ content }: { content: CoachingContent }) {
  const inquiry1Name = (content.inquiry1 as InquirySubjectContent).subject_name;
  const inquiry2Name = (content.inquiry2 as InquirySubjectContent).subject_name;

  const subjects: { key: SubjectKey; label: string }[] = [
    ...FIXED_SUBJECTS,
    { key: "inquiry1", label: inquiry1Name ? `탐구1\n(${inquiry1Name})` : "탐구 1" },
    { key: "inquiry2", label: inquiry2Name ? `탐구2\n(${inquiry2Name})` : "탐구 2" },
  ];

  return (
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
                const val = ((content[s.key] as SubjectContent)[row.field] as string) || "";
                return (
                  <td key={s.key} className="border border-gray-200 px-2 py-2 align-top">
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[2rem]">
                      {val || <span className="text-gray-300">—</span>}
                    </p>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
    onChange({
      ...content,
      [subjectKey]: { ...(content[subjectKey] as SubjectContent), [field]: value },
    });
  }

  function setMeta(field: "admission_type" | "grade", value: string) {
    onChange({ ...content, [field]: value });
  }

  return (
    <div className="space-y-3">
      {/* 메타 정보 */}
      <div className="flex flex-wrap items-center gap-4 px-1">
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
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">탐구1 과목명</label>
          <input
            type="text"
            value={(content.inquiry1 as InquirySubjectContent).subject_name}
            onChange={(e) => setCell("inquiry1", "subject_name", e.target.value)}
            placeholder="예: 생윤"
            className="text-xs border border-gray-200 rounded px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">탐구2 과목명</label>
          <input
            type="text"
            value={(content.inquiry2 as InquirySubjectContent).subject_name}
            onChange={(e) => setCell("inquiry2", "subject_name", e.target.value)}
            placeholder="예: 사문"
            className="text-xs border border-gray-200 rounded px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* 편집 테이블 */}
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

// ── 상세 모달 ─────────────────────────────────────────────────
function DetailModal({
  record, index, total, studentName, onClose, onPrev, onNext, onSave,
}: {
  record: HistoryRecord;
  index: number;
  total: number;
  studentName: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSave: (id: string, content: CoachingContent) => Promise<void>;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isEditing,   setIsEditing]   = useState(false);
  const [editContent, setEditContent] = useState<CoachingContent | null>(null);
  const [saving,      setSaving]      = useState(false);
  const roundNo = total - index;

  // 회차 전환 시 편집 모드 초기화
  useEffect(() => {
    setIsEditing(false);
    setEditContent(null);
  }, [record.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditing) return; // 편집 중엔 키보드 탐색 비활성
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  onNext();
      if (e.key === "ArrowRight") onPrev();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext, isEditing]);

  function startEdit() {
    setEditContent(JSON.parse(JSON.stringify(record.content)) as CoachingContent);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditContent(null);
  }

  async function handleSave() {
    if (!editContent) return;
    setSaving(true);
    try {
      await onSave(record.id, editContent);
      setIsEditing(false);
      setEditContent(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  const displayContent = isEditing && editContent ? editContent : record.content;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-start justify-center pt-10 px-4 pb-10"
      onClick={(e) => { if (e.target === overlayRef.current && !isEditing) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!isEditing) onClose(); }} />
      <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">

        {/* 헤더 */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 ${isEditing ? "bg-blue-50" : ""}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              {roundNo}회차
            </span>
            <div>
              <p className="font-bold text-gray-900 text-sm">
                {record.date} 코칭 기록
                {isEditing && <span className="ml-2 text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">편집 중</span>}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                학생: {studentName}
                {record.content.admission_type && (
                  <> · <span className="font-medium text-gray-600">{record.content.admission_type}</span></>
                )}
                {record.content.grade && (
                  <> · <span className="font-medium text-gray-600">{record.content.grade}</span></>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  수정하기
                </button>
                <div className="w-px h-4 bg-gray-200" />
                <button onClick={onNext} disabled={index >= total - 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition" title="이전 회차">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <span className="text-xs text-gray-400">{roundNo} / {total}</span>
                <button onClick={onPrev} disabled={index <= 0}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition" title="다음 회차">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto p-5">
          {isEditing && editContent ? (
            <EditableTable content={editContent} onChange={setEditContent} />
          ) : (
            <ReadOnlyTable content={displayContent} />
          )}
        </div>

        {/* 편집 모드 하단 버튼 */}
        {isEditing && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60 shrink-0">
            <button
              onClick={cancelEdit}
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  저장 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                  수정 완료 및 저장
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PT 코칭 기록 목록 모달 ────────────────────────────────────
function HistoryListModal({
  records: initialRecords, studentName, studentId, onClose,
}: {
  records: HistoryRecord[];
  studentName: string;
  studentId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [localRecords, setLocalRecords] = useState(initialRecords);
  const [detailIdx,    setDetailIdx]    = useState<number | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const total = localRecords.length;
  const overlayRef = useRef<HTMLDivElement>(null);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("이 코칭 기록을 삭제하시겠습니까?")) return;
    setDeletingId(id);
    try {
      await deleteCoachingRecord(id, studentId);
      setLocalRecords((prev) => prev.filter((r) => r.id !== id));
      setDetailIdx(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSave(id: string, content: CoachingContent) {
    await updateCoachingRecord(id, content, studentId);
    setLocalRecords((prev) => prev.map((r) => (r.id === id ? { ...r, content } : r)));
    router.refresh();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && detailIdx === null) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, detailIdx]);

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4 pb-10"
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[80vh]">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-gray-50">
            <div>
              <p className="font-bold text-gray-900">PT 코칭 기록</p>
              <p className="text-xs text-gray-400 mt-0.5">학생: {studentName} · 총 {total}회차</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* 목록 또는 빈 상태 */}
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="text-sm font-semibold text-gray-400">PT 코칭 기록이 존재하지 않습니다.</p>
              <p className="text-xs text-gray-300">코칭 기록을 추가하면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <ul className="overflow-y-auto divide-y divide-gray-50">
              {localRecords.map((rec, idx) => {
                const roundNo = total - idx;
                const inquiry1 = (rec.content.inquiry1 as InquirySubjectContent).subject_name;
                const inquiry2 = (rec.content.inquiry2 as InquirySubjectContent).subject_name;
                return (
                  <li key={rec.id}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition cursor-pointer"
                    onClick={() => setDetailIdx(idx)}
                  >
                    <span className="text-xs font-bold text-gray-300 w-8 shrink-0">{roundNo}회</span>
                    <span className="text-sm font-semibold text-blue-600">{rec.date}</span>
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
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
                      {inquiry1 && <span className="text-[11px] text-gray-400">탐구1: {inquiry1}</span>}
                      {inquiry2 && <span className="text-[11px] text-gray-400">탐구2: {inquiry2}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                      <button
                        onClick={(e) => handleDelete(e, rec.id)}
                        disabled={deletingId === rec.id}
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                        title="기록 삭제"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 상세 모달 (목록 모달 위) */}
      {detailIdx !== null && (
        <DetailModal
          record={localRecords[detailIdx]}
          index={detailIdx}
          total={total}
          studentName={studentName}
          onClose={() => setDetailIdx(null)}
          onPrev={() => setDetailIdx((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setDetailIdx((i) => Math.min(total - 1, (i ?? 0) + 1))}
          onSave={handleSave}
        />
      )}
    </>
  );
}

// ── Word 내보내기 헬퍼 ────────────────────────────────────────
const FIELD_ROWS_DOCX: { field: keyof SubjectContent; label: string; group: string }[] = [
  { field: "grade_goal",     label: "등급목표",               group: "학습 전략" },
  { field: "materials",      label: "교재/인강/현강",          group: "학습 전략" },
  { field: "study_strategy", label: "과목별 공부전략",         group: "학습 전략" },
  { field: "planner_check",  label: "플래너 체크(순공시간)",   group: "학습 전략" },
  { field: "last_progress",  label: "지난주 학습진도",         group: "Review & Feedback" },
  { field: "review_habits",  label: "복습&습관",               group: "Review & Feedback" },
  { field: "self_check",     label: "자기점검(Test)",          group: "Review & Feedback" },
  { field: "next_plan",      label: "다음 주 계획",            group: "Action Plan" },
  { field: "focus_training", label: "집중훈련",                group: "Action Plan" },
];

const DOCX_SUBJECTS = [
  { key: "korean",   label: "국어" },
  { key: "math",     label: "수학" },
  { key: "english",  label: "영어" },
  { key: "inquiry1", label: "탐구1" },
  { key: "inquiry2", label: "탐구2" },
] as const;

const GROUP_COLORS: Record<string, { group: string; row: string }> = {
  "학습 전략":          { group: "BDD7EE", row: "EBF3FB" },
  "Review & Feedback": { group: "C6EFCE", row: "EBF8EE" },
  "Action Plan":       { group: "FCE4D6", row: "FEF5F0" },
};

function hCell(text: string, bg = "D0E4FF") {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, font: "맑은 고딕" })], alignment: AlignmentType.CENTER })],
    shading: { type: ShadingType.CLEAR, fill: bg }, verticalAlign: VerticalAlign.CENTER,
    width: { size: 10, type: WidthType.PERCENTAGE },
  });
}
function dCell(text: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: text || "", size: 16, font: "맑은 고딕" })] })],
    verticalAlign: VerticalAlign.TOP, width: { size: 16, type: WidthType.PERCENTAGE },
  });
}
function lCell(text: string, bg: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 16, font: "맑은 고딕" })], alignment: AlignmentType.CENTER })],
    shading: { type: ShadingType.CLEAR, fill: bg }, verticalAlign: VerticalAlign.CENTER,
    width: { size: 11, type: WidthType.PERCENTAGE },
  });
}
function gCell(text: string, rowSpan: number, bg: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 17, font: "맑은 고딕" })], alignment: AlignmentType.CENTER })],
    shading: { type: ShadingType.CLEAR, fill: bg }, verticalAlign: VerticalAlign.CENTER,
    rowSpan, width: { size: 9, type: WidthType.PERCENTAGE },
  });
}

function buildRecordBlock(
  record: HistoryRecord, roundNo: number, total: number,
  studentName: string, mentorName: string, isFirst: boolean
): Paragraph[] {
  const { content, date } = record;
  const subjects = DOCX_SUBJECTS.map((s) => {
    if (s.key === "inquiry1") {
      const n = (content.inquiry1 as InquirySubjectContent).subject_name;
      return { ...s, label: n ? `탐구1(${n})` : "탐구1" };
    }
    if (s.key === "inquiry2") {
      const n = (content.inquiry2 as InquirySubjectContent).subject_name;
      return { ...s, label: n ? `탐구2(${n})` : "탐구2" };
    }
    return s;
  });

  const headerRow = new TableRow({
    children: [hCell("구분"), hCell("항목"), ...subjects.map((s) => hCell(s.label))],
    tableHeader: true,
  });

  const groups = [
    { name: "학습 전략",          rows: FIELD_ROWS_DOCX.filter((r) => r.group === "학습 전략") },
    { name: "Review & Feedback", rows: FIELD_ROWS_DOCX.filter((r) => r.group === "Review & Feedback") },
    { name: "Action Plan",       rows: FIELD_ROWS_DOCX.filter((r) => r.group === "Action Plan") },
  ];

  const dataRows: TableRow[] = [];
  for (const group of groups) {
    const colors = GROUP_COLORS[group.name];
    group.rows.forEach((row, idx) => {
      const cells: TableCell[] = [];
      if (idx === 0) cells.push(gCell(group.name, group.rows.length, colors.group));
      cells.push(lCell(row.label, colors.row));
      for (const s of subjects) {
        const subj = content[s.key] as SubjectContent;
        cells.push(dCell((subj[row.field] as string) ?? ""));
      }
      dataRows.push(new TableRow({ children: cells }));
    });
  }

  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4 }, bottom: { style: BorderStyle.SINGLE, size: 4 },
      left: { style: BorderStyle.SINGLE, size: 4 }, right: { style: BorderStyle.SINGLE, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2 }, insideVertical: { style: BorderStyle.SINGLE, size: 2 },
    },
  });

  const metaParts = [`학생: ${studentName}`, `담당 멘토: ${mentorName}`, `코칭 일시: ${date}`, `회차: ${roundNo} / ${total}`];
  if (content.admission_type) metaParts.push(`입시유형: ${content.admission_type}`);
  if (content.grade)          metaParts.push(`성적: ${content.grade}`);

  return [
    new Paragraph({
      children: [new TextRun({ text: "NEW PERCENT SPARTA 코칭 리포트", bold: true, size: 32, font: "맑은 고딕" })],
      heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
      spacing: { after: 160 }, pageBreakBefore: !isFirst,
    }),
    new Paragraph({
      children: [new TextRun({ text: metaParts.join("   |   "), size: 20, font: "맑은 고딕" })],
      alignment: AlignmentType.CENTER, spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6 } },
    }),
    table as unknown as Paragraph,
  ];
}

async function buildAllRecordsDocx(records: HistoryRecord[], studentName: string, mentorName: string): Promise<Blob> {
  const sorted = [...records].reverse();
  const total  = sorted.length;
  const children: (Paragraph | Table)[] = [];
  sorted.forEach((rec, idx) => {
    const blocks = buildRecordBlock(rec, idx + 1, total, studentName, mentorName, idx === 0);
    children.push(...(blocks as unknown as (Paragraph | Table)[]));
  });
  const doc = new Document({
    sections: [{ properties: { page: { size: { width: 16838, height: 11906 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: children as Paragraph[] }],
  });
  return Packer.toBlob(doc);
}

// ── 마일스톤 카드 ─────────────────────────────────────────────
function MilestoneCards({
  records,
  targetUniversity,
  mentorName,
}: {
  records: HistoryRecord[];
  targetUniversity: string | null;
  mentorName: string;
}) {
  const count       = records.length;
  const lastDate    = records[0]?.date ?? null;
  const latestRec   = records[0]?.content ?? null;

  const noteItems: string[] = [];
  if (latestRec?.admission_type) noteItems.push(latestRec.admission_type);
  if (latestRec?.grade)          noteItems.push(`성적: ${latestRec.grade}`);
  const note = noteItems.length > 0 ? noteItems.join("  ·  ") : "—";

  const cards = [
    {
      label: "누적 코칭 횟수",
      value: count > 0 ? `${count}회차` : "—",
      sub: count > 0 ? "전체 기록 보유 중" : "기록 없음",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      ),
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "최근 코칭일",
      value: lastDate ?? "—",
      sub: lastDate ? "마지막 코칭 날짜" : "코칭 기록 없음",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
      ),
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      label: "목표 대학",
      value: targetUniversity ?? "미설정",
      sub: mentorName !== "-" ? `담당: ${mentorName}` : "담당 멘토 미배정",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
        </svg>
      ),
      color: "text-violet-500",
      bg: "bg-violet-50",
    },
    {
      label: "최근 특이사항",
      value: note,
      sub: lastDate ? `${lastDate} 기록 기준` : "기록 없음",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      ),
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4 flex flex-col gap-2"
        >
          <div className={`w-9 h-9 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
            {card.icon}
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">
              {card.label}
            </p>
            <p className="text-sm font-bold text-gray-800 leading-snug break-words">
              {card.value}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function StudentActionPanel({ records, studentId, studentName, mentorId, mentorName, targetUniversity }: Props) {
  const [historyOpen, setHistoryOpen]     = useState(false);
  const [importStatus, setImportStatus]   = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importMsg, setImportMsg]         = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 파일 선택 핸들러 ────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("loading");
    setImportMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { dates } = await importWordFile(formData, studentId, mentorId);
      setImportStatus("success");
      setImportMsg(`${dates.length}개 기록 저장 완료 (${dates.join(", ")})`);
    } catch (err) {
      setImportStatus("error");
      setImportMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── 내보내기 핸들러 ─────────────────────────────────────────
  async function handleExport() {
    setExportLoading(true);
    try {
      const freshRecords = await getCoachingRecordsForExport(studentId);
      if (freshRecords.length === 0) { alert("내보낼 코칭 기록이 없습니다."); return; }
      const blob = await buildAllRecordsDocx(freshRecords, studentName, mentorName);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `코칭기록_전체_${studentName}_${freshRecords.length}회차.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".docx,.doc" className="hidden" onChange={handleFileChange} />

      {/* ── 섹션 헤더 ────────────────────────────────────────── */}
      <div className="mt-12 pt-6 border-t border-gray-200">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
          행정 및 문서 관리
        </p>

        {/* 3버튼 그리드 */}
        <div className="grid grid-cols-3 gap-4">

          {/* 버튼 1: PT 코칭 기록 */}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
            </svg>
            PT 코칭 기록
            {records.length > 0 && (
              <span className="text-blue-200 font-normal text-xs">({records.length})</span>
            )}
          </button>

          {/* 버튼 2: 과거 워드 자료 가져오기 */}
          <button
            type="button"
            onClick={() => { setImportStatus("idle"); setImportMsg(""); fileInputRef.current?.click(); }}
            disabled={importStatus === "loading"}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-400 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-amber-500 disabled:opacity-50 active:scale-95 transition-all"
          >
            {importStatus === "loading" ? (
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
            )}
            {importStatus === "loading" ? "AI 분석 중…" : "과거 워드 자료 가져오기"}
          </button>

          {/* 버튼 3: 전체 기록 워드로 내보내기 */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exportLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-400 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-amber-500 disabled:opacity-50 active:scale-95 transition-all"
          >
            {exportLoading ? (
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            )}
            {exportLoading ? "생성 중…" : "전체 기록 워드로 내보내기"}
          </button>
        </div>

        {/* import 피드백 */}
        {importStatus === "success" && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
            {importMsg}
          </p>
        )}
        {importStatus === "error" && (
          <p className="text-xs text-red-500 mt-2">{importMsg}</p>
        )}
      </div>

      {/* ── 마일스톤 카드 ───────────────────────────────────────── */}
      <MilestoneCards
        records={records}
        targetUniversity={targetUniversity}
        mentorName={mentorName}
      />

      {/* PT 코칭 기록 목록 모달 */}
      {historyOpen && (
        <HistoryListModal
          records={records}
          studentName={studentName}
          studentId={studentId}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}
