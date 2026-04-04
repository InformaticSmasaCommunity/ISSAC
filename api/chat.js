const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
  try {
    // Log untuk memastikan API Key terbaca di dashboard Vercel
    console.log("ENV CHECK:", process.env.GEMINI_API_KEY ? "API KEY ADA" : "API KEY KOSONG");

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const userMsg = (req.body?.pesan || "").toLowerCase().trim();

    if (!userMsg) {
      return res.json({ jawaban: "Pesan kosong.", list: [] });
    }

    // =========================
    // ✅ 1. LOAD JSON DATABASE
    // =========================
    let dbData;
    try {
      // Menggunakan process.cwd() agar path file data.json aman di server Vercel
      const dbPath = path.join(process.cwd(), "data.json");
      const raw = fs.readFileSync(dbPath, "utf8");
      dbData = JSON.parse(raw);
    } catch (err) {
      console.error("DB Read Error:", err.message);
      return res.json({
        jawaban: "Error membaca database JSON.",
        error: err.message,
      });
    }

    // =========================
    // ✅ 2. CARI DI DATABASE LOKAL
    // =========================
    let dataDitemukan = null;
    if (dbData.pengetahuan && Array.isArray(dbData.pengetahuan)) {
      for (const item of dbData.pengetahuan) {
        if (item.keywords?.some((k) => userMsg.includes(k.toLowerCase()))) {
          dataDitemukan = item;
          break;
        }
      }
    }

    if (dataDitemukan) {
      return res.json({
        jawaban: dataDitemukan.jawaban,
        list: dataDitemukan.bagian || [],
      });
    }

    // =========================
    // ❌ 3. CEK API KEY SEBELUM KE AI
    // =========================
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        jawaban: "Sistem AI belum siap (API KEY tidak ditemukan).",
      });
    }

    // =========================
    // 🔥 4. PANGGIL GEMINI AI
    // =========================
    try {
      // Timeout 8 detik agar fungsi tidak diputus paksa oleh Vercel (limit 10s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: userMsg }],
              },
            ],
          }),
        }
      );

      clearTimeout(timeoutId);
      const data = await response.json();

      // Cek apakah ada error dari Google
      if (data.error) {
        return res.json({
          jawaban: "Google AI Error: " + data.error.message,
          error: data.error,
        });
      }

      let text = "Maaf, AI tidak memberikan respon saat ini.";
      if (data?.candidates?.length) {
        text = data.candidates[0]?.content?.parts?.[0]?.text || text;
      }

      return res.json({
        jawaban: text,
        list: [],
      });

    } catch (aiErr) {
      const isTimeout = aiErr.name === 'AbortError';
      return res.json({
        jawaban: isTimeout ? "Koneksi ke AI terlalu lama (Timeout)." : "AI gagal terhubung.",
        error: aiErr.message,
      });
    }

  } catch (err) {
    console.error("GLOBAL SERVER ERROR:", err);
    return res.json({
      jawaban: "Terjadi kesalahan sistem.",
      error: err.message,
    });
  }
};
