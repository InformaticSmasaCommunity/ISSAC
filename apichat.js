const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const userMsg = (req.body?.pesan || "").toLowerCase().trim();

    if (!userMsg) {
      return res.json({ jawaban: "Pesan kosong.", list: [] });
    }

    // ✅ SAFE LOAD JSON
    let dbData;
    try {
      const dbPath = path.join(process.cwd(), 'data.json');
      const raw = fs.readFileSync(dbPath, 'utf8');
      dbData = JSON.parse(raw);
    } catch (err) {
      return res.json({
        jawaban: "Error membaca database JSON.",
        error: err.message
      });
    }

    // ✅ CARI KEYWORD
    let dataDitemukan = null;

    for (const item of dbData.pengetahuan || []) {
      if (item.keywords?.some(k =>
        userMsg.includes(k.toLowerCase())
      )) {
        dataDitemukan = item;
        break;
      }
    }

    if (dataDitemukan) {
      return res.json({
        jawaban: dataDitemukan.jawaban,
        list: dataDitemukan.bagian || []
      });
    }

    // ✅ CEK API KEY
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        jawaban: "API KEY tidak ditemukan di server."
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const result = await model.generateContent(userMsg);

    const text =
      result?.response?.text?.() ||
      "AI tidak memberi respon.";

    return res.json({ jawaban: text, list: [] });

  } catch (err) {
    return res.json({
      jawaban: "Server error",
      error: err.message
    });
  }
};
