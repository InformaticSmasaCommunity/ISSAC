const fs = require("fs");
const path = require("path");
const memoriIdentitas = require("./identitas.js"); // Memanggil memori identitas M1A1

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

      if (dataDitemukan) {
        return res.json({
          jawaban: dataDitemukan.jawaban,
          list: dataDitemukan.bagian || [],
          sumber: "database_lokal"
        });
      }
    } catch (err) {
      console.error("Gagal baca JSON:", err.message);
    }

    // =========================
    // 🔥 2. JIKA TIDAK ADA DI JSON, TANYA GEMINI 3.1
    // =========================
    if (!process.env.GEMINI_API_KEY) {
      return res.json({ jawaban: "API Key tidak diset di server." });
    }

    // Menggunakan model gemini-3.1-flash-lite-preview sesuai hasil cek API kamu
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // MENANAMKAN MEMORI IDENTITAS (SYSTEM INSTRUCTION)
          system_instruction: {
            role: "system",
            parts: [{ text: memoriIdentitas }]
          },
          contents: [{ 
            role: "user",
            parts: [{ text: userMsg }] 
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      return res.json({ 
        jawaban: "Google API Error", 
        error: data.error.message,
        detail: "Pastikan model gemini-3.1-flash-lite-preview tersedia di region Anda." 
      });
    }

    const hasilAI = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, ISSAC sedang mengalami gangguan teknis.";

    return res.json({
      jawaban: hasilAI,
      list: [],
      sumber: "gemini_ai"
    });

  } catch (err) {
    return res.json({ jawaban: "Server Error", error: err.message });
  }
};
