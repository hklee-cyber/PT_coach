"use client";

import { useRef, useState } from "react";
import { parseWordFile, saveImportedRecord } from "@/app/actions/word-import";
import { type CoachingContent, type InquirySubjectContent } from "@/types/database";

interface Props {
  studentId: string;
  mentorId: string;
}

const SUBJECT_LABELS: Record<string, string> = {
  korean: "국어", math: "수학", english: "영어", inquiry1: "탐구 1", inquiry2: "탐구 2",
};

const FIELD_LABELS: Record<string, string> = {
  grade_goal: "등급목표", materials: "교재/인강", study_strategy: "공부전략",
  planner_check: "플래너", last_progress: "지난주 진도", review_habits: "복습&습관",
  self_check: "자기점검", next_plan: "다음 주 계획", focus_training: "집중훈련",
};

type ParsedRecord = { content: CoachingContent; date: string };

export default function WordImporter({ studentId, mentorId }: Props) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [open,    setOpen]    = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed,  setParsed]  = useState<ParsedRecord[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [error,   setError]   = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    setError(null);
    setParsed([]);
    setSavedDates([]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await parseWordFile(formData);
      setParsed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 실패");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSaveAll() {
    if (parsed.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const record of parsed) {
        await saveImportedRecord(studentId, mentorId, record.date, record.content);
        setSavedDates((prev) => [...prev, record.date]);
      }
      setParsed([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setParsed([]);
    setSavedDates([]);
    setError(null);
    setFileName("");
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* 헤더 토글 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-900">과거 워드 자료 가져오기</p>
            <p className="text-xs text-gray-400">.docx 파일을 선택하면 자동으로 코칭 기록으로 변환합니다</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-4">

          {/* 파일 선택 영역 */}
          {parsed.length === 0 && savedDates.length === 0 && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.doc"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => { setError(null); fileRef.current?.click(); }}
                disabled={parsing}
                className="w-full flex flex-col items-center justify-center gap-3 px-6 py-8 border-2 border-dashed border-gray-200 rounded-xl hover:border-amber-300 hover:bg-amber-50/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {parsing ? (
                  <>
                    <svg className="animate-spin h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-amber-600">분석 중…</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fileName}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                      <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">클릭하여 파일 선택</p>
                      <p className="text-xs text-gray-400 mt-0.5">.docx / .doc 파일 지원</p>
                    </div>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 오류 */}
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <div className="flex-1">
                <p className="text-xs text-red-500">{error}</p>
                <button type="button" onClick={handleReset}
                  className="text-xs text-red-400 underline mt-1">다시 시도</button>
              </div>
            </div>
          )}

          {/* 저장 완료 */}
          {savedDates.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
                <p className="text-xs text-emerald-600 font-medium">
                  {savedDates.length}개 코칭 기록 저장 완료 ({savedDates.join(", ")})
                </p>
              </div>
              <button type="button" onClick={handleReset}
                className="text-xs text-gray-400 underline">다른 파일 가져오기</button>
            </div>
          )}

          {/* 미리보기 */}
          {parsed.length > 0 && savedDates.length === 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  분석 결과 — {parsed.length}개 기록 발견
                </p>
                <span className="text-xs text-gray-400">{fileName}</span>
              </div>

              {parsed.map((record, idx) => (
                <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* 레코드 헤더 */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span className="text-xs font-bold text-gray-700">{record.date}</span>
                    {record.content.admission_type && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-500 border border-blue-100">
                        {record.content.admission_type}
                      </span>
                    )}
                  </div>
                  {/* 과목별 카드 */}
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(["korean","math","english","inquiry1","inquiry2"] as const).map((key) => {
                      const data = record.content[key];
                      const isInquiry = key.startsWith("inquiry");
                      const inquiryName = isInquiry ? (data as InquirySubjectContent).subject_name : "";
                      const hasData = Object.values(data).some((v) => v && v !== "");
                      if (!hasData) return null;
                      const label = isInquiry && inquiryName
                        ? `${SUBJECT_LABELS[key]} (${inquiryName})`
                        : SUBJECT_LABELS[key];

                      return (
                        <div key={key} className="bg-gray-50 rounded-lg border border-gray-100 p-3 space-y-1.5">
                          <p className="text-xs font-bold text-gray-700">{label}</p>
                          {Object.entries(FIELD_LABELS).map(([field, fieldLabel]) => {
                            const val = (data as unknown as Record<string, string>)[field];
                            if (!val) return null;
                            return (
                              <div key={field} className="flex gap-2 text-xs">
                                <span className="text-gray-400 whitespace-nowrap shrink-0 w-16">{fieldLabel}</span>
                                <span className="text-gray-700 line-clamp-2">{val}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* 저장 / 취소 버튼 */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      저장 중…
                    </>
                  ) : `${parsed.length}개 코칭 기록 저장`}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
