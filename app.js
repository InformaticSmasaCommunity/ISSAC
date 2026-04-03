const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI("AIzaSyBwHoMhW-M6HaG7qYcFY2e0zlffsFdiy2c");

// Route ke halaman utama
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/chat', async (req, res) => {
    try {
        const userMsg = (req.body.pesan || "").toLowerCase().trim();
        const dbPath = path.join(process.cwd(), 'data.json');
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

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(userMsg);
        res.json({ jawaban: result.response.text(), list: [] });

    } catch (error) {
        res.json({ jawaban: "Error: " + error.message });
    }
});

module.exports = app;
