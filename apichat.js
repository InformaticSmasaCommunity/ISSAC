const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const userMsg = (req.body?.pesan || "").toLowerCase().trim();

    if (!userMsg) {
      return res.json({ jawaban: "Pesan kosong.", list: [] });
    }

    // Load JSON
    const dbPath = path.join(process.cwd(), 'data.json');
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    // Cari keyword
    let dataDitemukan = null;

    for (const item of dbData.pengetahuan) {
      if (item.keywords.some(k =>
        new RegExp(`\\b${k}\\b`, 'i').test(userMsg)
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

    // Fallback AI
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const result = await model.generateContent(userMsg);

    const text =
      result?.response?.text?.() ||
      "AI tidak memberikan jawaban.";

    return res.json({ jawaban: text, list: [] });

  } catch (err) {
    return res.json({ jawaban: "Error: " + err.message });
  }
};