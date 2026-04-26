"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createStudentAdmin, deleteStudentAdmin } from "@/app/actions/student";
import type { StudentWithMentor } from "@/app/admin/students/page";

interface Props {
  students: StudentWithMentor[];
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function StudentManagementList({ students: init }: Props) {
  const router = useRouter();
  const [list, setList] = useState<StudentWithMentor[]>(init);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // 추가 폼
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [targetUniv, setTargetUniv] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function resetForm() {
    setShowForm(false);
    setName(""); setTargetUniv(""); setFormError(null);
  }

  async function handleDelete(s: StudentWithMentor) {
    if (s.mentor_name) {
      showToast("멘토 화면에서 먼저 담당 해제를 진행해야 삭제할 수 있습니다.", false);
      return;
    }
    if (!confirm(`'${s.name}' 학생을 완전히 삭제하시겠습니까?\n코칭 기록도 함께 삭제됩니다.`)) return;
    setBusy(s.id);
    try {
      await deleteStudentAdmin(s.id);
      setList((prev) => prev.filter((r) => r.id !== s.id));
      showToast(`'${s.name}' 학생이 삭제되었습니다.`, true);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "삭제 실패", false);
    } finally {
      setBusy(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true); setFormError(null);
    try {
      const student = await createStudentAdmin(name, targetUniv || null);
      setList((prev) => [...prev, { ...student, mentor_name: null, mentor_id: null }]);
      resetForm();
      showToast(`'${name}' 학생이 추가되었습니다.`, true);
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium text-white ${toast.ok ? "bg-gray-900" : "bg-red-500"}`}>
          {toast.ok
            ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {toast.msg}
        </div>
      )}

      {/* 총 인원 */}
      <p className="text-sm text-gray-500">
        전체 {list.length}명
        {list.filter((s) => !s.mentor_name).length > 0 && (
          <span className="ml-2 text-red-500 font-medium">
            · 미배정 {list.filter((s) => !s.mentor_name).length}명
          </span>
        )}
      </p>

      {/* 학생 테이블 */}
      {list.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-8 py-12 text-center">
          <p className="text-sm text-gray-400">등록된 학생이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[5%]">#</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[18%]">이름</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[22%]">목표 대학</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[18%]">담당 멘토</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[10%]">상태</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[14%]">등록일</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 w-[13%]">관리</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${i !== list.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <td className="px-5 py-3.5 text-gray-300 text-xs">{i + 1}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    <Link href={`/admin/students/${s.id}`} className="hover:underline underline-offset-2">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.target_university ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3.5">
                    {s.mentor_name ? (
                      <span className="text-gray-700 font-medium">{s.mentor_name}</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-500 border border-red-100">
                        미배정
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {s.status === "inactive" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-400">퇴원</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600">재원</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(s.created_at)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={busy === s.id}
                      title={s.mentor_name ? "담당 해제 후 삭제 가능" : "학생 삭제"}
                      className={`px-3 py-1 rounded-md border text-xs font-medium transition-colors
                        ${s.mentor_name
                          ? "border-gray-100 text-gray-300 cursor-not-allowed"
                          : "border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500"
                        } disabled:opacity-40`}
                    >
                      {busy === s.id ? "삭제 중…" : "삭제"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 학생 추가 폼 */}
      {showForm ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">학생 추가 (멘토 미배정)</h4>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">학생 이름 *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동"
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition" />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">목표 대학</label>
                <input value={targetUniv} onChange={(e) => setTargetUniv(e.target.value)} placeholder="서울대학교 (선택)"
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition" />
              </div>
            </div>
            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={adding}
                className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition">
                {adding ? "저장 중…" : "저장"}
              </button>
              <button type="button" onClick={resetForm}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition">
                취소
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition">
          + 학생 추가
        </button>
      )}
    </div>
  );
}
