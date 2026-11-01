#!/usr/bin/env node
/**
 * Crée les comptes démo admin + user après `supabase start` / `db reset`.
 * Usage: node scripts/seed-users.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error(
    "Manque SUPABASE_SERVICE_ROLE_KEY (voir `supabase status -o env`).",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  {
    email: "admin@gakoke.local",
    password: "gakoke-admin-123",
    username: "ops",
    phone: "+22890000000",
    role: "admin",
  },
  {
    email: "demo@gakoke.local",
    password: "gakoke-demo-123",
    username: "demo",
    phone: "+22890111111",
    role: "user",
  },
];

for (const u of users) {
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find((x) => x.email === u.email);

  let userId = found?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: {
        username: u.username,
        phone: u.phone,
        role: u.role === "admin" ? "user" : u.role,
      },
    });
    if (error) {
      console.error(`Création ${u.email}:`, error.message);
      continue;
    }
    userId = data.user.id;
    console.log(`Créé ${u.email}`);
  } else {
    console.log(`Existe déjà ${u.email}`);
  }

  // Force role (trigger may have set user from metadata; admin must be explicit)
  const { error: profErr } = await admin
    .from("profiles")
    .update({
      username: u.username,
      phone: u.phone,
      role: u.role,
    })
    .eq("id", userId);

  if (profErr) {
    console.error(`Profil ${u.email}:`, profErr.message);
  } else {
    console.log(`Profil OK ${u.email} (${u.role})`);
  }

  if (u.role === "user") {
    const { data: platform } = await admin
      .from("platforms")
      .select("id")
      .eq("active", true)
      .maybeSingle();

    if (platform) {
      await admin.from("player_accounts").upsert(
        {
          user_id: userId,
          platform_id: platform.id,
          player_id: "100200300",
          label: "Compte démo",
          verified: false,
        },
        { onConflict: "user_id,platform_id,player_id" },
      );
      console.log("ID joueur démo prêt");
    }
  }
}

console.log("\nComptes démo :");
console.log("  admin@gakoke.local / gakoke-admin-123");
console.log("  demo@gakoke.local  / gakoke-demo-123");
