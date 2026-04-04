const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
  try {
    console.log("ENV CHECK:", process.env.GEMINI_API_KEY ? "ADA" : "KOSONG");

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const userMsg = (req.body?.pesan || "").toLowerCase().trim();

    if (!userMsg) {
      return res.json({ jawaban: "Pesan kosong.", list: [] });
    }

    // =========================
    // ✅ LOAD JSON DATABASE
    // =========================
    let dbData;
    try {
      // Pastikan path data.json benar sesuai struktur folder di Vercel
      const dbPath = path.join(process.cwd(), "data.json"); 
      const raw = fs.readFileSync(dbPath, "utf8");
      dbData = JSON.parse(raw);
    } catch (err) {
      return res.json({
        jawaban: "Error membaca database JSON.",
        error: err.message,
      });
    }

    // =========================
    // ✅ CARI DI DATABASE
    // =========================
    let dataDitemukan = null;
    for (const item of dbData.pengetahuan || []) {
      if (item.keywords?.some((k) => userMsg.includes(k.toLowerCase()))) {
        dataDitemukan = item;
        break;
      }
    }

    if (dataDitemukan) {
      return res.json({
        jawaban: dataDitemukan.jawaban,
        list: dataDitemukan.bagian || [],
      });
    }

    // =========================
    // ❌ CEK API KEY
    // =========================
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        jawaban: "API KEY tidak ditemukan di server.",
      });
    }

    // =========================
    // 🔥 GEMINI VIA REST API
    // =========================
    try {
      // Menambahkan AbortController agar tidak timeout di Vercel (Limit 10s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

      // ❌ ERROR DARI GOOGLE
      if (data.error) {
        return res.json({
          jawaban: "AI sedang sibuk atau API bermasalah.",
          error: data.error.message,
        });
      }

      let text = "AI tidak memberi respon.";
      if (data?.candidates?.length) {
        text = data.candidates[0]?.content?.parts?.[0]?.text || text;
      }

      return res.json({
        jawaban: text,
        list: [],
      });

    } catch (aiErr) {
      return res.json({
        jawaban: aiErr.name === 'AbortError' ? "Koneksi AI timeout (lewat 8 detik)." : "AI gagal terhubung.",
        error: aiErr.message,
      });
    }

  } catch (err) {
    console.log("SERVER ERROR:", err);
    return res.json({
      jawaban: "Terjadi kesalahan pada server.",
      error: err.message,
    });
  }
};
