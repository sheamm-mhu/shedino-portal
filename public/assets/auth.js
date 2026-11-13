/* SHEDINO - modul autentikasi bersama.
   Memerlukan: assets/vendor/supabase.js dan config.js dimuat lebih dulu. */
(function () {
  const cfg = window.SHEDINO_CONFIG || window.DIONSHE_CONFIG || {};   // DIONSHE_CONFIG = nama lama, tetap didukung
  const url = (cfg.SUPABASE_URL || "").trim();
  const key = (cfg.SUPABASE_ANON_KEY || "").trim();
  const configured = !!(url && key && window.supabase && window.supabase.createClient);

  const client = configured
    ? window.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  /* Terjemahan pesan galat yang sering muncul */
  function friendly(err) {
    const m = String((err && (err.message || err.error_description)) || err || "").toLowerCase();
    if (!m) return "Terjadi kesalahan. Coba lagi.";
    if (m.includes("invalid login credentials")) return "Email atau kata sandi salah.";
    if (m.includes("email not confirmed")) return "Email belum dikonfirmasi. Periksa kotak masuk Anda dan klik tautan konfirmasi.";
    if (m.includes("already registered") || m.includes("already been registered")) return "Email ini sudah terdaftar. Silakan masuk.";
    if (m.includes("password should be at least")) return "Kata sandi terlalu pendek. Gunakan minimal 8 karakter.";
    if (m.includes("rate limit") || m.includes("too many")) return "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
    if (m.includes("same password") || m.includes("different from the old")) return "Kata sandi baru harus berbeda dari yang lama.";
    if (m.includes("signup") && m.includes("disabled")) return "Pendaftaran sedang dinonaktifkan.";
    return "Terjadi kesalahan: " + (err.message || err);
  }

  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session || null;
  }

  /* Mengembalikan { session, profile } atau null jika belum masuk */
  async function getState() {
    if (!client) return null;
    const session = await getSession();
    if (!session) return null;
    const { data, error } = await client
      .from("profiles")
      .select("id,email,full_name,employee_id,role,status,created_at")
      .eq("id", session.user.id)
      .maybeSingle();
    return { session, profile: data || null, error: error || null };
  }

  const isApproved = st => !!(st && st.profile && st.profile.status === "approved");
  const isAdmin = st => !!(st && st.profile && st.profile.status === "approved" && st.profile.role === "admin");

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp({ email, password, fullName, employeeId }) {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, employee_id: employeeId || "" },
        emailRedirectTo: location.origin + "/masuk"
      }
    });
    if (error) throw error;
    // Jika konfirmasi email aktif, email yang sudah terdaftar dikembalikan tanpa identitas.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("User already registered");
    }
    return data;
  }

  async function signOut() {
    if (client) await client.auth.signOut();
  }

  async function sendReset(email) {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/masuk" });
    if (error) throw error;
  }

  async function updatePassword(password) {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
  }

  /* Hanya izinkan tujuan di dalam situs ini */
  function safeNext(value) {
    const allowed = ["index.html", "admin.html", "layanan.html", "media.html", "shegames.html", "/", "/admin", "/index.html", "/shegames", ""];
    return allowed.includes(value || "") ? (value || "index.html") : "index.html";
  }

  window.Auth = {
    configured, client, friendly, url, key,
    getSession, getState, isApproved, isAdmin,
    signIn, signUp, signOut, sendReset, updatePassword, safeNext
  };
})();
