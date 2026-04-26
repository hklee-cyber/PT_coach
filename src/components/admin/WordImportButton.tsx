"use client";

import { useRef, useState } from "react";
import { importWordFile } from "@/app/actions/word-import";

interface Props {
  studentId: string;
  mentorId: string;
}

type Status = "idle" | "loading" | "success" | "error";

export default function WordImportButton({ studentId, mentorId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus]   = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("loading");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { dates } = await importWordFile(formData, studentId, mentorId);
      setStatus("success");
      setMessage(`${dates.length}개 기록 저장 완료 (${dates.join(", ")})`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "저장 실패");
    } finally {
      // 같은 파일 재선택 가능하도록 초기화
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.doc"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => { setStatus("idle"); setMessage(""); inputRef.current?.click(); }}
        disabled={status === "loading"}
        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition active:scale-95"
      >
        {status === "loading" ? (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
        )}
        {status === "loading" ? "AI 분석 중…" : "과거 워드 자료 가져오기"}
      </button>

      {/* 인라인 피드백 */}
      {status === "success" && (
        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
          {message}
        </span>
      )}
      {status === "error" && (
        <span className="text-xs text-red-500">{message}</span>
      )}
    </div>
  );
}
