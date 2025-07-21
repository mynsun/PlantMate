const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.nodejs') });

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

const FASTAPI_SERVICE_URL = process.env.FASTAPI_SERVICE_URL;

if (!FASTAPI_SERVICE_URL) {
    console.error("Error: FASTAPI_SERVICE_URL environment variable is not set. Please check your .env.nodejs file.");
    process.exit(1);
}

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.post('/recommend-plants', async (req, res) => {
    try {
        const fastapiResponse = await axios.post(`${FASTAPI_SERVICE_URL}/recommend/`, req.body);

        res.status(fastapiResponse.status).json(fastapiResponse.data);

    } catch (error) {
        console.error("Error calling FastAPI service:", error.message);
        if (error.response) {
            console.error("FastAPI service full error response:", error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ message: "Failed to connect to plant recommendation service.", error: error.message });
        }
    }
});

app.listen(port, () => {
    console.log(`Node.js API Gateway listening at http://localhost:${port}`);
    console.log(`Clients should call: http://localhost:${port}/recommend-plants`);
    console.log(`Internal FastAPI service at: ${FASTAPI_SERVICE_URL}`);
});