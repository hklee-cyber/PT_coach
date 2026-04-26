"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signUpUser } from "@/app/actions/sign-up";

export default function SignupPage() {

  const [fullName,        setFullName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pwTouched,       setPwTouched]       = useState(false); // 비밀번호 입력 여부
  const [confirmTouched,  setConfirmTouched]  = useState(false); // 확인란 입력 여부
  const [submitError,     setSubmitError]     = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);

  // ── 실시간 검증 ──────────────────────────────────────
  const pwLengthError   = pwTouched && password.length > 0 && password.length !== 6;
  const pwMatchError    = confirmTouched && passwordConfirm.length > 0 && password !== passwordConfirm;
  const isFormInvalid   = password.length !== 6 || password !== passwordConfirm;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    // 제출 시 한 번 더 검증 (disabled 우회 방어)
    if (password.length !== 6) {
      setSubmitError("비밀번호는 정확히 6자리로 설정해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setSubmitError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    // 서버 액션 호출 — admin API 사용으로 자동 세션 없음, service role로 role=null 확정
    const { error: signUpError } = await signUpUser(fullName, email, password);

    if (signUpError) {
      setSubmitError(signUpError);
      setLoading(false);
      return;
    }

    setLoading(false);
    setDone(true);

    // 하드 리다이렉트: 세션이 없으므로 /pending(공개 경로)으로 바로 이동
    setTimeout(() => {
      window.location.replace("/pending");
    }, 1500);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
        <div className="w-full max-w-[600px] bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.10)] px-16 py-14 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[18px] font-bold text-gray-900 leading-relaxed">
            가입 신청이 완료되었습니다.<br />
            관리자 승인 후 이용 가능합니다.
          </p>
          <p className="text-sm text-gray-400">잠시 후 승인 대기 페이지로 이동합니다…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
      <div className="w-full max-w-[600px] bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.10)] px-16 py-14 flex flex-col items-center gap-0">

        {/* 로고 */}
        <Image
          src="/logo.png"
          alt="뉴퍼센트 스파르타 로고"
          width={320}
          height={100}
          priority
          className="object-contain"
        />

        {/* 타이틀 */}
        <p className="mt-10 mb-9 text-[22px] font-bold text-gray-900 text-center leading-normal tracking-tight">
          회원가입
        </p>

        {/* 폼 */}
        <form onSubmit={handleSignup} className="w-full flex flex-col gap-4">

          {/* 이름 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fullName" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              이름 (성함)
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:bg-white transition-all duration-200"
            />
          </div>

          {/* 이메일 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              이메일 주소
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:bg-white transition-all duration-200"
            />
          </div>

          {/* 비밀번호 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwTouched(true); }}
              placeholder="정확히 6자리를 입력하세요"
              className={`w-full px-4 py-3.5 rounded-2xl border bg-gray-50 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:bg-white transition-all duration-200 ${
                pwLengthError ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-gray-400"
              }`}
            />
            {pwLengthError && (
              <p className="text-xs text-red-500 font-medium px-1">
                비밀번호는 정확히 6자리로 설정해 주세요.
              </p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="passwordConfirm" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              비밀번호 확인
            </label>
            <input
              id="passwordConfirm"
              type="password"
              required
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => { setPasswordConfirm(e.target.value); setConfirmTouched(true); }}
              placeholder="비밀번호를 다시 입력하세요"
              className={`w-full px-4 py-3.5 rounded-2xl border bg-gray-50 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:bg-white transition-all duration-200 ${
                pwMatchError ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-gray-400"
              }`}
            />
            {pwMatchError && (
              <p className="text-xs text-red-500 font-medium px-1">
                비밀번호가 일치하지 않습니다.
              </p>
            )}
          </div>

          {/* 제출 오류 메시지 (서버 응답 오류) */}
          {submitError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-red-500 font-medium">{submitError}</p>
            </div>
          )}

          {/* 가입 버튼 */}
          <button
            type="submit"
            disabled={loading || isFormInvalid}
            className="w-full py-4 mt-1 rounded-2xl bg-gray-900 text-white text-sm font-bold tracking-wide hover:bg-gray-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                처리 중...
              </>
            ) : (
              "가입 신청하기"
            )}
          </button>
        </form>

        {/* 로그인 링크 */}
        <p className="mt-8 text-xs text-gray-400">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-gray-500 font-semibold hover:text-gray-700 transition-colors underline underline-offset-2">
            로그인하기
          </Link>
        </p>
      </div>
    </div>
  );
}
