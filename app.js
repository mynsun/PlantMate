const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3002;

const FASTAPI_SERVICE_URL = "http://127.0.0.1:3000";

app.use(cors({
    origin: ['http://localhost:3000', 'http://15.168.150.125:3002', 'https://plantmate.site'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.get('/precommend/plant-care', async (req, res) => {
    const token = req.headers.authorization;
    console.log("프론트에서 받은 Authorization 헤더:", token);

    try {
        const response = await axios.get(`${FASTAPI_SERVICE_URL}/precommend/plant-care`, {
            headers: {
                Authorization: token,
            },
            timeout: 120000
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("FastAPI 응답 오류:", error.response?.data || error.message);
        if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
            res.status(504).json({
                message: 'FastAPI 응답 시간 초과 (Gateway Timeout)',
                error: '백엔드 서버가 너무 오래 응답하지 않습니다.'
            });
        } else {
            res.status(error.response?.status || 500).json({
                message: 'FastAPI 연결 실패',
                error: error.response?.data || error.message,
            });
        }
    }
});

app.use('/plantrecommend', express.static(path.join(__dirname, 'frontend/build')));

app.get('/plantrecommend/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

app.listen(port, () => {
    console.log(`Node.js 서버 실행 중: http://localhost:${port}`);
});