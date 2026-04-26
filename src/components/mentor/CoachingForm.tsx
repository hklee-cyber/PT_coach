"use client";

import { useState, useEffect, useRef } from "react";
import { saveCoachingRecord } from "@/app/actions/coaching-record";
import WordExportButton from "@/components/mentor/WordExportButton";
import {
  EMPTY_CONTENT,
  type CoachingContent,
  type SubjectContent,
  type InquirySubjectContent,
} from "@/types/database";

// ── 행/과목 정의 ────────────────────────────────────────────

type SubjectKey = "korean" | "math" | "english" | "inquiry1" | "inquiry2";
type FieldKey = keyof SubjectContent;

interface RowDef {
  field: FieldKey;
  label: string;
  group: "학습 전략" | "Review &\nFeedback" | "Action\nPlan";
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

const FIXED_SUBJECTS: { key: SubjectKey; label: string }[] = [
  { key: "korean",  label: "국어" },
  { key: "math",    label: "수학" },
  { key: "english", label: "영어" },
];

// ── Props ────────────────────────────────────────────────────

interface HistoryRecord {
  id: string;
  date: string;
  content: CoachingContent;
}

interface MonthlyReport {
  id: string;
  year_month: string;
  content: string;
}

interface Props {
  studentId: string;
  mentorId: string;
  mentorName: string;
  studentName: string;
  targetUniversity: string | null;
  /** 전체 코칭 기록 — 날짜 역순 (최신순) */
  allRecords: HistoryRecord[];
  /** 월별 학습전략보고서 목록 — 최신순 */
  monthlyReports: MonthlyReport[];
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export default function CoachingForm({
  studentId,
  mentorId,
  mentorName,
  studentName,
  targetUniversity,
  allRecords,
  monthlyReports,
}: Props) {
  const today = new Date().toISOString().split("T")[0];
  const lastRecord = allRecords[0] ?? null;

  const [date,    setDate]    = useState(today);
  const [content, setContent] = useState<CoachingContent>(() => JSON.parse(JSON.stringify(EMPTY_CONTENT)));
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // 모달 상태
  const [showLastModal,      setShowLastModal]      = useState(false);
  const [showPTRecordsModal, setShowPTRecordsModal] = useState(false);
  const [showReportsModal,   setShowReportsModal]   = useState(false);

  // ── 데이터 조작 ──────────────────────────────────────────

  function loadRecord(record: HistoryRecord) {
    setContent(JSON.parse(JSON.stringify(record.content)));
    setSaved(false);
  }

  function updateField(subject: SubjectKey, field: FieldKey, value: string) {
    setContent((prev) => ({ ...prev, [subject]: { ...prev[subject], [field]: value } }));
    setSaved(false);
  }

  function updateInquiryName(subject: "inquiry1" | "inquiry2", name: string) {
    setContent((prev) => ({
      ...prev,
      [subject]: { ...(prev[subject] as InquirySubjectContent), subject_name: name },
    }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveCoachingRecord(studentId, mentorId, date, content);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  // ── 탐구 과목 헤더 (편집용) ──────────────────────────────

  const editableSubjects: { key: SubjectKey; label: React.ReactNode }[] = [
    ...FIXED_SUBJECTS,
    {
      key: "inquiry1",
      label: (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs text-gray-400 font-normal">탐구 1</span>
          <input
            type="text"
            value={(content.inquiry1 as InquirySubjectContent).subject_name}
            onChange={(e) => updateInquiryName("inquiry1", e.target.value)}
            placeholder="과목명"
            className="w-20 text-center text-sm border-b-2 border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ),
    },
    {
      key: "inquiry2",
      label: (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs text-gray-400 font-normal">탐구 2</span>
          <input
            type="text"
            value={(content.inquiry2 as InquirySubjectContent).subject_name}
            onChange={(e) => updateInquiryName("inquiry2", e.target.value)}
            placeholder="과목명"
            className="w-20 text-center text-sm border-b-2 border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ),
    },
  ];

  // ── 렌더링 ───────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── 인쇄 전용 헤더 (화면에서는 숨김) ──────────── */}
      <div className="hidden print:block mb-4">
        <h1 className="text-center text-2xl font-black tracking-tight text-gray-900 mb-2">
          NEW PERCENT SPARTA 코칭 리포트
        </h1>
        <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-2 text-sm font-medium text-gray-800">
          <span><span className="font-bold">학생명</span> : {studentName}</span>
          <span className="text-gray-400">|</span>
          <span><span className="font-bold">담당 멘토</span> : {mentorName}</span>
          <span className="text-gray-400">|</span>
          <span><span className="font-bold">코칭 일시</span> : {date}</span>
          {targetUniversity && (
            <>
              <span className="text-gray-400">|</span>
              <span><span className="font-bold">목표 대학</span> : {targetUniversity}</span>
            </>
          )}
          {content.admission_type && (
            <>
              <span className="text-gray-400">|</span>
              <span><span className="font-bold">입시유형</span> : {content.admission_type}</span>
            </>
          )}
          {content.grade && (
            <>
              <span className="text-gray-400">|</span>
              <span><span className="font-bold">성적</span> : {content.grade}</span>
            </>
          )}
        </div>
      </div>

      {/* ── 슬림 헤더: 날짜 + 멘토 + 입시유형 + 성적 (인쇄 시 숨김) ─────── */}
      <div className="flex items-center gap-6 flex-wrap bg-white rounded-xl border border-gray-200 px-5 py-3 print:hidden">
        {/* 날짜 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">날짜</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-b border-gray-200 bg-transparent focus:outline-none focus:border-blue-500 transition-colors text-gray-900 text-sm py-0.5 px-1"
          />
        </div>
        <div className="h-4 w-px bg-gray-200" />
        {/* 멘토 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">멘토</span>
          <span className="text-sm font-semibold text-gray-800">{mentorName}</span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        {/* 입시 유형 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">입시유형</span>
          <select
            value={content.admission_type}
            onChange={(e) => setContent((prev) => ({ ...prev, admission_type: e.target.value as "" | "정시" | "수시" }))}
            className="border-b border-gray-200 bg-transparent focus:outline-none focus:border-blue-500 transition-colors text-gray-900 text-sm py-0.5 px-1"
          >
            <option value="">미정</option>
            <option value="정시">정시</option>
            <option value="수시">수시</option>
          </select>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        {/* 성적 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">성적</span>
          <input
            type="text"
            value={content.grade}
            onChange={(e) => setContent((prev) => ({ ...prev, grade: e.target.value }))}
            placeholder="예) 국2 수3 영2"
            className="border-b border-gray-200 bg-transparent focus:outline-none focus:border-blue-500 transition-colors text-gray-900 text-sm py-0.5 px-1 w-36 placeholder-gray-300"
          />
        </div>
      </div>

      {/* ── 툴바 (인쇄 시 숨김) ─────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">

        {/* 왼쪽: 지난번 PT 코칭 내용 보기 + 이전 자료 불러오기 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLastModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 active:scale-95 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            지난번 PT 코칭 내용 보기
            {lastRecord && <span className="text-xs text-green-200">({lastRecord.date})</span>}
          </button>

          {lastRecord && (
            <button
              type="button"
              onClick={() => loadRecord(lastRecord)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              이전 자료 불러오기
            </button>
          )}
        </div>

        {/* 오른쪽: 저장 + 출력 */}
        <div className="flex items-center gap-2">
          {saved  && <span className="text-sm text-green-600 font-medium">✓ 저장되었습니다.</span>}
          {error  && <span className="text-sm text-red-500">{error}</span>}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {saving ? "저장 중..." : "저장"}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            출력
          </button>
        </div>
      </div>

      {/* ── 메인 코칭 테이블 (편집) ─────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm coaching-print-wrapper">
        <table className="w-full border-collapse coaching-print-table" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "72px" }} />
            <col style={{ width: "88px" }} />
            <col /><col /><col /><col /><col />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="border border-gray-200 px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">구분</th>
              <th className="border border-gray-200 px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">항목</th>
              {editableSubjects.map((s) => (
                <th key={s.key} className="border border-gray-200 px-3 py-3 text-center text-sm font-bold text-gray-800">
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
                    className={`border border-gray-200 px-2 py-3 text-center text-xs font-bold text-gray-700 whitespace-pre-line align-middle ${row.groupColor}`}
                  >
                    {row.group}
                  </td>
                )}
                <td className={`border border-gray-200 px-3 py-3 text-xs font-medium text-gray-700 whitespace-pre-line align-middle ${row.rowColor}`}>
                  {row.label}
                </td>
                {editableSubjects.map((s) => (
                  <td key={s.key} className="border border-gray-200 p-1.5 align-top">
                    <textarea
                      value={(content[s.key] as SubjectContent)[row.field] as string}
                      onChange={(e) => updateField(s.key, row.field, e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-md px-2.5 py-2 text-sm text-gray-800 leading-relaxed bg-white border border-transparent focus:outline-none focus:border-blue-400 focus:bg-blue-50/30 transition-all duration-150 placeholder-gray-300"
                      placeholder="입력하세요"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 하단 버튼 영역 (인쇄 시 숨김) ─────────────── */}
      <div className="flex items-center justify-between gap-3 pb-10 print:hidden">

        {/* 왼쪽: PT 코칭 기록 + 학습전략보고서 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPTRecordsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 active:scale-95 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            PT 코칭 기록
            {allRecords.length > 0 && (
              <span className="text-xs text-green-200">({allRecords.length}회)</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowReportsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 active:scale-95 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            학습전략보고서
            {monthlyReports.length > 0 && (
              <span className="text-xs text-green-200">({monthlyReports.length}건)</span>
            )}
          </button>
        </div>

        {/* 오른쪽: 저장 + 출력 */}
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600 font-medium">✓ 저장되었습니다.</span>}
          {error && <span className="text-sm text-red-500">{error}</span>}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {saving ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            출력
          </button>
        </div>
      </div>

      {/* ── 모달들 ──────────────────────────────────────── */}
      {showLastModal && (
        <LastCoachingModal
          record={lastRecord}
          onClose={() => setShowLastModal(false)}
        />
      )}

      {showPTRecordsModal && (
        <PTRecordsModal
          records={allRecords}
          studentName={studentName}
          mentorName={mentorName}
          onClose={() => setShowPTRecordsModal(false)}
        />
      )}

      {showReportsModal && (
        <ReportsModal
          reports={monthlyReports}
          studentName={studentName}
          onClose={() => setShowReportsModal(false)}
        />
      )}
    </form>
  );
}

// ── 읽기 전용 테이블 ─────────────────────────────────────────

function ReadOnlyTable({ content }: { content: CoachingContent }) {
  const inquiry1Name = (content.inquiry1 as InquirySubjectContent).subject_name;
  const inquiry2Name = (content.inquiry2 as InquirySubjectContent).subject_name;

  const subjects: { key: SubjectKey; label: string }[] = [
    { key: "korean",   label: "국어" },
    { key: "math",     label: "수학" },
    { key: "english",  label: "영어" },
    { key: "inquiry1", label: inquiry1Name ? `탐구1\n(${inquiry1Name})` : "탐구 1" },
    { key: "inquiry2", label: inquiry2Name ? `탐구2\n(${inquiry2Name})` : "탐구 2" },
  ];

  return (
    <table className="w-full border-collapse text-xs" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "72px" }} />
        <col style={{ width: "88px" }} />
        <col /><col /><col /><col /><col />
      </colgroup>
      <thead>
        <tr className="bg-indigo-100/60 border-b border-indigo-200">
          <th className="border border-indigo-100 px-2 py-2 text-center text-xs font-bold text-indigo-600">구분</th>
          <th className="border border-indigo-100 px-2 py-2 text-center text-xs font-bold text-indigo-600">항목</th>
          {subjects.map((s) => (
            <th key={s.key} className="border border-indigo-100 px-2 py-2 text-center text-xs font-bold text-indigo-700 whitespace-pre-line">
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
                className="border border-indigo-100 px-2 py-2 text-center text-xs font-bold text-indigo-600 whitespace-pre-line align-middle bg-indigo-100/50"
              >
                {row.group}
              </td>
            )}
            <td className="border border-indigo-100 px-2 py-2 text-xs font-medium text-indigo-700 whitespace-pre-line align-middle bg-indigo-50/50">
              {row.label}
            </td>
            {subjects.map((s) => {
              const val = ((content[s.key] as SubjectContent)[row.field] as string) || "";
              return (
                <td key={s.key} className="border border-indigo-100 px-2 py-2 align-top">
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[2.5rem]">
                    {val || <span className="text-gray-300">—</span>}
                  </p>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── 공통 모달 래퍼 ───────────────────────────────────────────

function ModalWrapper({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pb-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      {children}
    </div>
  );
}

// ── 지난번 PT 코칭 내용 모달 ────────────────────────────────

function LastCoachingModal({
  record,
  onClose,
}: {
  record: HistoryRecord | null;
  onClose: () => void;
}) {
  return (
    <ModalWrapper onClose={onClose}>
      <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="font-semibold text-gray-900 text-sm">지난번 PT 코칭 내용</p>
            {record && <p className="text-xs text-gray-400 mt-0.5">{record.date} 작성 · 읽기 전용</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="overflow-auto flex-1">
          {record ? (
            <ReadOnlyTable content={record.content} />
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-gray-400">지난번 PT 코칭 내용이 존재하지 않습니다.</p>
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}

// ── PT 코칭 기록 모달 ────────────────────────────────────────

function PTRecordsModal({
  records,
  studentName,
  mentorName,
  onClose,
}: {
  records: HistoryRecord[];
  studentName: string;
  mentorName: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<HistoryRecord | null>(null);

  return (
    <ModalWrapper onClose={onClose}>
      <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                목록으로
              </button>
            )}
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {selected ? `${selected.date} 코칭 기록` : "PT 코칭 기록"}
              </p>
              {!selected && (
                <p className="text-xs text-gray-400 mt-0.5">날짜를 클릭하면 상세 내용을 볼 수 있습니다</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="overflow-auto flex-1">
          {records.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-gray-400">PT 코칭 내용이 존재하지 않습니다.</p>
            </div>
          ) : selected ? (
            <div className="overflow-x-auto">
              <ReadOnlyTable content={selected.content} />
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {records.map((rec, idx) => (
                <li key={rec.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                  <button
                    type="button"
                    onClick={() => setSelected(rec)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <span className="text-xs font-semibold text-gray-400 w-8 shrink-0">
                      {records.length - idx}회
                    </span>
                    <span className="text-sm font-medium text-gray-800">{rec.date}</span>
                    {idx === 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 border border-blue-100">
                        최신
                      </span>
                    )}
                    <span className="ml-auto text-xs text-blue-500 font-medium">상세 보기 →</span>
                  </button>
                  <div className="ml-3 shrink-0">
                    <WordExportButton
                      record={rec}
                      studentName={studentName}
                      mentorName={mentorName}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 푸터 */}
        {!selected && records.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
            <p className="text-xs text-gray-400 text-center">
              총 {records.length}회차 기록
            </p>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}

// ── 학습전략보고서 모달 ──────────────────────────────────────

function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}년 ${parseInt(month)}월`;
}

function ReportMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1 text-gray-800 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-base font-bold text-gray-900 mt-5 mb-1.5">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-sm font-semibold text-gray-800 mt-3 mb-1">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <li key={i} className="ml-4 list-disc text-sm text-gray-700">
              {line.slice(2)}
            </li>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1.5" />;
        return (
          <p key={i} className="text-sm text-gray-700">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function ReportsModal({
  reports,
  studentName,
  onClose,
}: {
  reports: MonthlyReport[];
  studentName: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<MonthlyReport | null>(null);

  return (
    <ModalWrapper onClose={onClose}>
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                목록으로
              </button>
            )}
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {selected ? `${formatYearMonth(selected.year_month)} 학습전략보고서` : "학습전략보고서"}
              </p>
              {!selected && (
                <p className="text-xs text-gray-400 mt-0.5">{studentName} 학생의 월별 보고서</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="overflow-auto flex-1">
          {reports.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-gray-400">생성된 학습전략보고서가 존재하지 않습니다.</p>
            </div>
          ) : selected ? (
            <div className="p-6">
              <ReportMarkdown content={selected.content} />
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {reports.map((rep) => (
                <li key={rep.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(rep)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-800">
                        {formatYearMonth(rep.year_month)} 보고서
                      </span>
                    </div>
                    <span className="text-xs text-blue-500 font-medium">보기 →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
