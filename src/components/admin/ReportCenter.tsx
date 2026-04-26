"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateAndSaveMonthlyReport,
  saveMonthlyReport,
  getStudentCoachingRecords,
  getStudentMonthlyReports,
} from "@/app/actions/monthly-report";
import type { StudentReportRow } from "@/app/admin/reports/page";
import type { CoachingRecord, SubjectContent, InquirySubjectContent } from "@/types/database";
import { loadKoreanFont } from "@/lib/pdf/loadKoreanFont";

interface Props {
  students: StudentReportRow[];
  yearMonth: string;
  monthLabel: string;
  selectedYear: number;
  selectedMonth: number;
}

// ── PDF 생성 (jspdf) ──────────────────────────────────────────
async function downloadPdf(
  studentName: string,
  targetUniversity: string | null,
  reportYearMonth: string,
  content: string
) {
  const { jsPDF } = await import("jspdf");

  const [y, m] = reportYearMonth.split("-");
  const label = `${y}년 ${parseInt(m)}월`;
  const today = new Date().toLocaleDateString("ko-KR");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── NanumGothic 폰트 로드 (한글 깨짐 방지) ───────────────
  const fontName = await loadKoreanFont(doc);

  const pageW = 210;
  const pageH = 297;
  const marginL = 20;
  const marginR = 20;
  const usableW = pageW - marginL - marginR;

  let curY = 18;

  // ── 헤더 배경 바 ──────────────────────────────────────────
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 38, "F");

  // 학원명 (로고 대체 텍스트)
  doc.setFont(fontName, "bold");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("NEW PERCENT SPARTA", marginL, 11);

  // 보고서 제목
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("NIMS 월간 코칭 보고서", marginL, 23);

  // 우측 발행일
  doc.setFont(fontName, "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`발행일: ${today}`, pageW - marginR, 23, { align: "right" });

  curY = 48;

  // ── 학생 정보 박스 ────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginL, curY, usableW, 22, 2, 2, "FD");

  doc.setFont(fontName, "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const col1X = marginL + 5;
  const col2X = marginL + 60;
  const col3X = marginL + 120;
  const infoY1 = curY + 8;
  const infoY2 = curY + 16;

  doc.text("학생", col1X, infoY1);
  doc.setFont(fontName, "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(studentName, col1X + 14, infoY1);

  doc.setFont(fontName, "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("목표 대학", col2X, infoY1);
  doc.setFont(fontName, "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(targetUniversity ?? "미정", col2X + 20, infoY1);

  doc.setFont(fontName, "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("분석 기간", col3X, infoY1);
  doc.setFont(fontName, "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(label, col3X + 20, infoY1);

  // 구분선
  doc.setDrawColor(226, 232, 240);
  doc.line(col1X, infoY2 - 4, marginL + usableW - 5, infoY2 - 4);

  doc.setFont(fontName, "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("발행기관", col1X, infoY2);
  doc.setFont(fontName, "normal");
  doc.setTextColor(15, 23, 42);
  doc.text("뉴퍼센트 스파르타 PT코칭연구소", col1X + 18, infoY2);

  curY += 30;

  // ── 보고서 내용 (마크다운 파싱) ──────────────────────────
  const lines = content.split("\n");
  doc.setFontSize(10);

  for (const line of lines) {
    if (curY > pageH - 25) {
      doc.addPage();
      curY = 20;
    }

    if (line.startsWith("## ")) {
      curY += 4;
      const heading = line.slice(3);
      // 제목 배경
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginL, curY - 5, usableW, 10, 1, 1, "FD");
      // 좌측 강조 바
      doc.setFillColor(30, 41, 59);
      doc.rect(marginL, curY - 5, 3, 10, "F");
      doc.setFont(fontName, "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(heading, marginL + 7, curY + 1);
      curY += 12;

    } else if (line.startsWith("### ")) {
      curY += 2;
      doc.setFont(fontName, "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(line.slice(4), marginL + 2, curY);
      curY += 7;

    } else if (line.startsWith("- ")) {
      const raw = line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1");
      doc.setFont(fontName, "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      // 불릿
      doc.setFillColor(100, 116, 139);
      doc.circle(marginL + 3, curY - 1.5, 1, "F");
      const wrapped = doc.splitTextToSize(raw, usableW - 10);
      doc.text(wrapped, marginL + 7, curY);
      curY += wrapped.length * 5.5 + 1;

    } else if (line.trim() === "") {
      curY += 3;

    } else {
      const raw = line.replace(/\*\*(.*?)\*\*/g, "$1");
      doc.setFont(fontName, "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const wrapped = doc.splitTextToSize(raw, usableW);
      doc.text(wrapped, marginL, curY);
      curY += wrapped.length * 5.5 + 1;
    }
  }

  // ── 푸터 ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageH - 12, pageW, 12, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(0, pageH - 12, pageW, pageH - 12);
    doc.setFont(fontName, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "뉴퍼센트 스파르타 · NIMS PT 코칭 시스템",
      marginL,
      pageH - 5
    );
    doc.text(`${i} / ${totalPages}`, pageW - marginR, pageH - 5, { align: "right" });
  }

  doc.save(`NIMS_보고서_${studentName}_${label}.pdf`);
}

// ── 마크다운 렌더러 ───────────────────────────────────────────
function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  if (!content || content.trim() === "") {
    return (
      <p className="text-sm text-gray-400 text-center py-8">보고서 내용이 없습니다.</p>
    );
  }
  return (
    <div className="space-y-1 text-sm text-gray-800 leading-relaxed">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return (
            <h2 key={i} className="text-base font-bold text-gray-900 mt-5 mb-1.5 flex items-center gap-2">
              <span className="w-1 h-4 bg-gray-800 rounded-full shrink-0 inline-block" />
              {line.slice(3)}
            </h2>
          );
        if (line.startsWith("### "))
          return <h3 key={i} className="text-sm font-semibold text-gray-800 mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("- "))
          return (
            <li key={i} className="ml-5 list-disc text-gray-700">
              <InlineMd text={line.slice(2)} />
            </li>
          );
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="text-gray-700"><InlineMd text={line} /></p>;
      })}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning";
interface ToastState { message: string; type: ToastType; }

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const colors: Record<ToastType, string> = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-700",
    error:   "bg-red-50 border-red-200 text-red-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
  };
  const iconPath: Record<ToastType, string> = {
    success: "M5 13l4 4L19 7",
    error:   "M6 18L18 6M6 6l12 12",
    warning: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  };
  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${colors[toast.type]}`}>
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath[toast.type]} />
      </svg>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── 과목 레이블 ───────────────────────────────────────────────
const SUBJECT_KEYS = ["korean", "math", "english", "inquiry1", "inquiry2"] as const;
const SUBJECT_LABELS: Record<string, string> = {
  korean: "국어", math: "수학", english: "영어", inquiry1: "탐구 1", inquiry2: "탐구 2",
};
const FIELD_LABELS: Record<string, string> = {
  grade_goal: "등급목표", materials: "교재/인강", study_strategy: "공부전략",
  planner_check: "플래너", last_progress: "지난주 진도", review_habits: "복습&습관",
  self_check: "자기점검", next_plan: "다음 주 계획", focus_training: "집중훈련",
};

// ── 코칭 기록 모달 ────────────────────────────────────────────
interface RecordsModalState { studentId: string; studentName: string; }

function CoachingRecordsModal({
  state, records, loading, selectedDate, onSelectDate, onClose,
}: {
  state: RecordsModalState;
  records: CoachingRecord[];
  loading: boolean;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  onClose: () => void;
}) {
  const selectedRecord = records.find((r) => r.date === selectedDate) ?? null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">{state.studentName} · 코칭 기록</p>
            {!loading && <p className="text-xs text-gray-400 mt-0.5">전체 {records.length}회</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : records.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <p className="text-sm text-gray-400">코칭 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            <div className="w-44 shrink-0 border-r border-gray-100 overflow-y-auto py-2">
              {records.map((r) => (
                <button
                  key={r.date}
                  onClick={() => onSelectDate(r.date)}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium transition hover:bg-gray-50 ${
                    selectedDate === r.date ? "bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-500" : "text-gray-600"
                  }`}
                >
                  {r.date}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {selectedRecord ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUBJECT_KEYS.map((key) => {
                    const data = selectedRecord.content[key] as SubjectContent | InquirySubjectContent;
                    const hasData = Object.values(data).some((v) => v && v !== "");
                    if (!hasData) return null;
                    const inquiryName = "subject_name" in data ? (data as InquirySubjectContent).subject_name : "";
                    const label = inquiryName ? `${SUBJECT_LABELS[key]} (${inquiryName})` : SUBJECT_LABELS[key];
                    return (
                      <div key={key} className="bg-gray-50 rounded-lg border border-gray-100 p-3 space-y-1">
                        <p className="text-[11px] font-bold text-gray-700">{label}</p>
                        {Object.entries(FIELD_LABELS).map(([field, fieldLabel]) => {
                          const val = (data as unknown as Record<string, string>)[field];
                          if (!val) return null;
                          return (
                            <div key={field} className="flex gap-2 text-[11px]">
                              <span className="text-gray-400 whitespace-nowrap shrink-0 w-14">{fieldLabel}</span>
                              <span className="text-gray-700 line-clamp-2">{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-10">날짜를 선택하세요.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 보고서 상세/편집 모달 ─────────────────────────────────────
interface MonthlyReportItem {
  id: string;
  year_month: string;
  content: string;
  created_at: string;
  analysis_type: "monthly" | "cumulative";
}

interface ReportModalState {
  studentId: string;
  studentName: string;
  targetUniversity: string | null;
}

function ReportsModal({
  state,
  reports: initialReports,
  loading,
  onClose,
  onSaved,
}: {
  state: ReportModalState;
  reports: MonthlyReportItem[];
  loading: boolean;
  onClose: () => void;
  onSaved: (yearMonth: string, content: string) => void;
}) {
  // 보고서가 1건이면 목록 없이 바로 상세로
  const [selected, setSelected] = useState<MonthlyReportItem | null>(
    initialReports.length === 1 ? initialReports[0] : null
  );
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(
    initialReports.length === 1 ? (initialReports[0].content ?? "") : ""
  );
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  function openReport(r: MonthlyReportItem) {
    setSelected(r);
    setEditText(r.content ?? "");
    setEditMode(false);
    setSavedOk(false);
    setSaveErr("");
  }

  function formatYM(ym: string) {
    const [y, m] = ym.split("-");
    return `${y}년 ${parseInt(m)}월`;
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveErr("");
    try {
      await saveMonthlyReport(state.studentId, selected.year_month, editText);
      setSelected((prev) => prev ? { ...prev, content: editText } : prev);
      setSavedOk(true);
      setEditMode(false);
      onSaved(selected.year_month, editText);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handlePdf() {
    if (!selected) return;
    setPdfLoading(true);
    try {
      await downloadPdf(
        state.studentName,
        state.targetUniversity,
        selected.year_month,
        selected.content
      );
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {selected && (
              <button
                type="button"
                onClick={() => { setSelected(null); setEditMode(false); }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                목록
              </button>
            )}
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">
                {selected
                  ? `${state.studentName} · ${formatYM(selected.year_month)} 보고서`
                  : `${state.studentName} · 월간 보고서`}
              </p>
              {!selected && (
                <p className="text-xs text-gray-400 mt-0.5">총 {initialReports.length}건</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : !selected ? (
          /* ── 보고서 목록 ── */
          initialReports.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2">
              <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-400">생성된 보고서가 없습니다.</p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {initialReports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openReport(r)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900">{formatYM(r.year_month)} 보고서</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                            r.analysis_type === "cumulative"
                              ? "bg-violet-50 text-violet-600 border-violet-200"
                              : "bg-blue-50 text-blue-600 border-blue-200"
                          }`}>
                            {r.analysis_type === "cumulative" ? "누적 성장" : "당월 집중"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          생성일: {new Date(r.created_at).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-blue-500 font-semibold group-hover:translate-x-0.5 transition-transform">
                      보기 →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          /* ── 보고서 상세/편집 ── */
          <div className="flex flex-col flex-1 min-h-0">
            {/* 상세 툴바 */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 shrink-0 bg-gray-50/60 gap-2 flex-wrap">
              {/* 미리보기 / 편집 탭 */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                <button
                  onClick={() => setEditMode(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    !editMode ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  미리보기
                </button>
                <button
                  onClick={() => { setEditMode(true); setSavedOk(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    editMode ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  직접 편집
                </button>
              </div>

              {/* 우측 버튼 */}
              <div className="flex items-center gap-2">
                {savedOk && <span className="text-xs text-emerald-600 font-medium">✓ 저장됨</span>}
                {saveErr && <span className="text-xs text-red-500">{saveErr}</span>}

                {editMode && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        저장 중…
                      </>
                    ) : "저장"}
                  </button>
                )}

                <button
                  onClick={handlePdf}
                  disabled={pdfLoading}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition"
                >
                  {pdfLoading ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      생성 중…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      PDF 저장
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 내용 영역 */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {editMode ? (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={18}
                  className="w-full text-sm font-mono leading-relaxed focus:outline-none resize-y text-gray-800 border border-gray-200 rounded-xl p-4 bg-gray-50/40"
                />
              ) : (
                <MarkdownPreview content={selected.content} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function ReportCenter({ students, yearMonth, monthLabel, selectedYear, selectedMonth }: Props) {
  const router = useRouter();

  const totalCount    = students.length;
  const doneCount     = students.filter((s) => s.report_content !== null).length;
  const noRecordCount = students.filter((s) => s.this_month_records === 0).length;
  const progressPct   = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // ── 상태 ───────────────────────────────────────────────────
  const [reports,    setReports]    = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    students.forEach((s) => { if (s.report_content) m[s.id] = s.report_content; });
    return m;
  });
  const [generating,    setGenerating]    = useState<Set<string>>(new Set());
  const [saving,        setSaving]        = useState<Set<string>>(new Set());
  const [errors,        setErrors]        = useState<Record<string, string>>({});
  const [savedSet,      setSavedSet]      = useState<Set<string>>(new Set());
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [tab,           setTab]           = useState<Record<string, "preview" | "edit">>({});
  const [filter,        setFilter]        = useState<"all" | "done" | "pending">("all");
  const [analysisMode,  setAnalysisMode]  = useState<"monthly" | "cumulative">("monthly");

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);
  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // 코칭 기록 모달
  const [recordsModal,   setRecordsModal]   = useState<RecordsModalState | null>(null);
  const [modalRecords,   setModalRecords]   = useState<CoachingRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selectedDate,   setSelectedDate]   = useState<string | null>(null);

  // 보고서 목록 모달
  const [reportsModal,       setReportsModal]       = useState<ReportModalState | null>(null);
  const [modalMonthlyReports, setModalMonthlyReports] = useState<MonthlyReportItem[]>([]);
  const [loadingReports,     setLoadingReports]     = useState(false);

  async function openRecordsModal(s: { id: string; name: string }) {
    setRecordsModal({ studentId: s.id, studentName: s.name });
    setLoadingRecords(true);
    setModalRecords([]);
    setSelectedDate(null);
    try {
      const recs = await getStudentCoachingRecords(s.id);
      setModalRecords(recs);
      if (recs.length > 0) setSelectedDate(recs[0].date);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "기록 불러오기 실패", "error");
      setRecordsModal(null);
    } finally {
      setLoadingRecords(false);
    }
  }

  async function openReportsModal(s: StudentReportRow) {
    setReportsModal({ studentId: s.id, studentName: s.name, targetUniversity: s.target_university });
    setLoadingReports(true);
    setModalMonthlyReports([]);
    try {
      const list = await getStudentMonthlyReports(s.id);

      // DB 결과가 비어 있는데 메모리에 보고서가 있으면 폴백 엔트리 추가
      if (list.length === 0 && reports[s.id]) {
        setModalMonthlyReports([{
          id:            "local",
          year_month:    yearMonth,
          content:       reports[s.id],
          created_at:    new Date().toISOString(),
          analysis_type: "monthly",
        }]);
      } else {
        setModalMonthlyReports(list);
      }
    } catch (err) {
      // DB 조회 실패 시에도 메모리 데이터로 모달 유지
      if (reports[s.id]) {
        setModalMonthlyReports([{
          id:            "local",
          year_month:    yearMonth,
          content:       reports[s.id],
          created_at:    new Date().toISOString(),
          analysis_type: "monthly",
        }]);
      } else {
        showToast(err instanceof Error ? err.message : "보고서 목록 불러오기 실패", "error");
        setReportsModal(null);
      }
    } finally {
      setLoadingReports(false);
    }
  }

  // 모달 안에서 저장 완료 시 reports 상태 업데이트
  function handleModalSaved(studentId: string, ym: string, content: string) {
    if (ym === yearMonth) {
      setReports((prev) => ({ ...prev, [studentId]: content }));
    }
    // 목록에서도 즉시 반영
    setModalMonthlyReports((prev) =>
      prev.map((r) => r.year_month === ym ? { ...r, content } : r)
    );
    showToast("보고서가 저장되었습니다.", "success");
  }

  // ── 단일 생성 ──────────────────────────────────────────────
  async function handleGenerate(studentId: string) {
    const student = students.find((s) => s.id === studentId);
    if (student?.this_month_records === 0) {
      showToast("코칭 기록이 없어 보고서 생성이 불가능합니다.", "warning");
      return;
    }
    setGenerating((prev) => new Set(prev).add(studentId));
    setErrors((prev) => { const n = { ...prev }; delete n[studentId]; return n; });
    setSavedSet((prev) => { const n = new Set(prev); n.delete(studentId); return n; });
    try {
      const content = await generateAndSaveMonthlyReport(studentId, yearMonth, analysisMode);
      setReports((prev) => ({ ...prev, [studentId]: content }));
      setExpanded(studentId);
      router.refresh();
      showToast("보고서가 생성되었습니다.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "생성 실패";
      setErrors((prev) => ({ ...prev, [studentId]: msg }));
      showToast(msg, "error");
    } finally {
      setGenerating((prev) => { const n = new Set(prev); n.delete(studentId); return n; });
    }
  }

  // ── 일괄 생성 ──────────────────────────────────────────────
  async function handleBulkGenerate() {
    const ids = Array.from(selected).filter(
      (id) => (students.find((s) => s.id === id)?.this_month_records ?? 0) > 0
    );
    if (ids.length === 0) {
      showToast("선택한 학생 중 이번 달 코칭 기록이 있는 학생이 없습니다.", "warning");
      return;
    }
    for (const id of ids) await handleGenerate(id);
    setSelected(new Set());
  }

  // ── 인라인 저장 ────────────────────────────────────────────
  async function handleSave(studentId: string) {
    const content = reports[studentId];
    if (!content) return;
    setSaving((prev) => new Set(prev).add(studentId));
    try {
      await saveMonthlyReport(studentId, yearMonth, content);
      setSavedSet((prev) => new Set(prev).add(studentId));
      setTimeout(() => setSavedSet((prev) => { const n = new Set(prev); n.delete(studentId); return n; }), 2500);
      showToast("보고서가 저장되었습니다.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장 실패";
      setErrors((prev) => ({ ...prev, [studentId]: msg }));
      showToast(msg, "error");
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(studentId); return n; });
    }
  }

  // ── 체크박스 ───────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    if (selected.size === filteredStudents.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredStudents.map((s) => s.id)));
    }
  }

  // ── 필터링 ─────────────────────────────────────────────────
  const filteredStudents = students.filter((s) => {
    if (filter === "done")    return reports[s.id] !== undefined;
    if (filter === "pending") return reports[s.id] === undefined;
    return true;
  });

  const canBulkGenerate = selected.size > 0 && generating.size === 0;

  // ── 연/월 이동 ──────────────────────────────────────────────
  function navigateToMonth(year: number, month: number) {
    router.push(`/admin/reports?year=${year}&month=${month}`);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2023 + 2 }, (_, i) => 2023 + i);

  // ── 인라인 PDF ────────────────────────────────────────────
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  async function handlePdf(s: StudentReportRow) {
    const content = reports[s.id];
    if (!content) return;
    setPdfLoading(s.id);
    try {
      await downloadPdf(s.name, s.target_university, yearMonth, content);
    } finally {
      setPdfLoading(null);
    }
  }

  return (
    <>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* 코칭 기록 모달 */}
      {recordsModal && (
        <CoachingRecordsModal
          state={recordsModal}
          records={modalRecords}
          loading={loadingRecords}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onClose={() => setRecordsModal(null)}
        />
      )}

      {/* 월간 보고서 모달 */}
      {reportsModal && (
        <ReportsModal
          state={reportsModal}
          reports={modalMonthlyReports}
          loading={loadingReports}
          onClose={() => setReportsModal(null)}
          onSaved={(ym, content) => handleModalSaved(reportsModal.studentId, ym, content)}
        />
      )}

      <div className="space-y-5">

        {/* ── 조회 월 선택 ────────────────────────────────────── */}
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-5 py-4 flex-wrap">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-gray-700 shrink-0">조회 월 선택</span>

          <select
            value={selectedYear}
            onChange={(e) => navigateToMonth(Number(e.target.value), selectedMonth)}
            className="text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => navigateToMonth(selectedYear, Number(e.target.value))}
            className="text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>

          <span className="text-sm font-bold text-blue-600 ml-1">{monthLabel}</span>

          {(selectedYear !== now.getFullYear() || selectedMonth !== now.getMonth() + 1) && (
            <button
              onClick={() => navigateToMonth(now.getFullYear(), now.getMonth() + 1)}
              className="ml-auto text-xs font-semibold text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
            >
              현재 월로
            </button>
          )}
        </div>

        {/* ── 대시보드 카드 ──────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-end justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{monthLabel} 보고서 현황</p>
              <span className="text-2xl font-black text-gray-900">{progressPct}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{doneCount}명</span> 완료
              <span className="text-gray-300 mx-2">/</span>전체 {totalCount}명
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">보고서 완료</p>
            <div>
              <p className="text-3xl font-black text-emerald-500">{doneCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">명</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">상담 필요</p>
            <div>
              <p className="text-3xl font-black text-orange-500">{noRecordCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">이번 달 기록 없음</p>
            </div>
          </div>
        </div>

        {/* ── 툴바 ───────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* 분석 모드 선택 */}
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-5 py-3">
            <span className="text-xs font-semibold text-gray-500 shrink-0">분석 모드</span>
            <div className="flex items-center gap-2">
              {(["monthly", "cumulative"] as const).map((mode) => {
                const isActive = analysisMode === mode;
                const label    = mode === "monthly" ? "당월 집중" : "누적 성장";
                const desc     = mode === "monthly" ? "선택 월 기록만 분석" : "입학~현재 전체 분석";
                const activeStyle = mode === "monthly"
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-violet-600 border-violet-600 text-white";
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAnalysisMode(mode)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${
                      isActive ? activeStyle : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {mode === "monthly" ? (
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    )}
                    <span>{label}</span>
                    <span className={`hidden sm:inline text-[10px] font-normal ${isActive ? "opacity-80" : "text-gray-400"}`}>
                      {desc}
                    </span>
                  </button>
                );
              })}
            </div>
            {analysisMode === "cumulative" && (
              <span className="ml-auto text-[11px] text-violet-500 font-medium hidden sm:block">
                전체 코칭 기록을 바탕으로 장기 성장 궤적을 분석합니다
              </span>
            )}
          </div>

          {/* 필터 + 일괄 생성 */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
              {(["all", "done", "pending"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    filter === f ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {f === "all" ? `전체 (${totalCount})` : f === "done" ? `완료 (${doneCount})` : `미생성 (${totalCount - doneCount})`}
                </button>
              ))}
            </div>

            <button
              onClick={handleBulkGenerate}
              disabled={!canBulkGenerate}
              className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition ${
                analysisMode === "cumulative" ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {generating.size > 0 ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  생성 중… ({generating.size}명)
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  선택 일괄 생성{selected.size > 0 ? ` (${selected.size}명)` : ""}
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── 학생 테이블 ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* 테이블 헤더 */}
          <div className="grid items-center gap-x-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider"
            style={{ gridTemplateColumns: "40px 1.6fr 1fr 0.7fr 0.7fr 0.9fr 1.1fr" }}>
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={selected.size === filteredStudents.length && filteredStudents.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-gray-300"
              />
            </div>
            <span>학생</span>
            <span>멘토</span>
            <span className="text-center">이번 달</span>
            <span className="text-center">기록</span>
            <span className="text-center">보고서</span>
            <span className="text-right">액션</span>
          </div>

          {filteredStudents.length === 0 ? (
            <p className="px-5 py-10 text-sm text-gray-400 text-center">해당하는 학생이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {filteredStudents.map((s) => {
                const isGenerating   = generating.has(s.id);
                const hasReport      = reports[s.id] !== undefined;
                const isSaving       = saving.has(s.id);
                const isSaved        = savedSet.has(s.id);
                const errMsg         = errors[s.id];
                const isExpanded     = expanded === s.id;
                const needCounseling = s.this_month_records === 0;
                const currentTab     = tab[s.id] ?? "preview";

                return (
                  <li key={s.id}>
                    {/* ── 요약 행 ── */}
                    <div
                      className={`grid items-center gap-x-4 px-5 py-4 hover:bg-gray-50/70 transition ${isExpanded ? "bg-blue-50/30" : ""}`}
                      style={{ gridTemplateColumns: "40px 1.6fr 1fr 0.7fr 0.7fr 0.9fr 1.1fr" }}
                    >
                      {/* 체크박스 */}
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={() => toggleSelect(s.id)}
                          className="rounded border-gray-300"
                        />
                      </div>

                      {/* 학생 이름 */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm truncate">{s.name}</span>
                          {needCounseling && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-500 border border-orange-200 whitespace-nowrap">
                              상담 필요
                            </span>
                          )}
                        </div>
                        {s.target_university && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{s.target_university}</p>
                        )}
                      </div>

                      {/* 멘토 */}
                      <span className="text-xs text-gray-600 truncate">{s.mentor_name ?? "—"}</span>

                      {/* 이번 달 기록 수 */}
                      <div className="text-center">
                        <span className={`text-sm font-semibold ${s.this_month_records > 0 ? "text-gray-900" : "text-gray-300"}`}>
                          {s.this_month_records}건
                        </span>
                      </div>

                      {/* 기록 확인 버튼 */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => openRecordsModal(s)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition whitespace-nowrap"
                        >
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          기록
                        </button>
                      </div>

                      {/* 보고서 상태 버튼 */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => openReportsModal(s)}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition hover:opacity-80 ${
                            hasReport
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                          }`}
                        >
                          {hasReport ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              보고서
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              미생성
                            </>
                          )}
                        </button>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 생성/재생성 */}
                        <button
                          onClick={() => handleGenerate(s.id)}
                          disabled={isGenerating}
                          title={needCounseling ? "이번 달 코칭 기록이 없습니다" : `${analysisMode === "cumulative" ? "누적 성장" : "당월 집중"} 모드로 생성`}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                            needCounseling
                              ? "border-gray-200 text-gray-400 hover:bg-gray-50"
                              : analysisMode === "cumulative"
                                ? "border-violet-200 text-violet-600 hover:bg-violet-50"
                                : "border-blue-200 text-blue-600 hover:bg-blue-50"
                          }`}
                        >
                          {isGenerating ? (
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          )}
                          {isGenerating ? "생성 중" : hasReport ? "재생성" : "생성"}
                        </button>

                        {/* 보기/닫기 (인라인) */}
                        {hasReport && (
                          <button
                            onClick={() => setExpanded(isExpanded ? null : s.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                          >
                            {isExpanded ? "닫기" : "보기"}
                          </button>
                        )}

                        {/* PDF */}
                        {hasReport && (
                          <button
                            onClick={() => handlePdf(s)}
                            disabled={pdfLoading === s.id}
                            title="PDF 저장"
                            className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition"
                          >
                            {pdfLoading === s.id ? (
                              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── 오류 표시 ── */}
                    {errMsg && (
                      <div className="px-6 pb-3">
                        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          {errMsg}
                        </p>
                      </div>
                    )}

                    {/* ── 인라인 보고서 확장 영역 ── */}
                    {isExpanded && hasReport && (
                      <div className="border-t border-blue-100 bg-blue-50/20 px-5 py-5 space-y-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                            {(["preview", "edit"] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => setTab((prev) => ({ ...prev, [s.id]: t }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                  currentTab === t ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                                }`}
                              >
                                {t === "preview" ? "미리보기" : "직접 편집"}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            {isSaved && <span className="text-xs text-emerald-600 font-medium">✓ 저장됨</span>}
                            <button
                              onClick={() => handleSave(s.id)}
                              disabled={isSaving}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
                            >
                              {isSaving ? "저장 중…" : "저장"}
                            </button>
                            <button
                              onClick={() => handlePdf(s)}
                              disabled={pdfLoading === s.id}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition"
                            >
                              {pdfLoading === s.id ? (
                                <>
                                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                  PDF 생성 중…
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  PDF 저장
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-5 min-h-[180px]">
                          {currentTab === "preview" ? (
                            <MarkdownPreview content={reports[s.id]} />
                          ) : (
                            <textarea
                              value={reports[s.id]}
                              onChange={(e) => setReports((prev) => ({ ...prev, [s.id]: e.target.value }))}
                              rows={12}
                              className="w-full text-sm font-mono leading-relaxed focus:outline-none resize-y text-gray-800"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
