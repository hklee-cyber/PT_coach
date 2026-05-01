"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { createStudentAdmin, deleteStudentAdmin, upsertStudentsFromExcel } from "@/app/actions/student";
import type { StudentWithMentor } from "@/app/admin/students/page";

interface Props {
  students: StudentWithMentor[];
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 엑셀에서 추출할 컬럼명
const COL_NAME = "이름";
const COL_SEAT = "좌석";

export default function StudentManagementList({ students: init }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [list, setList] = useState<StudentWithMentor[]>(init);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);

  // 검색
  const [search, setSearch] = useState("");

  // 학생 추가 폼
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
    setName("");
    setTargetUniv("");
    setFormError(null);
  }

  // ── 검색 필터 ───────────────────────────────────────────────
  const filtered = search.trim()
    ? list.filter((s) => s.name.includes(search.trim()))
    : list;

  // ── 삭제 ────────────────────────────────────────────────────
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

  // ── 학생 추가 ────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setFormError(null);
    try {
      const student = await createStudentAdmin(name, targetUniv || null);
      setList((prev) => [
        ...prev,
        { ...student, seat: null, mentor_name: null, mentor_id: null },
      ]);
      resetForm();
      showToast(`'${name}' 학생이 추가되었습니다.`, true);
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setAdding(false);
    }
  }

  // ── 엑셀 업로드 ──────────────────────────────────────────────
  function handleExcelButtonClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 인풋 초기화 (같은 파일 재업로드 허용)
    e.target.value = "";

    setExcelLoading(true);
    try {
      const rows = await parseExcel(file);
      if (rows.length === 0) {
        showToast("엑셀에서 유효한 데이터를 찾을 수 없습니다. '이름' 컬럼이 있는지 확인해주세요.", false);
        return;
      }

      const updatedStudents = await upsertStudentsFromExcel(rows);

      // mentor 정보 유지하며 목록 갱신
      const mentorMap = new Map(list.map((s) => [s.id, { mentor_name: s.mentor_name, mentor_id: s.mentor_id }]));
      const newList: StudentWithMentor[] = updatedStudents.map((s) => ({
        ...s,
        mentor_name: mentorMap.get(s.id)?.mentor_name ?? null,
        mentor_id: mentorMap.get(s.id)?.mentor_id ?? null,
      }));
      setList(newList);

      showToast(
        `엑셀 반영 완료: 기존 ${rows.filter((r) => list.some((s) => s.name === r.name)).length}명 좌석 업데이트 / 신규 ${rows.filter((r) => !list.some((s) => s.name === r.name)).length}명 추가`,
        true
      );
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "엑셀 처리 중 오류가 발생했습니다.", false);
    } finally {
      setExcelLoading(false);
    }
  }

  async function parseExcel(file: File): Promise<{ name: string; seat: string | null }[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          // header: 1 → 첫 행을 헤더로 사용한 배열 배열 반환
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: "",
          });

          const result = jsonRows
            .map((row) => {
              const rawName = row[COL_NAME];
              const rawSeat = row[COL_SEAT];
              const nameStr = typeof rawName === "string" ? rawName.trim() : String(rawName ?? "").trim();
              const seatStr = rawSeat !== undefined && rawSeat !== "" ? String(rawSeat).trim() : null;
              return { name: nameStr, seat: seatStr };
            })
            .filter((r) => r.name.length > 0);

          resolve(result);
        } catch (err) {
          reject(new Error("파일 파싱 실패: " + (err instanceof Error ? err.message : String(err))));
        }
      };
      reader.onerror = () => reject(new Error("파일을 읽는 중 오류가 발생했습니다."));
      reader.readAsArrayBuffer(file);
    });
  }

  return (
    <div className="space-y-4">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium text-white
            ${toast.ok ? "bg-gray-900" : "bg-red-500"}`}
        >
          {toast.ok ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.msg}
        </div>
      )}

      {/* 상단: 인원 수 + 검색/엑셀 */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-500 mt-2">
          전체 {list.length}명
          {list.filter((s) => !s.mentor_name).length > 0 && (
            <span className="ml-2 text-red-500 font-medium">
              · 미배정 {list.filter((s) => !s.mentor_name).length}명
            </span>
          )}
          {search.trim() && (
            <span className="ml-2 text-blue-500 font-medium">
              · 검색 결과 {filtered.length}명
            </span>
          )}
        </p>

        {/* 검색 + 엑셀 버튼 영역 */}
        <div className="flex items-center gap-2">
          {/* 검색 Input */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="학생 검색"
              className="w-44 pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white
                focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
            />
          </div>

          {/* 엑셀 불러오기 버튼 */}
          <button
            onClick={handleExcelButtonClick}
            disabled={excelLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap
              border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300
              disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {excelLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                처리 중…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 8l-3-3m3 3l3-3"
                  />
                </svg>
                엑셀 불러오기
              </>
            )}
          </button>

          {/* 숨겨진 파일 인풋 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* 학생 테이블 */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-8 py-12 text-center">
          <p className="text-sm text-gray-400">
            {search.trim() ? `'${search}' 검색 결과가 없습니다.` : "등록된 학생이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[8%]">좌석</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[16%]">이름</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[20%]">목표 대학</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[18%]">담당 멘토</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[10%]">상태</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[14%]">등록일</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 w-[14%]">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    i !== filtered.length - 1 ? "border-b border-gray-50" : ""
                  }`}
                >
                  {/* 좌석 */}
                  <td className="px-5 py-3.5">
                    {s.seat ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                        {s.seat}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* 이름 */}
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    <Link
                      href={`/admin/students/${s.id}`}
                      className="hover:underline underline-offset-2"
                    >
                      {s.name}
                    </Link>
                  </td>

                  {/* 목표 대학 */}
                  <td className="px-5 py-3.5 text-gray-500">
                    {s.target_university ?? <span className="text-gray-300">—</span>}
                  </td>

                  {/* 담당 멘토 */}
                  <td className="px-5 py-3.5">
                    {s.mentor_name ? (
                      <span className="text-gray-700 font-medium">{s.mentor_name}</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-500 border border-red-100">
                        미배정
                      </span>
                    )}
                  </td>

                  {/* 상태 */}
                  <td className="px-5 py-3.5">
                    {s.status === "inactive" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-400">
                        퇴원
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600">
                        재원
                      </span>
                    )}
                  </td>

                  {/* 등록일 */}
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(s.created_at)}</td>

                  {/* 관리 */}
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={busy === s.id}
                      title={s.mentor_name ? "담당 해제 후 삭제 가능" : "학생 삭제"}
                      className={`px-3 py-1 rounded-md border text-xs font-medium transition-colors
                        ${
                          s.mentor_name
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
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50
                    focus:outline-none focus:border-gray-400 focus:bg-white transition"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">목표 대학</label>
                <input
                  value={targetUniv}
                  onChange={(e) => setTargetUniv(e.target.value)}
                  placeholder="서울대학교 (선택)"
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50
                    focus:outline-none focus:border-gray-400 focus:bg-white transition"
                />
              </div>
            </div>
            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding}
                className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold
                  hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {adding ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold
                  hover:bg-gray-200 transition"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400
            hover:border-gray-400 hover:text-gray-600 transition"
        >
          + 학생 추가
        </button>
      )}
    </div>
  );
}
