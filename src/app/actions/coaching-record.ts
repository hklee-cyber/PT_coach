"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CoachingContent } from "@/types/database";

export async function deleteCoachingRecord(id: string, studentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("coaching_records").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/mentor/students/${studentId}`);
  revalidatePath(`/admin/students/${studentId}`);
}

export async function updateCoachingRecord(id: string, content: CoachingContent, studentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("coaching_records").update({ content }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/mentor/students/${studentId}`);
  revalidatePath(`/admin/students/${studentId}`);
}

export async function saveCoachingRecord(
  studentId: string,
  mentorId: string,
  date: string,
  content: CoachingContent
) {
  const supabase = await createClient();

  const { error } = await supabase.from("coaching_records").upsert(
    { student_id: studentId, mentor_id: mentorId, date, content },
    { onConflict: "student_id,date" }
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/mentor/students/${studentId}`);
  return { success: true };
}
