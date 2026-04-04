const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
  try {
    // 🔍 DEBUG ENV (WAJIB SEMENTARA)
    console.log("ENV CHECK:", process.env.GEMINI_API_KEY ? "ADA" : "KOSONG");

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const userMsg = (req.body?.pesan || "").toLowerCase().trim();

    if (!userMsg) {
      return res.json({ jawaban: "Pesan kosong.", list: [] });
    }

    // ✅ LOAD JSON (LEBIH AMAN DI VERCEL)
    let dbData;
    try {
      const dbPath = path.join(__dirname, "../data.json"); // 🔥 FIX PENTING
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

    // ✅ AI PROCESS
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const result = await model.generateContent(userMsg);

    const text =
      result?.response?.text?.() ||
      "AI tidak memberi respon.";

    return res.json({
      jawaban: text,
      list: [],
    });

  } catch (err) {
    return res.json({
      jawaban: "Server error",
      error: err.message,
    });
  }
};
