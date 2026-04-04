const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
  try {
    // 🔍 DEBUG ENV
    console.log("ENV CHECK:", process.env.GEMINI_API_KEY ? "ADA" : "KOSONG");

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const userMsg = (req.body?.pesan || "").toLowerCase().trim();

    if (!userMsg) {
      return res.json({ jawaban: "Pesan kosong.", list: [] });
    }

    // ✅ LOAD JSON
    let dbData;
    try {
      const dbPath = path.join(__dirname, "../data.json");
      const raw = fs.readFileSync(dbPath, "utf8");
      dbData = JSON.parse(raw);
    } catch (err) {
      return res.json({
        jawaban: "Error membaca database JSON.",
        error: err.message,
      });
    }

    // ✅ CARI KEYWORD
    let dataDitemukan = null;

    for (const item of dbData.pengetahuan || []) {
      if (
        item.keywords?.some((k) =>
          userMsg.includes(k.toLowerCase())
        )
      ) {
        dataDitemukan = item;
        break;
      }
    }

    // ✅ JIKA ADA DI DATABASE
    if (dataDitemukan) {
      return res.json({
        jawaban: dataDitemukan.jawaban,
        list: dataDitemukan.bagian || [],
      });
    }

    // ❌ CEK API KEY
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        jawaban: "API KEY tidak ditemukan di server.",
        debug: "ENV kosong di runtime",
      });
    }

    // =========================
    // 🔥 BAGIAN AI (FIX FINAL)
    // =========================
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const model = genAI.getGenerativeModel({
        model: "gemini-pro",
      });

      const result = await model.generateContent(userMsg);

      let text = "AI tidak memberi respon.";

      // ✅ HANDLE SEMUA FORMAT RESPONSE
      if (result && result.response) {
        if (typeof result.response.text === "function") {
          text = result.response.text();
        } else if (result.response.candidates) {
          text =
            result.response.candidates?.[0]?.content?.parts?.[0]?.text ||
            text;
        }
      }

      return res.json({
        jawaban: text,
        list: [],
      });

    } catch (aiError) {
      console.log("AI ERROR FULL:", aiError);

      return res.json({
        jawaban: "AI gagal merespon",
        error: aiError.message,
        detail: JSON.stringify(aiError),
      });
    }

  } catch (err) {
    console.log("SERVER ERROR FULL:", err);

    return res.json({
      jawaban: "Server error",
      error: err.message,
      detail: JSON.stringify(err),
    });
  }
};
