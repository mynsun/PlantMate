const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3002;

const FASTAPI_SERVICE_URL = "http://127.0.0.1:3000";

app.use(cors({
    origin: ['http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/plantrecommend', express.static(path.join(__dirname, 'frontend/build')));

app.get('/plantrecommend/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

app.post('/recommend-plants', async (req, res) => {
    try {
        const response = await axios.post(`${FASTAPI_SERVICE_URL}/recommend/`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'FastAPI 연결 실패', error: error.message });
    }
});

app.get('/plant-care', async (req, res) => {
    try {
        const response = await axios.get(`${FASTAPI_SERVICE_URL}/plant-care`, {
            headers: {
                Authorization: req.headers.authorization
            }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('🔥 plant-care 프록시 오류:', error.message);
        res.status(500).json({ message: 'FastAPI 연결 실패', error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Node.js 서버 실행 중: http://localhost:${port}/test`);
});
