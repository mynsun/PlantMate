import React, { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import Header from './Header';
import './App.css';

function App() {
    const [formData, setFormData] = useState({
        has_south_sun: false,
        has_north_sun: false,
        has_east_sun: false,
        has_west_sun: false,
        plant_location: 'Indoor',
        has_blinds_curtains: false,
        water_frequency: 2,
    });

    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setRecommendations([]);

        const API_GATEWAY_URL = 'http://15.168.150.125:3001/recommend-plants';

        try {
            const response = await fetch(API_GATEWAY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || errorData.message || 'API 응답이 실패했습니다.');
            }

            const data = await response.json();
            if (data && Array.isArray(data.recommendations)) {
                setRecommendations(data.recommendations);
            } else {
                throw new Error("API 응답 형식이 올바르지 않습니다. 'recommendations' 배열을 찾을 수 없습니다.");
            }
        } catch (err) {
            console.error('API 호출 중 오류 발생:', err);
            setError('식물 추천을 가져오는 데 실패했습니다: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <BrowserRouter>
            <div className="App" style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#d8e3e2', minHeight: '100vh', paddingTop: '30px' }}>
                <Header />

                <div style={{ maxWidth: '1000px', margin: '100px auto 20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', backgroundColor: '#ffffff' }}>
                    <header style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <h2 style={{ color: '#333' }}>식물 추천 받기</h2>
                        <h3 style={{ color: '#666' }}>당신의 환경에 딱 맞는 식물을 찾아보세요!</h3>
                    </header>

                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '15px', padding: '20px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
                        <h2 style={{ color: '#555', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '20px', textAlign: 'center' }}>환경 정보 입력</h2>

                        <div style={{ textAlign: 'center' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>햇빛 방향:</label>
                            <div style={{ display: 'inline-flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <label><input type="checkbox" name="has_south_sun" checked={formData.has_south_sun} onChange={handleChange} /> 남향</label>
                                <label><input type="checkbox" name="has_north_sun" checked={formData.has_north_sun} onChange={handleChange} /> 북향</label>
                                <label><input type="checkbox" name="has_east_sun" checked={formData.has_east_sun} onChange={handleChange} /> 동향</label>
                                <label><input type="checkbox" name="has_west_sun" checked={formData.has_west_sun} onChange={handleChange} /> 서향</label>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="plant_location" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>식물 놓을 위치:</label>
                            <select id="plant_location" name="plant_location" value={formData.plant_location} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                <option value="Indoor">창가에서 1m 이상 떨어진 실내</option>
                                <option value="Window">창가 바로 옆 (직사광선 가능)</option>
                                <option value="Balcony">베란다/발코니 (야외 유사 환경)</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>블라인드/커튼 유무:</label>
                            <label><input type="checkbox" name="has_blinds_curtains" checked={formData.has_blinds_curtains} onChange={handleChange} /> 있음</label>
                        </div>

                        <div>
                            <label htmlFor="water_frequency" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>물주기 빈도 선호:</label>
                            <select id="water_frequency" name="water_frequency" value={formData.water_frequency} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                <option value={1}>물을 자주 주는 편 (흙 마르면 바로)</option>
                                <option value={2}>흙 표면 마르면 (주 1~2회)</option>
                                <option value={3}>흙 속까지 완전히 마르면 (주 1회 미만)</option>
                            </select>
                        </div>

                        <button type="submit" disabled={loading} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                            {loading ? '추천 중...' : '식물 추천받기'}
                        </button>
                    </form>

                    {error && (
                        <div style={{ color: 'red', marginTop: '20px', padding: '10px', border: '1px solid red', borderRadius: '5px', backgroundColor: '#ffe6e6' }}>
                            <p>오류: {error}</p>
                        </div>
                    )}

                    {recommendations.length > 0 && (
                        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
                            <h2 style={{ color: '#555', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '20px', textAlign: 'center' }}>추천 식물</h2>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {recommendations.map((plant, index) => (
                                    <li key={index} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '5px', backgroundColor: '#fff', display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                                        <img
                                            src={plant.image_url}
                                            alt={plant.name}
                                            style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: '1px solid #ccc' }}
                                            onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/128x128/E0E6EB/555555?text=No+Image"; }}
                                        />
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            flex: 1
                                        }}>
                                            <h3 style={{ color: '#4CAF50', marginTop: 0, marginBottom: '5px', textAlign: 'center' }}>{plant.name}</h3>
                                            <p style={{ color: '#777', fontSize: '0.95em', lineHeight: '1.5', textAlign: 'center' }}>{plant.description}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!loading && !error && recommendations.length === 0 && (
                        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9', textAlign: 'center', color: '#888' }}>
                            <p>아직 추천된 식물이 없습니다. 환경 정보를 입력하고 '식물 추천받기' 버튼을 눌러보세요!</p>
                        </div>
                    )}
                </div>
            </div>
        </BrowserRouter>
    );
}

export default App;
