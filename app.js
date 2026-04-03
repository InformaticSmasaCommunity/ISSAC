const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Melayani file statis seperti index.html dan style.css
app.use(express.static(__dirname));

// Konfigurasi Gemini AI
const genAI = new GoogleGenerativeAI("AIzaSyBwHoMhW-M6HaG7qYcFY2e0zlffsFdiy2c");

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/chat', async (req, res) => {
    try {
        const userMsg = (req.body.pesan || "").toLowerCase().trim();
        
        // Membaca data.json dengan path yang benar untuk serverless
        const dbPath = path.join(process.cwd(), 'data.json');
        if (!fs.existsSync(dbPath)) {
            return res.json({ jawaban: "Error: File data.json tidak ditemukan." });
        }
        
        const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        let dataDitemukan = null;
        dbData.pengetahuan.forEach(item => {
            if (item.keywords.some(k => userMsg.includes(k.toLowerCase()))) {
                dataDitemukan = item;
            }
        });

        if (dataDitemukan) {
            return res.json({ jawaban: dataDitemukan.jawaban, list: dataDitemukan.bagian || [] });
        }

        // Jika tidak ada di database, tanya Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Jawab singkat dalam bahasa Indonesia: ${userMsg}`);
        const response = await result.response;
        
        res.json({ jawaban: response.text(), list: [] });

    } catch (error) {
        res.json({ jawaban: "ISSAC Error: " + error.message });
    }
});

// Penting untuk Vercel
module.exports = app;
