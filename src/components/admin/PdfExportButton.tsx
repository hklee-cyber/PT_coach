"use client";

import { useState } from "react";

interface Props {
  report: string;
  studentName: string;
}

/** ArrayBuffer → Base64 (대용량 청크 방식) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.slice(i, i + CHUNK) as unknown as number[]
    );
  }
  return btoa(binary);
}

// ── 마크다운 → HTML 변환 ─────────────────────────────────────────
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const safe = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const line = safe
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, "<code>$1</code>");

    if (raw.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${line.slice(3)}</h2>`);
    } else if (raw.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${line.slice(4)}</h3>`);
    } else if (raw.startsWith("- ") || raw.startsWith("• ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${line.slice(2)}</li>`);
    } else if (raw.startsWith("> ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<blockquote>${line.slice(2)}</blockquote>`);
    } else if (raw.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("<br/>");
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${line}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

// ── 보고서 CSS ────────────────────────────────────────────────────
const REPORT_STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'NanumGothic', 'Malgun Gothic', sans-serif;
    font-size: 13px;
    line-height: 1.9;
    color: #111;
    background: #fff;
    word-break: keep-all;
    word-wrap: break-word;
  }
  .wrap { padding: 48px 52px; }
  .r-header {
    border-bottom: 2px solid #111;
    padding-bottom: 14px;
    margin-bottom: 28px;
  }
  .r-title  { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
  .r-meta   { font-size: 12px; color: #555; }
  .r-meta span { margin-right: 24px; }
  h2 {
    font-size: 15px; font-weight: 700;
    margin: 26px 0 10px;
    border-left: 4px solid #333;
    padding-left: 10px;
  }
  h3 { font-size: 13px; font-weight: 600; margin: 16px 0 6px; }
  p  { margin: 5px 0; }
  ul { margin: 4px 0 4px 24px; }
  li { margin: 4px 0; list-style: disc; }
  blockquote {
    margin: 10px 0;
    padding: 8px 14px;
    border-left: 3px solid #ccc;
    color: #555;
    background: #f9f9f9;
  }
  code {
    background: #f3f3f3;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 11px;
  }
  .r-footer {
    margin-top: 48px;
    padding-top: 12px;
    border-top: 1px solid #ddd;
    font-size: 11px;
    color: #999;
    text-align: center;
  }
`;

// ── PDF 출력 (브라우저 인쇄 대화상자 → Save as PDF) ──────────────
// document.write 방식 사용: Blob URL의 charset 오독 문제 없음
function printViaDocWrite(report: string, studentName: string) {
  const body = markdownToHtml(report);
  const date = new Date().toLocaleDateString("ko-KR");
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>AI 전략 보고서 — ${studentName}</title>
<style>
${REPORT_STYLE}
@media print { .wrap { padding: 20mm 18mm; } @page { size: A4; margin: 0; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="r-header">
    <div class="r-title">NIMS AI 전략 보고서</div>
    <div class="r-meta">
      <span><strong>학생</strong>: ${studentName}</span>
      <span><strong>발행일</strong>: ${date}</span>
    </div>
  </div>
  ${body}
  <div class="r-footer">뉴퍼센트 스파르타 · NIMS PT 코칭 시스템</div>
</div>
<script>
  window.onload = function () {
    var ready = document.fonts ? document.fonts.ready : Promise.resolve();
    ready.then(function () { window.focus(); window.print(); });
  };
<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=960,height=720,scrollbars=yes");
  if (!win) {
    alert("팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도해주세요.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ── PDF 저장 (html2canvas 캡처 → jsPDF 이미지 삽입) ─────────────
// NanumGothic 폰트를 base64로 임베딩하여 html2canvas가
// 시스템 폰트에 의존하지 않고 한글을 정확히 렌더링하도록 함.
async function downloadPdfViaCanvas(
  report: string,
  studentName: string,
  setStatus: (s: string) => void
) {
  setStatus("rendering");
  let styleEl: HTMLStyleElement | null = null;
  let container: HTMLDivElement | null = null;
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    // ── NanumGothic 폰트를 base64로 로드 ────────────────────
    const [regularBuf, boldBuf] = await Promise.all([
      fetch("/fonts/NanumGothic-Regular.ttf").then((r) => {
        if (!r.ok) throw new Error(`폰트 로드 실패: NanumGothic-Regular.ttf (HTTP ${r.status})`);
        return r.arrayBuffer();
      }),
      fetch("/fonts/NanumGothic-Bold.ttf").then((r) => {
        if (!r.ok) throw new Error(`폰트 로드 실패: NanumGothic-Bold.ttf (HTTP ${r.status})`);
        return r.arrayBuffer();
      }),
    ]);
    const regularB64 = arrayBufferToBase64(regularBuf);
    const boldB64 = arrayBufferToBase64(boldBuf);

    // ── @font-face + 보고서 CSS를 document.head에 주입 ───────
    // html2canvas는 document 전체 스타일을 참조하므로
    // head에 주입해야 폰트가 확실히 적용됨
    styleEl = document.createElement("style");
    styleEl.textContent = `
      @font-face {
        font-family: 'NanumGothic';
        src: url('data:font/truetype;base64,${regularB64}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      @font-face {
        font-family: 'NanumGothic';
        src: url('data:font/truetype;base64,${boldB64}') format('truetype');
        font-weight: bold;
        font-style: normal;
      }
      .nims-report-wrap { ${REPORT_STYLE.replace(/\*/g, ".nims-report-wrap *")} }
    `;
    document.head.appendChild(styleEl);

    // 폰트 로드 완료 대기
    if (document.fonts?.ready) await document.fonts.ready;
    // 폰트 적용 보장을 위한 추가 대기
    await new Promise((resolve) => setTimeout(resolve, 300));

    // ── 숨겨진 렌더링 컨테이너 생성 ─────────────────────────
    // A4 기준 96dpi → 794px, 인쇄 품질을 위해 scale 2 사용
    container = document.createElement("div");
    container.style.cssText = [
      "position:fixed",
      "top:0",
      "left:-9999px",
      "width:794px",
      "background:#fff",
      "font-family:'NanumGothic',sans-serif",
      "font-size:13px",
      "line-height:1.9",
      "color:#111",
    ].join(";");

    container.innerHTML = `
      <style>${REPORT_STYLE}</style>
      <div class="wrap">
        <div class="r-header">
          <div class="r-title">NIMS AI 전략 보고서</div>
          <div class="r-meta">
            <span><strong>학생</strong>: ${studentName}</span>
            <span><strong>발행일</strong>: ${new Date().toLocaleDateString("ko-KR")}</span>
          </div>
        </div>
        ${markdownToHtml(report)}
        <div class="r-footer">뉴퍼센트 스파르타 · NIMS PT 코칭 시스템</div>
      </div>`;

    document.body.appendChild(container);

    // 컨테이너 내 폰트도 확실히 로드 대기
    if (document.fonts?.ready) await document.fonts.ready;

    // ── html2canvas 캡처 ──────────────────────────────────────
    const canvas = await html2canvas(container, {
      scale: 2,           // Retina 수준 해상도
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    document.body.removeChild(container);
    container = null;
    document.head.removeChild(styleEl);
    styleEl = null;

    // ── jsPDF A4 페이지 분할 ──────────────────────────────────
    const A4_W_MM  = 210;
    const A4_H_MM  = 297;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const imgW      = canvas.width;
    const imgH      = canvas.height;
    // 캔버스의 1px = 몇 mm (A4 너비 기준)
    const mmPerPx   = A4_W_MM / imgW;
    const totalH_MM = imgH * mmPerPx;

    // 페이지 수 계산 후 각 페이지를 잘라 삽입
    const pageCount = Math.ceil(totalH_MM / A4_H_MM);

    for (let i = 0; i < pageCount; i++) {
      if (i > 0) doc.addPage();

      // 이번 페이지에 해당하는 캔버스 Y 오프셋 (px)
      const srcY  = Math.round((i * A4_H_MM) / mmPerPx);
      const srcH  = Math.min(Math.round(A4_H_MM / mmPerPx), imgH - srcY);

      // 페이지 캔버스 생성
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width  = imgW;
      pageCanvas.height = srcH;

      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, imgW, srcH);
      ctx.drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);

      const pageImg   = pageCanvas.toDataURL("image/jpeg", 0.97);
      const pageH_MM  = srcH * mmPerPx; // 마지막 페이지는 더 짧을 수 있음
      doc.addImage(pageImg, "JPEG", 0, 0, A4_W_MM, pageH_MM);
    }

    doc.save(`NIMS_Report_${studentName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    setStatus("done");

  } catch (err) {
    console.error("PDF 생성 오류:", err);
    alert(`PDF 저장 실패:\n${err instanceof Error ? err.message : String(err)}`);
    setStatus("idle");
  } finally {
    // 오류 발생 시에도 DOM 정리
    if (container && container.parentNode) container.parentNode.removeChild(container);
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }
}

// ── 상태 레이블 ────────────────────────────────────────────────
function saveLabel(status: string) {
  if (status === "rendering") return "PDF 생성 중…";
  return "PDF 저장";
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function PdfExportButton({ report, studentName }: Props) {
  const [saveStatus, setSaveStatus] = useState("idle");
  const busy = saveStatus === "rendering";

  return (
    <div className="flex items-center gap-2">
      {/* PDF 출력 — 브라우저 인쇄 대화상자 (Save as PDF) */}
      <button
        onClick={() => printViaDocWrite(report, studentName)}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg font-semibold hover:bg-gray-700 transition"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        PDF 출력
      </button>

      {/* PDF 저장 — html2canvas 캡처 방식 (한글 100% 정확) */}
      <button
        onClick={() => downloadPdfViaCanvas(report, studentName, setSaveStatus)}
        disabled={busy}
        className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 transition"
      >
        {busy ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {saveLabel(saveStatus)}
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            PDF 저장
          </>
        )}
      </button>
    </div>
  );
}
