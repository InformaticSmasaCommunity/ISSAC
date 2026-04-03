const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Melayani file statis (index.html, style.css, dll)
app.use(express.static(path.join(__dirname)));

// GANTI DENGAN API KEY GEMINI ANDA
const genAI = new GoogleGenerativeAI("AIzaSyBwHoMhW-M6HaG7qYcFY2e0zlffsFdiy2c");
let pendingQuestion = {};

// Fungsi delay untuk efek mengetik
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Route utama untuk memanggil index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/chat', async (req, res) => {
    const userId = req.ip;
    const userMsg = (req.body.pesan || "").toLowerCase().trim();

    try {
        await delay(1000); 

        // 1. CEK STATUS PENDING (Konfirmasi Gemini)
        if (pendingQuestion[userId]) {
            if (['ya', 'boleh', 'lanjut', 'oke', 'gas'].includes(userMsg)) {
                const originalQuery = pendingQuestion[userId];
                delete pendingQuestion[userId];

                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    generationConfig: { responseMimeType: "application/json" }
                });

                const prompt = `Berikan informasi singkat tentang "${originalQuery}". 
                WAJIB format JSON: {"jawaban": "isi jawaban singkat", "bagian": ["item 1", "item 2"]}`;
                
                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                const parsedJson = JSON.parse(responseText);

                return res.json({ 
                    jawaban: "(Gemini AI): " + parsedJson.jawaban, 
                    list: parsedJson.bagian || [] 
                });
            } 
            else if (['tidak', 'gak', 'batal', 'no'].includes(userMsg)) {
                delete pendingQuestion[userId];
                return res.json({ jawaban: "Baik, permintaan dibatalkan. Ada lagi yang bisa saya bantu?" });
            }
        }

        // 2. BACA DATABASE LOKAL (Gunakan path.join agar Vercel tidak error)
        const dbPath = path.join(process.cwd(), 'data.json');
        
        if (!fs.existsSync(dbPath)) {
            return res.json({ jawaban: "Error: File data.json tidak ditemukan di server." });
        }

        const dbRaw = fs.readFileSync(dbPath, 'utf8');
        const db = JSON.parse(dbRaw);
        let dataDitemukan = null;

        db.pengetahuan.forEach(item => {
            if (item.keywords.some(k => userMsg.includes(k.toLowerCase()))) {
                dataDitemukan = item;
            }
        });

        if (dataDitemukan) {
            return res.json({ 
                jawaban: dataDitemukan.jawaban, 
                list: dataDitemukan.bagian || [] 
            });
        }

        // 3. JIKA TIDAK ADA DI DB, TAWARKAN GEMINI
        pendingQuestion[userId] = userMsg;
        res.json({ 
            jawaban: `Info tentang "${userMsg}" tidak ada di database ISSAC. Cari lewat AI? (Balas 'Ya' atau 'Tidak')` 
        });

    } catch (error) {
        console.error("Error Detail:", error);
        res.json({ 
            jawaban: "Maaf, ISSAC sedang gangguan. Detail: " + error.message 
        });
    }
});

// Port otomatis untuk Vercel/Render atau lokal (3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Export untuk Vercel
module.exports = app;
