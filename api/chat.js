module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const userMsg = req.body?.pesan || "halo";
    
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
      return res.json({ jawaban: "Error API", detail: data.error.message });
    }

    const hasil = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
    return res.json({ jawaban: hasil });

  } catch (err) {
    return res.json({ jawaban: "Crash di Server", error: err.message });
  }
};
