import React, { useState } from 'react';
import axios from 'axios';

function PlantCare() {
    const [userId, setUserId] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchCareAdvice = async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await axios.get('http://localhost:3000/plant-care', {
                params: { user_id: userId }
            });

            if (response.data.message === "해당 사용자의 식물이 없습니다.") {
                alert("등록된 식물이 없습니다. 식물을 등록 후 사용해주세요.");
                setLoading(false);
                return;
            }

            setResult(response.data);
        } catch (err) {
            console.error(err);
            setError('데이터를 불러오는 중 오류가 발생했습니다.');
        }

        setLoading(false);
    };

    return (
        <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', margin: '80px auto 20px' }}>
            <h2 style={{ textAlign: 'center' }}>날씨 맞춤 식물 가이드</h2>

            <div style={{ maxWidth: '500px', margin: '20px auto', display: 'flex', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="사용자 ID"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '10px',
                        border: '1px solid #ccc',
                        borderRadius: '8px'
                    }}
                />
                <button
                    onClick={fetchCareAdvice}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        backgroundColor: '#5e865f',
                        color: 'white',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    조회
                </button>
            </div>

            {loading && <p style={{ textAlign: 'center' }}>불러오는 중입니다...</p>}
            {error && <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>}

            {result && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {result.weather && (
                        <div
                            style={{
                                backgroundColor: '#D8E3E2',
                                padding: '20px',
                                borderRadius: '12px',
                                marginBottom: '30px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                        >
                            <h3>날씨 정보</h3>
                            <p><strong>기온</strong>: {result.weather["기온(°C)"]}°C</p>
                            <p><strong>날씨 상태</strong>: {result.weather["날씨"]}</p>
                            <p><strong>습도</strong>: {result.weather["습도(%)"]}</p>
                            <p><strong>바람</strong>: {result.weather["바람속도(m/s)"]}</p>
                            <p><strong>강수량</strong>: {result.weather["강수량(mm, 1시간)"]}mm</p>
                        </div>
                    )}

                    {Array.isArray(result.care_advice) && result.care_advice.length > 0 && (
                        <div>
                            <h3>식물 관리 가이드</h3>
                            <p />
                            {result.care_advice.map((item, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        backgroundColor: '#fff',
                                        padding: '20px',
                                        borderRadius: '12px',
                                        marginBottom: '20px',
                                        // borderLeft: '5px solid #4CAF50',
                                        boxShadow: '0 1px 5px rgba(0,0,0,0.08)'
                                    }}
                                >
                                    <h4>{item.plant}</h4>
                                    <p>{item.advice}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default PlantCare;
