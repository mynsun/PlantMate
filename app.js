const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.nodejs') });

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3002;

app.use(express.static(path.join(__dirname, 'frontend/build')));

const FASTAPI_SERVICE_URL = process.env.FASTAPI_SERVICE_URL;

if (!FASTAPI_SERVICE_URL) {
    console.error("오류: FASTAPI_SERVICE_URL 환경 변수가 설정되지 않았습니다. .env.nodejs 파일을 확인해주세요.");
    process.exit(1);
}

app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3002',
        'http://15.168.150.125:3000',
        'http://15.168.150.125:3002',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.post('/recommend-plants', async (req, res) => {
    try {
        const fastapiResponse = await axios.post(`${FASTAPI_SERVICE_URL}/recommend/`, req.body);
        res.status(fastapiResponse.status).json(fastapiResponse.data);
    } catch (error) {
        console.error("FastAPI 서비스 호출 중 오류 발생:", error.message);
        if (error.response) {
            console.error("FastAPI 서비스 전체 오류 응답:", error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ message: "식물 추천 서비스에 연결하지 못했습니다.", error: error.message });
        }
    }
});

app.listen(port, () => {
    console.log(`Node.js API Gateway가 http://localhost:${port} 에서 실행 중입니다.`);
});