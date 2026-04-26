"use client";

import { useState } from "react";
import { generateAiReport } from "@/app/actions/ai-report";
import PdfExportButton from "./PdfExportButton";

interface Props {
  studentId: string;
  studentName: string;
  hasLogs: boolean;
}

type Status = "idle" | "generating" | "done" | "error";

export default function ReportViewer({ studentId, studentName, hasLogs }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [report, setReport] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleGenerate() {
    setStatus("generating");
    setErrorMsg("");
    try {
      const text = await generateAiReport(studentId);
      setReport(text);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      {/* 생성 버튼 */}
      {status !== "done" && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={!hasLogs || status === "generating"}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center gap-2"
          >
            {status === "generating" ? (
              <>
                <Spinner />
                AI 보고서 생성 중...
              </>
            ) : (
              "AI 전략 보고서 생성"
            )}
          </button>
          {!hasLogs && (
            <p className="text-sm text-orange-500">코칭 기록이 있어야 보고서를 생성할 수 있습니다.</p>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {/* 보고서 편집 영역 */}
      {status === "done" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">AI 보고서 (편집 가능)</h3>
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
              >
                재생성
              </button>
              <PdfExportButton report={report} studentName={studentName} />
            </div>
          </div>

          {/* 마크다운 미리보기 / 텍스트 편집 탭 */}
          <ReportEditor report={report} onChange={setReport} />
        </div>
      )}
    </div>
  );
}

// ── 편집기: Preview / Edit 탭 ──────────────────────────────

function ReportEditor({
  report,
  onChange,
}: {
  report: string;
  onChange: (v: string) => void;
}) {
  const [tab, setTab] = useState<"preview" | "edit">("preview");

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 탭 */}
      <div className="flex border-b border-gray-200">
        {(["preview", "edit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium transition ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "preview" ? "미리보기" : "직접 편집"}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div className="p-6">
        {tab === "preview" ? (
          <MarkdownPreview content={report} />
        ) : (
          <textarea
            value={report}
            onChange={(e) => onChange(e.target.value)}
            rows={30}
            className="w-full text-sm font-mono leading-relaxed focus:outline-none resize-y"
          />
        )}
      </div>
    </div>
  );
}

// ── 간단한 마크다운 렌더러 ────────────────────────────────
// react-markdown 미설치 상태이므로 기본 변환 처리
function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="prose prose-sm max-w-none space-y-1 text-gray-800 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-lg font-bold text-gray-900 mt-6 mb-2">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-base font-semibold text-gray-800 mt-4 mb-1">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <li key={i} className="ml-4 list-disc text-sm">
              <InlineMarkdown text={line.slice(2)} />
            </li>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return (
          <p key={i} className="text-sm">
            <InlineMarkdown text={line} />
          </p>
        );
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // **bold** 처리
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}
