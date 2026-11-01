import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. Copiez .env.example vers .env.local après `supabase start`.",
  );
}

export const supabase = createClient(url ?? "", anon ?? "");

export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    throw new Error(error.message);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data as T;
}
