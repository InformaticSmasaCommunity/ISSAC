const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const userMsg = (req.body?.pesan || "").toLowerCase().trim();
    if (!userMsg) return res.json({ jawaban: "Pesan kosong.", list: [] });

    // =========================
    // ✅ 1. LOAD & CEK DATABASE JSON
    // =========================
    let dbData;
    try {
      // Menggunakan path.join dan process.cwd() agar aman di Vercel
      const dbPath = path.join(process.cwd(), "data.json");
      const raw = fs.readFileSync(dbPath, "utf8");
      dbData = JSON.parse(raw);

      let dataDitemukan = null;
      if (dbData.pengetahuan && Array.isArray(dbData.pengetahuan)) {
        for (const item of dbData.pengetahuan) {
          if (item.keywords?.some((k) => userMsg.includes(k.toLowerCase()))) {
            dataDitemukan = item;
            break;
          }
        }
      }

      // JIKA KETEMU DI JSON, LANGSUNG KIRIM JAWABAN
      if (dataDitemukan) {
        return res.json({
          jawaban: dataDitemukan.jawaban,
          list: dataDitemukan.bagian || [],
          sumber: "database_lokal" // Penanda untuk debug
        });
      }
    } catch (err) {
      console.error("Gagal baca JSON:", err.message);
      // Lanjut ke Gemini jika JSON gagal dibaca
    }

    // =========================
    // 🔥 2. JIKA TIDAK ADA DI JSON, TANYA GEMINI
    // =========================
    if (!process.env.GEMINI_API_KEY) {
      return res.json({ jawaban: "API Key tidak diset di server." });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMsg }] }]
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      return res.json({ jawaban: "Google API Error", error: data.error.message });
    }

    const hasilAI = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI tidak merespon.";

    return res.json({
      jawaban: hasilAI,
      list: [],
      sumber: "gemini_ai"
    });

  } catch (err) {
    return res.json({ jawaban: "Server Error", error: err.message });
  }
};
