"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createAndAssignStudent,
  assignExistingStudent,
  unassignStudent,
  searchStudents,
} from "@/app/actions/student";
import type { Student } from "@/types/database";

interface Props {
  students: Student[];
  mentorId: string;
  assignedIds: string[];        // 이미 배정된 학생 ID (검색 시 제외용)
}

type AddTab = "new" | "existing";

export default function StudentList({ students: init, mentorId, assignedIds: initAssigned }: Props) {
  const router = useRouter();

  const [students,    setStudents]    = useState<Student[]>(init);
  const [assigned,    setAssigned]    = useState<string[]>(initAssigned);
  const [showForm,    setShowForm]    = useState(false);
  const [tab,         setTab]         = useState<AddTab>("new");
  const [loading,     setLoading]     = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // 신규 등록 폼
  const [name,        setName]        = useState("");
  const [targetUniv,  setTargetUniv]  = useState("");

  // 기존 학생 검색
  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState<Pick<Student, "id" | "name" | "target_university">[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [selected,    setSelected]    = useState<Pick<Student, "id" | "name"> | null>(null);
  const [showDrop,    setShowDrop]    = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function closeForm() {
    setShowForm(false);
    setError(null);
    setName(""); setTargetUniv("");
    setQuery(""); setResults([]); setSelected(null);
  }

  // ── 신규 학생 등록 ─────────────────────────────────────────
  async function handleCreateNew(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const student = await createAndAssignStudent(mentorId, name, targetUniv || null);
      setStudents((prev) => [...prev, student]);
      setAssigned((prev) => [...prev, student.id]);
      closeForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ── 검색 (디바운스 200 ms) ────────────────────────────────
  function handleQueryChange(val: string) {
    setQuery(val);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const data = await searchStudents(val, assigned);
      setResults(data);
      setShowDrop(true);
      setSearching(false);
    }, 200);
  }

  // ── 기존 학생 배정 ─────────────────────────────────────────
  async function handleAssignExisting() {
    if (!selected) return;
    setLoading(true); setError(null);
    try {
      await assignExistingStudent(selected.id, mentorId);
      // students 목록에 추가하려면 전체 Student 데이터가 필요
      // results에는 id/name/target_university만 있으므로 created_at을 채워서 추가
      const found = results.find((r) => r.id === selected.id);
      if (found) {
        setStudents((prev) => [...prev, { ...found, status: "active" as const, created_at: new Date().toISOString() }]);
        setAssigned((prev) => [...prev, selected.id]);
      }
      closeForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "배정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ── 배정 해제 ─────────────────────────────────────────────
  async function handleUnassign(student: Student) {
    if (!confirm(`'${student.name}' 학생을 담당 목록에서 제외하시겠습니까?\n(학생 정보와 코칭 기록은 삭제되지 않습니다)`)) return;
    setDeletingId(student.id);
    try {
      await unassignStudent(student.id, mentorId);
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      setAssigned((prev) => prev.filter((id) => id !== student.id));
      router.refresh();
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── 학생 테이블 ── */}
      {students.length === 0 && !showForm ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-8 py-16 text-center">
          <p className="text-gray-400 text-sm mb-1">담당 학생이 없습니다.</p>
          <p className="text-gray-300 text-xs">아래 버튼으로 학생을 추가하세요.</p>
        </div>
      ) : students.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 w-[5%]">#</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 w-[28%]">이름</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 w-[34%]">목표 대학</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 w-[17%]">등록일</th>
                <th className="text-center px-6 py-3.5 text-xs font-semibold text-gray-500 w-[16%]">관리</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${i !== students.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <td className="px-6 py-4 text-gray-300 text-xs">{i + 1}</td>
                  <td className="px-6 py-4">
                    <Link href={`/mentor/students/${s.id}`} className="font-semibold text-gray-900 hover:underline underline-offset-2">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{s.target_university ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(s.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {/* 담당 해제: student_mentor_relations 행만 삭제. students/coaching_records 는 보존됨 */}
                    <button
                      onClick={() => handleUnassign(s)}
                      disabled={deletingId === s.id}
                      title="담당 해제 (학생 데이터·코칭 기록은 삭제되지 않습니다)"
                      className="px-3 py-1 rounded-md border text-xs font-medium whitespace-nowrap transition-colors
                        border-gray-200 text-gray-400
                        hover:border-orange-200 hover:text-orange-500
                        disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {deletingId === s.id ? "처리 중…" : "담당 해제"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* ── 학생 추가 폼 ── */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* 탭 */}
          <div className="flex border-b border-gray-100">
            {(["new", "existing"] as AddTab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "bg-white text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-400 hover:text-gray-600 bg-gray-50"
                }`}
              >
                {t === "new" ? "신규 등록" : "기존 학생 불러오기"}
              </button>
            ))}
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* ── 신규 등록 ── */}
            {tab === "new" && (
              <form onSubmit={handleCreateNew} className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500">학생 이름 *</label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="홍길동"
                      className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500">목표 대학</label>
                    <input
                      value={targetUniv}
                      onChange={(e) => setTargetUniv(e.target.value)}
                      placeholder="서울대학교 (선택)"
                      className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition"
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition">
                    {loading ? "저장 중…" : "저장"}
                  </button>
                  <button type="button" onClick={closeForm} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition">
                    취소
                  </button>
                </div>
              </form>
            )}

            {/* ── 기존 학생 검색 ── */}
            {tab === "existing" && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5" ref={searchRef}>
                  <label className="text-xs font-semibold text-gray-500">학생 이름 검색</label>
                  <div className="relative">
                    <input
                      value={query}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      onFocus={() => results.length > 0 && setShowDrop(true)}
                      placeholder="이름을 입력하면 자동완성됩니다"
                      className="w-full px-4 py-2.5 pr-9 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition"
                    />
                    {searching && (
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    )}

                    {/* 드롭다운 */}
                    {showDrop && results.length > 0 && (
                      <ul className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        {results.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => { setSelected({ id: r.id, name: r.name }); setQuery(r.name); setShowDrop(false); }}
                              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition text-left"
                            >
                              <span className="font-medium text-gray-900">{r.name}</span>
                              {r.target_university && (
                                <span className="text-xs text-gray-400 ml-2">목표: {r.target_university}</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {showDrop && !searching && results.length === 0 && query.trim() && (
                      <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
                        검색 결과가 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                {selected && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">선택된 학생 · 기존 코칭 기록이 모두 이어집니다</p>
                    </div>
                    <button onClick={() => { setSelected(null); setQuery(""); }} className="text-xs text-gray-400 hover:text-gray-600">
                      취소
                    </button>
                  </div>
                )}

                {error && <p className="text-xs text-red-500">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!selected || loading}
                    onClick={handleAssignExisting}
                    className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 transition"
                  >
                    {loading ? "처리 중…" : "담당으로 추가"}
                  </button>
                  <button type="button" onClick={closeForm} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition">
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 학생 추가 버튼 ── */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition"
        >
          + 학생 추가
        </button>
      )}
    </div>
  );
}
