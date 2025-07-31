const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3002;

const FASTAPI_SERVICE_URL = "http://localhost:3000";

app.use(cors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, 'frontend/build')));

app.post('/recommend-plants', async (req, res) => {
    try {
        const response = await axios.post(`${FASTAPI_SERVICE_URL}/recommend/`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'FastAPI 연결 실패', error: error.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build/index.html'));
});

app.listen(port, () => {
    console.log(`Node.js 서버 실행 중: http://localhost:${port}`);
});
