"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { findEmailByName } from "@/app/actions/auth";

interface Props {
  mentorName: string;
}

export default function PasswordChangeForm({ mentorName }: Props) {
  const [open,        setOpen]        = useState(false);
  const [currentPw,  setCurrentPw]   = useState("");
  const [newPw,      setNewPw]       = useState("");
  const [confirmPw,  setConfirmPw]   = useState("");
  const [loading,    setLoading]     = useState(false);
  const [success,    setSuccess]     = useState(false);
  const [error,      setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPw.length < 6) { setError("새 비밀번호는 6자리 이상이어야 합니다."); return; }
    if (newPw !== confirmPw) { setError("새 비밀번호가 일치하지 않습니다."); return; }

    setLoading(true);
    try {
      const supabase = createClient();

      // 1. 현재 비밀번호 재확인 — 이름으로 이메일 조회 후 재로그인
      const result = await findEmailByName(mentorName);
      if ("error" in result) throw new Error(result.error);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: currentPw,
      });
      if (signInError) throw new Error("현재 비밀번호가 올바르지 않습니다.");

      // 2. 비밀번호 업데이트
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) throw new Error(updateError.message);

      setSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setSuccess(false); setOpen(false); }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "변경 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setError(null); setSuccess(false); }}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
          </div>
          <p className="text-sm font-bold text-gray-900">비밀번호 변경</p>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 px-5 py-5 space-y-3">
          {[
            { id: "cur",  label: "현재 비밀번호", val: currentPw, setter: setCurrentPw },
            { id: "new",  label: "새 비밀번호 (6자리 이상)", val: newPw, setter: setNewPw },
            { id: "conf", label: "새 비밀번호 확인", val: confirmPw, setter: setConfirmPw },
          ].map(({ id, label, val, setter }) => (
            <div key={id} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-xs font-semibold text-gray-500">{label}</label>
              <input
                id={id}
                type="password"
                required
                value={val}
                onChange={(e) => setter(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition"
              />
            </div>
          ))}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              ✓ 비밀번호가 변경되었습니다.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? "변경 중…" : "변경하기"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-bold rounded-md hover:bg-gray-200 transition"
            >
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
