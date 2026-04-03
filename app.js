const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// GANTI DENGAN API KEY ANDA
const genAI = new GoogleGenerativeAI("AIzaSyBwHoMhW-M6HaG7qYcFY2e0zlffsFdiy2c");
let pendingQuestion = {};

// Fungsi pembantu untuk memberikan delay (efek berpikir)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/chat', async (req, res) => {
    const userId = req.ip;
    const userMsg = (req.body.pesan || "").toLowerCase().trim();

    try {
        // Efek buffer agar typing indicator di frontend terlihat nyata
        await delay(1200); 

        // 1. CEK STATUS PENDING (Pertanyaan konfirmasi untuk Gemini)
        if (pendingQuestion[userId]) {
            if (['ya', 'boleh', 'lanjut', 'oke', 'gas'].includes(userMsg)) {
                const originalQuery = pendingQuestion[userId];
                delete pendingQuestion[userId];

                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    generationConfig: { responseMimeType: "application/json" }
                });

                const prompt = `Berikan informasi singkat tentang "${originalQuery}". 
                WAJIB format JSON: {"jawaban": "isi jawaban singkat", "bagian": ["list item 1", "list item 2"] jika tidak ada list biarkan array kosong}`;
                
                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                const parsedJson = JSON.parse(responseText);

                return res.json({ 
                    jawaban: "(Gemini AI): " + parsedJson.jawaban, 
                    list: parsedJson.bagian || [] 
                });
            } 
            else if (['tidak', 'gak', 'batal', 'no', 'gk'].includes(userMsg)) {
                delete pendingQuestion[userId];
                return res.json({ jawaban: "Baik, permintaan dibatalkan. Ada lagi yang bisa saya bantu terkait data ISSAC?" });
            }
        }

        // 2. CEK DATABASE LOKAL (data.json)
        const db = JSON.parse(fs.readFileSync('data.json'));
        let dataDitemukan = null;

        // Mencari keyword yang cocok di data.json
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

        // 3. JIKA TIDAK ADA DI DATABASE, TAWARKAN GEMINI
        pendingQuestion[userId] = userMsg;
        res.json({ 
            jawaban: `Info tentang "${userMsg}" tidak ditemukan di database internal ISSAC. Mau mencari lewat kecerdasan AI? (Balas 'Ya' untuk lanjut atau 'Tidak' untuk batal)` 
        });

    } catch (error) {
        console.error("LOG ERROR:", error.message);
        res.json({ 
            jawaban: "Maaf, terjadi kendala pada model XM1. Detail: " + error.message 
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("========================================");
    console.log(`ISSAC M1 RUNNING: http://localhost:${PORT}`);
    console.log("========================================");
});