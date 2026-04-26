/**
 * 초기 관리자 3인 계정 생성 스크립트
 *
 * 사용법:
 *   node scripts/seed-admins.mjs
 *
 * .env.local 파일에 아래 변수가 설정되어 있어야 합니다:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── .env.local 수동 로드 ─────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local 없으면 이미 설정된 환경변수 사용
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 초기 관리자 목록 ─────────────────────────────────────────
const ADMINS = [
  { name: "이은미",   password: "710812" },
  { name: "이훈기",   password: "690426" },
  { name: "뉴퍼센트", password: "250601" },
];

// 이름으로 내부 이메일 생성 (실제 사용하지 않음)
function makeEmail(name) {
  const slug = Buffer.from(name, "utf-8").toString("hex");
  return `admin_${slug}@nims.internal`;
}

async function seedAdmin({ name, password }) {
  const email = makeEmail(name);
  console.log(`\n⏳  ${name} (${email}) 생성 중...`);

  // 1. 이미 존재하는지 확인
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("full_name", name)
    .eq("role", "admin");

  if (existing && existing.length > 0) {
    console.log(`   ⚠️  이미 존재합니다 (id: ${existing[0].id}). 건너뜁니다.`);
    return;
  }

  // 2. auth.users 생성
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authErr) {
    // 이메일 중복이면 기존 유저 찾아서 프로필만 업데이트
    if (authErr.message.includes("already") || authErr.message.includes("exists")) {
      console.log(`   ℹ️  auth 계정 이미 존재. 프로필 동기화 시도...`);
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const found = users?.users?.find((u) => u.email === email);
      if (!found) {
        console.error(`   ❌  auth 유저를 찾지 못했습니다.`);
        return;
      }
      await admin.from("profiles").upsert({
        id: found.id,
        full_name: name,
        role: "admin",
        password_plain: password,
      }, { onConflict: "id" });
      console.log(`   ✅  프로필 동기화 완료 (id: ${found.id})`);
      return;
    }
    console.error(`   ❌  auth 생성 실패: ${authErr.message}`);
    return;
  }

  // 3. profiles upsert
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: created.user.id,
    full_name: name,
    role: "admin",
    password_plain: password,
  }, { onConflict: "id" });

  if (profileErr) {
    console.error(`   ❌  profiles 저장 실패: ${profileErr.message}`);
    await admin.auth.admin.deleteUser(created.user.id);
    return;
  }

  console.log(`   ✅  완료 (id: ${created.user.id})`);
}

(async () => {
  console.log("🚀  NIMS 초기 관리자 계정 생성 시작\n");
  for (const admin_entry of ADMINS) {
    await seedAdmin(admin_entry);
  }
  console.log("\n✨  완료!\n");
})();
