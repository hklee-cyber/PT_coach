"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Check, X } from "lucide-react";
import { deleteAdmin, createAccountDirect, updateAdmin } from "@/app/actions/approve-user";

interface AdminRow {
  id: string;
  full_name: string | null;
  password_plain: string;
  created_at: string;
}

interface Props {
  admins: AdminRow[];
  currentUserId: string;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function ManagerList({ admins: init, currentUserId }: Props) {
  const router = useRouter();
  const [list, setList] = useState<AdminRow[]>(init);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // 비밀번호 표시 토글 (row id 기준)
  const [showPw, setShowPw] = useState<Set<string>>(new Set());

  // 인라인 편집 상태
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPw, setEditPw] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 추가 폼
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPw, setNewPw] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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

  // ── 편집 시작 ────────────────────────────────────────────────
  function startEdit(row: AdminRow) {
    setEditId(row.id);
    setEditName(row.full_name ?? "");
    setEditPw(row.password_plain);
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName("");
    setEditPw("");
    setEditError(null);
  }

  async function commitEdit(row: AdminRow) {
    if (!editName.trim()) { setEditError("이름을 입력하세요."); return; }
    if (editPw.length < 4) { setEditError("비밀번호는 4자리 이상이어야 합니다."); return; }
    setSaving(true); setEditError(null);
    try {
      await updateAdmin(row.id, editName, editPw);
      setList((prev) => prev.map((r) =>
        r.id === row.id ? { ...r, full_name: editName.trim(), password_plain: editPw } : r
      ));
      cancelEdit();
      showToast("수정되었습니다.", true);
      router.refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "수정 실패");
    } finally {
      setSaving(false);
    }
  }

  // ── 삭제 ────────────────────────────────────────────────────
  async function handleDelete(row: AdminRow) {
    if (!confirm(`'${row.full_name ?? "계정"}' 계정을 삭제하시겠습니까?\n삭제된 계정은 복구할 수 없습니다.`)) return;
    setBusy(row.id);
    try {
      await deleteAdmin(row.id);
      setList((prev) => prev.filter((r) => r.id !== row.id));
      showToast("계정이 삭제되었습니다.", true);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "삭제 실패", false);
    } finally {
      setBusy(null);
    }
  }

  // ── 추가 ────────────────────────────────────────────────────
  function resetForm() {
    setShowForm(false);
    setNewName(""); setNewPw(""); setFormError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) { setFormError("이름을 입력하세요."); return; }
    if (newPw.length < 4) { setFormError("비밀번호는 4자리 이상이어야 합니다."); return; }
    setAdding(true); setFormError(null);
    try {
      await createAccountDirect(newName, "", newPw, "admin");
      setList((prev) => [...prev, {
        id: `temp-${Date.now()}`,
        full_name: newName.trim(),
        password_plain: newPw,
        created_at: new Date().toISOString(),
      }]);
      resetForm();
      showToast(`${newName} 관리자 계정이 생성되었습니다.`, true);
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

      {/* 테이블 */}
      {list.length === 0 ? (
        <p className="text-sm text-gray-400">등록된 관리자가 없습니다.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[22%]">이름</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[22%]">비밀번호</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[18%]">등록일</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-[12%]">권한</th>
                <th className="px-5 py-3 w-[26%]" />
              </tr>
            </thead>
            <tbody>
              {list.map((row, i) => {
                const isSelf = row.id === currentUserId;
                const isEditing = editId === row.id;
                const pwVisible = showPw.has(row.id);

                return (
                  <tr key={row.id} className={`align-middle ${i !== list.length - 1 ? "border-b border-gray-50" : ""}`}>
                    {/* 이름 */}
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <span className="font-medium text-gray-900">{row.full_name ?? "—"}</span>
                      )}
                    </td>

                    {/* 비밀번호 */}
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          value={editPw}
                          onChange={(e) => setEditPw(e.target.value)}
                          placeholder="새 비밀번호"
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-700 text-sm tracking-widest">
                            {row.password_plain
                              ? (pwVisible ? row.password_plain : "•".repeat(row.password_plain.length))
                              : <span className="text-gray-300 font-sans tracking-normal">미설정</span>
                            }
                          </span>
                          {row.password_plain && (
                            <button
                              type="button"
                              onClick={() => togglePw(row.id)}
                              className="text-gray-400 hover:text-gray-600 transition"
                              title={pwVisible ? "숨기기" : "보기"}
                            >
                              {pwVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 등록일 */}
                    <td className="px-5 py-3 text-gray-400 text-sm">
                      {formatDate(row.created_at)}
                    </td>

                    {/* 권한 */}
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-600">
                        관리자
                      </span>
                    </td>

                    {/* 액션 */}
                    <td className="px-5 py-3">
                      {isSelf ? (
                        <span className="text-xs text-gray-300 font-medium">본인</span>
                      ) : isEditing ? (
                        <div className="flex flex-col gap-1">
                          {editError && <p className="text-[11px] text-red-500">{editError}</p>}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => commitEdit(row)}
                              disabled={saving}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition active:scale-95"
                            >
                              <Check className="w-3 h-3" />
                              {saving ? "저장 중…" : "저장"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold hover:bg-gray-200 disabled:opacity-50 transition"
                            >
                              <X className="w-3 h-3" />
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(row)}
                            disabled={busy !== null || editId !== null}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition active:scale-95"
                          >
                            <Pencil className="w-3 h-3" />
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            disabled={busy !== null || editId !== null}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-md text-xs font-semibold hover:bg-red-600 disabled:opacity-40 transition active:scale-95"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 추가 폼 */}
      {showForm ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">신규 관리자 추가</h4>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">이름 *</label>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="홍길동"
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">비밀번호 *</label>
                <input
                  required
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="예) 710812"
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
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition"
        >
          + 관리자 추가
        </button>
      )}
    </div>
  );
}
