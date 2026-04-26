"use client";

import { useState } from "react";
import { deactivateStudent, reactivateStudent } from "@/app/actions/student";
import type { StudentStatus } from "@/types/database";

interface Props {
  studentId: string;
  studentName: string;
  initialStatus: StudentStatus;
}

export default function StudentStatusButton({ studentId, studentName, initialStatus }: Props) {
  const [status, setStatus] = useState<StudentStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = status === "active";

  async function handleToggle() {
    const confirmMsg = isActive
      ? `'${studentName}' 학생을 퇴원 처리하시겠습니까?\n(코칭 기록과 학생 데이터는 삭제되지 않습니다.)`
      : `'${studentName}' 학생을 재등록(복원) 처리하시겠습니까?`;

    if (!confirm(confirmMsg)) return;

    setLoading(true);
    setError(null);
    try {
      if (isActive) {
        await deactivateStudent(studentId);
        setStatus("inactive");
      } else {
        await reactivateStudent(studentId);
        setStatus("active");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* 상태 배지 */}
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
          isActive
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-gray-100 text-gray-500 border border-gray-200"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-gray-400"}`} />
        {isActive ? "재원 중" : "퇴원"}
      </span>

      {/* 처리 버튼 */}
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${
          isActive
            ? "border-red-200 text-red-600 hover:bg-red-50"
            : "border-blue-200 text-blue-600 hover:bg-blue-50"
        }`}
      >
        {loading ? "처리 중…" : isActive ? "퇴원 처리" : "재등록"}
      </button>

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
