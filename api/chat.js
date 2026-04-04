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
      const dbPath = path.join(__dirname, "../data.json");
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
      if (
        item.keywords?.some((k) =>
          userMsg.includes(k.toLowerCase())
        )
      ) {
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: userMsg }],
              },
            ],
          }),
        }
      );

      const data = await response.json();

      console.log("GEMINI RAW:", data);

      // ❌ ERROR DARI GOOGLE
      if (data.error) {
        return res.json({
          jawaban: "AI gagal",
          error: data.error.message,
        });
      }

      let text = "AI tidak memberi respon.";

      if (data?.candidates?.length) {
        text =
          data.candidates[0]?.content?.parts?.[0]?.text || text;
      }

      return res.json({
        jawaban: text,
        list: [],
      });

    } catch (aiErr) {
      return res.json({
        jawaban: "Fetch error",
        error: aiErr.message,
      });
    }

  } catch (err) {
    console.log("SERVER ERROR:", err);

    return res.json({
      jawaban: "Server error",
      error: err.message,
    });
  }
};
