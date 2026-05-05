"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Pencil, Check, X } from "lucide-react";
import {
  approveUser,
  rejectUser,
  deleteMentor,
  createAccountDirect,
  updateMentorPassword,
} from "@/app/actions/approve-user";

interface MentorRow {
  id: string;
  full_name: string | null;
  password_plain: string;
  created_at: string;
  studentCount: number;
}

interface PendingRow {
  id: string;
  full_name: string | null;
  created_at: string;
}

interface Props {
  mentors: MentorRow[];
  pendingUsers: PendingRow[];
  currentUserId: string;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function MentorManagementList({
  mentors: initMentors,
  pendingUsers: initPending,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [mentorList, setMentorList] = useState<MentorRow[]>(initMentors);
  const [pending,    setPending]    = useState<PendingRow[]>(initPending);
  const [busy,       setBusy]       = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

  // 비밀번호 표시 토글 (row id 기준)
  const [showPw, setShowPw] = useState<Set<string>>(new Set());

  // 인라인 비밀번호 편집 상태
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editPw,    setEditPw]    = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  // 멘토 추가 폼
  const [showForm,   setShowForm]   = useState(false);
  const [name,       setName]       = useState("");
  const [password,   setPassword]   = useState("");
  const [formError,  setFormError]  = useState<string | null>(null);
  const [adding,     setAdding]     = useState(false);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function togglePw(id: string) {
    setShowPw((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── 인라인 비밀번호 편집 ─────────────────────────────────────
  function startEdit(row: MentorRow) {
    setEditId(row.id);
    setEditPw(row.password_plain);
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditPw("");
    setEditError(null);
  }

  async function commitEdit(row: MentorRow) {
    if (editPw.length < 4) {
      setEditError("비밀번호는 4자리 이상이어야 합니다.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await updateMentorPassword(row.id, editPw);
      setMentorList((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, password_plain: editPw } : r))
      );
      cancelEdit();
      showToast("비밀번호가 변경되었습니다.", true);
      router.refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "변경 실패");
    } finally {
      setSaving(false);
    }
  }

  // ── 승인 / 거절 ─────────────────────────────────────────────
  async function handleApprove(u: PendingRow) {
    setBusy(u.id + "-approve");
    try {
      await approveUser(u.id, "mentor");
      setPending((prev) => prev.filter((r) => r.id !== u.id));
      setMentorList((prev) => [
        { id: u.id, full_name: u.full_name, password_plain: "", created_at: u.created_at, studentCount: 0 },
        ...prev,
      ]);
      showToast(`${u.full_name ?? "사용자"}님이 승인되었습니다.`, true);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "승인 실패", false);
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(u: PendingRow) {
    if (!confirm("가입 신청을 거절하고 계정을 삭제하시겠습니까?")) return;
    setBusy(u.id + "-reject");
    try {
      await rejectUser(u.id);
      setPending((prev) => prev.filter((r) => r.id !== u.id));
      showToast(`${u.full_name ?? "사용자"}님의 가입이 거절되었습니다.`, true);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "거절 실패", false);
    } finally {
      setBusy(null);
    }
  }

  // ── 계정 삭제 ────────────────────────────────────────────────
  async function handleDelete(u: MentorRow) {
    if (!confirm(`'${u.full_name ?? "계정"}' 멘토를 삭제하시겠습니까?`)) return;
    setBusy(u.id + "-delete");
    try {
      await deleteMentor(u.id);
      setMentorList((prev) => prev.filter((r) => r.id !== u.id));
      showToast("계정이 삭제되었습니다.", true);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "삭제 실패", false);
    } finally {
      setBusy(null);
    }
  }

  // ── 멘토 추가 ────────────────────────────────────────────────
  function resetForm() {
    setShowForm(false);
    setName("");
    setPassword("");
    setFormError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())          { setFormError("이름을 입력해주세요."); return; }
    if (password.length < 4)   { setFormError("비밀번호는 4자리 이상이어야 합니다."); return; }
    setAdding(true);
    setFormError(null);
    try {
      // 이메일은 내부 자동 생성 (빈 문자열 전달)
      await createAccountDirect(name, "", password, "mentor");
      setMentorList((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          full_name: name.trim(),
          password_plain: password,
          created_at: new Date().toISOString(),
          studentCount: 0,
        },
      ]);
      resetForm();
      showToast(`${name} 멘토 계정이 생성되었습니다.`, true);
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium text-white ${
            toast.ok ? "bg-gray-900" : "bg-red-500"
          }`}
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

      {/* ── 가입 승인 대기 ─────────────────────────────────────── */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-700">가입 승인 대기</h3>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 text-white text-[11px] font-bold">
              {pending.length}
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-yellow-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-yellow-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[30%]">이름</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[24%]">신청일</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {pending.map((u, i) => (
                  <tr key={u.id} className={i !== pending.length - 1 ? "border-b border-gray-50" : ""}>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{u.full_name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-gray-400">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleApprove(u)}
                          disabled={busy !== null}
                          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 disabled:opacity-40 transition"
                        >
                          {busy === u.id + "-approve" ? "처리 중…" : "승인"}
                        </button>
                        <button
                          onClick={() => handleReject(u)}
                          disabled={busy !== null}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 disabled:opacity-40 transition"
                        >
                          {busy === u.id + "-reject" ? "처리 중…" : "거절"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 멘토 목록 ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="font-semibold text-gray-700">멘토 목록</h3>

        {mentorList.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 멘토가 없습니다.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-indigo-100 bg-indigo-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-indigo-500 w-[18%]">이름</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-indigo-500 w-[28%]">비밀번호</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-indigo-500 w-[16%]">가입일</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-indigo-500 w-[12%]">담당 학생</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {mentorList.map((u, i) => {
                  const isSelf    = u.id === currentUserId;
                  const isEditing = editId === u.id;
                  const pwVisible = showPw.has(u.id);

                  return (
                    <tr
                      key={u.id}
                      className={`align-middle transition-colors hover:bg-indigo-50/40 ${
                        i % 2 === 1 ? "bg-slate-50/60" : "bg-white"
                      } ${i !== mentorList.length - 1 ? "border-b border-indigo-50" : ""}`}
                    >
                      {/* 이름 */}
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/mentors/${u.id}`}
                          className="font-semibold text-indigo-700 hover:underline underline-offset-2"
                        >
                          {u.full_name ?? "—"}
                        </Link>
                      </td>

                      {/* 비밀번호 */}
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <input
                              value={editPw}
                              onChange={(e) => setEditPw(e.target.value)}
                              placeholder="새 비밀번호"
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            />
                            {editError && (
                              <p className="text-[11px] text-red-500">{editError}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <button
                                onClick={() => commitEdit(u)}
                                disabled={saving}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition active:scale-95"
                              >
                                <Check className="w-3 h-3" />
                                {saving ? "저장 중…" : "저장"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold hover:bg-gray-200 disabled:opacity-50 transition"
                              >
                                <X className="w-3 h-3" />
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-700 text-sm tracking-widest">
                              {u.password_plain ? (
                                pwVisible ? u.password_plain : "•".repeat(u.password_plain.length)
                              ) : (
                                <span className="text-gray-300 font-sans tracking-normal text-xs">미설정</span>
                              )}
                            </span>
                            {u.password_plain && (
                              <button
                                type="button"
                                onClick={() => togglePw(u.id)}
                                className="text-gray-400 hover:text-gray-600 transition shrink-0"
                                title={pwVisible ? "숨기기" : "비밀번호 보기"}
                              >
                                {pwVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(u)}
                              disabled={editId !== null || busy !== null}
                              className="text-gray-400 hover:text-blue-500 transition disabled:opacity-30 shrink-0"
                              title="비밀번호 변경"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 가입일 */}
                      <td className="px-5 py-3.5 text-slate-400 text-sm">
                        {formatDate(u.created_at)}
                      </td>

                      {/* 담당 학생 수 */}
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold">
                          {u.studentCount}명
                        </span>
                      </td>

                      {/* 액션 */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/mentors/${u.id}`}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition"
                          >
                            학생 보기
                          </Link>
                          {isSelf ? (
                            <span className="text-xs text-gray-300 font-medium px-3">본인</span>
                          ) : (
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={busy !== null || editId !== null}
                              className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-40 transition"
                            >
                              {busy === u.id + "-delete" ? "삭제 중…" : "계정 삭제"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 멘토 추가 폼 ──────────────────────────────────────── */}
        {showForm ? (
          <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 space-y-4">
            <h4 className="text-sm font-semibold text-gray-700">신규 멘토 추가</h4>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-500">이름 *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="김선생"
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-500">비밀번호 *</label>
                  <input
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="예) 123456"
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition active:scale-95"
                >
                  {adding ? "생성 중…" : "생성"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition"
          >
            + 멘토 추가
          </button>
        )}
      </section>
    </div>
  );
}
