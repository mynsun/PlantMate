import React, { useState } from "react";
import axios from "axios";

function App() {
    const [recommendations, setRecommendations] = useState([]);
    const [userId, setUserId] = useState(1); // 임시 user_id
    const [careAdvice, setCareAdvice] = useState([]);

    const fetchRecommendations = async () => {
        try {
            const res = await axios.post("http://localhost:3000/recommend/", {
                has_south_sun: true,
                has_north_sun: false,
                has_east_sun: true,
                has_west_sun: false,
                plant_location: "Window",
                has_blinds_curtains: true,
                water_frequency: 2,
            });
            setRecommendations(res.data.recommendations);
        } catch (err) {
            console.error("식물 추천 에러:", err);
        }
    };

    const fetchCareAdvice = async () => {
        try {
            const res = await axios.get("http://localhost:3000/plant-care-advice", {
                params: { user_id: userId },
            });
            setCareAdvice(res.data.care_advice || []);
        } catch (err) {
            console.error("관리 팁 에러:", err);
        }
    };

    return (
        <div style={{ padding: 40 }}>
            <h1>🌿 식물 추천 및 관리 서비스</h1>

            <button onClick={fetchRecommendations}>🌱 식물 추천받기</button>
            <ul>
                {recommendations.map((plant, index) => (
                    <li key={index}>
                        <h3>{plant.name}</h3>
                        <p>{plant.description}</p>
                        {plant.image_url && (
                            <img
                                src={`http://localhost:3000/proxy-image?url=${encodeURIComponent(
                                    plant.image_url
                                )}`}
                                alt={plant.name}
                                width={150}
                            />
                        )}
                    </li>
                ))}
            </ul>

            <hr />

            <button onClick={fetchCareAdvice}>🌤 오늘의 식물 관리 팁</button>
            <ul>
                {careAdvice.map((item, index) => (
                    <li key={index}>
                        <strong>{item.plant}</strong>: {item.advice}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default App;