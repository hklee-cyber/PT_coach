/**
 * jsPDF에 NanumGothic 폰트를 등록합니다.
 *
 * public/fonts/ 에 있는 TTF 파일을 fetch → ArrayBuffer → Base64 변환 후 등록.
 * 실패 시 null 대신 Error를 throw하여 호출부에서 명확히 처리할 수 있도록 함.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

const FONT_NAME = "NanumGothic";

/** ArrayBuffer → Base64 문자열 (대용량 처리용 청크 방식) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    // spread 대신 apply — TS downlevelIteration 없이도 동작
    binary += String.fromCharCode.apply(null, bytes.slice(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * jsPDF 인스턴스에 NanumGothic Regular/Bold 를 등록합니다.
 * 성공 시 폰트 이름("NanumGothic") 반환.
 * 실패 시 Error throw (호출부에서 catch 필수).
 */
export async function loadKoreanFont(doc: Doc): Promise<string> {
  const fetchFont = async (filename: string): Promise<ArrayBuffer> => {
    const res = await fetch(`/fonts/${filename}`);
    if (!res.ok) {
      throw new Error(
        `폰트 파일 로드 실패: /fonts/${filename} (HTTP ${res.status})\n` +
        "public/fonts/ 폴더에 TTF 파일이 있는지 확인해 주세요."
      );
    }
    return res.arrayBuffer();
  };

  const [regularBuf, boldBuf] = await Promise.all([
    fetchFont("NanumGothic-Regular.ttf"),
    fetchFont("NanumGothic-Bold.ttf"),
  ]);

  const regularB64 = arrayBufferToBase64(regularBuf);
  const boldB64    = arrayBufferToBase64(boldBuf);

  doc.addFileToVFS("NanumGothic-Regular.ttf", regularB64);
  doc.addFont("NanumGothic-Regular.ttf", FONT_NAME, "normal");

  doc.addFileToVFS("NanumGothic-Bold.ttf", boldB64);
  doc.addFont("NanumGothic-Bold.ttf", FONT_NAME, "bold");

  return FONT_NAME;
}
