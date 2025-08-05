import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function PlantCare() {
    const navigate = useNavigate();
    const [token, setToken] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const savedToken = localStorage.getItem('token');
        if (!savedToken) {
            alert('로그인이 필요합니다.');
            window.location.href = 'https://plantmate.site/login';
        } else {
            setToken(savedToken);
            fetchCareAdvice(savedToken);
        }
    }, []);

    const fetchCareAdvice = async (token) => {
        setLoading(true);
        try {
            const res = await axios.get('/plant-care', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.data.message === "해당 사용자의 식물이 없습니다.") {
                alert("등록된 식물이 없습니다.");
            } else {
                setResult(res.data);
            }
        } catch (err) {
            console.error(err);
            setError("정보를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '40px' }}>
            <h2>날씨 맞춤 식물 가이드</h2>
            {loading && <p>불러오는 중...</p>}
            {error && <p>{error}</p>}
            {result?.weather && (
                <div>
                    <p><strong>기온</strong>: {result.weather["기온(°C)"]}°C</p>
                    <p><strong>습도</strong>: {result.weather["습도(%)"]}%</p>
                    <p><strong>바람</strong>: {result.weather["바람속도(m/s)"]} m/s</p>
                    <p><strong>강수량</strong>: {result.weather["강수량(mm, 1시간)"]} mm</p>
                </div>
            )}
            {result?.care_advice?.length > 0 && (
                <div>
                    {result.care_advice.map((item, idx) => (
                        <div key={idx}>
                            <h4>{item.plant}</h4>
                            <p>{item.advice}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default PlantCare;
