import React, { useState } from 'react';
import Header from './Header';
import { motion } from 'framer-motion';

function PlantRecommend() {
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

        try {
            const response = await fetch('http://localhost:3000/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '추천 실패');
            }

            const data = await response.json();
            setRecommendations(data.recommendations || []);
        } catch (err) {
            setError('식물 추천을 가져오는 데 실패했습니다: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ paddingTop: '30px', backgroundColor: '#eaf4f4', minHeight: '100vh' }}>
            <Header />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                    maxWidth: '1000px',
                    margin: '100px auto 20px',
                    padding: '20px',
                    borderRadius: '16px',
                    backgroundColor: '#EFF7F8',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                }}
            >
                <header style={{ textAlign: 'center', marginBottom: '40px', paddingTop: '30px' }}>
                    {/* <h2 style={{ color: '#2c3e50', fontSize: '28px' }}>식물 추천 받기</h2> */}
                    <h2 style={{ color: '#7f8c8d', fontSize: '30px' }}>환경에 딱 맞는 식물을 찾아보세요!</h2>
                </header>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px', justifyContent: 'center' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '24px',
                        marginBottom: '12px',
                        width: '100%',
                        maxWidth: '600px',
                        marginInline: 'auto'
                    }}>
                        <span style={{
                            fontWeight: 'bold',
                            width: '120px',
                            textAlign: 'left',
                            flexShrink: 0,
                            whiteSpace: 'nowrap'
                        }}>
                            햇빛 방향(중복 가능)
                        </span>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            flexWrap: 'wrap',
                            gap: '10px',
                            flex: 1
                        }}>
                            {[
                                { key: 'south', label: '남향' },
                                { key: 'north', label: '북향' },
                                { key: 'east', label: '동향' },
                                { key: 'west', label: '서향' }
                            ].map(({ key, label }) => {
                                const field = `has_${key}_sun`;
                                const selected = formData[field];

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() =>
                                            setFormData(prev => ({
                                                ...prev,
                                                [field]: !prev[field]
                                            }))
                                        }
                                        style={{
                                            padding: '8px 18px',
                                            borderRadius: '24px',
                                            border: selected ? '2px solid #5e865f' : '1px solid #5e865f',
                                            backgroundColor: selected ? '#5e865f' : '#fff',
                                            color: selected ? '#fff' : '#5e865f',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            minWidth: '70px'
                                        }}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '24px',
                        marginBottom: '12px',
                        width: '100%',
                        maxWidth: '600px',
                        marginInline: 'auto'
                    }}>
                        <span style={{
                            fontWeight: 'bold',
                            width: '120px',
                            textAlign: 'left',
                            flexShrink: 0,
                            whiteSpace: 'nowrap'
                        }}>
                            블라인드
                        </span>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            flexWrap: 'wrap',
                            gap: '10px',
                            flex: 1
                        }}>
                            {[
                                { value: true, label: '있음' },
                                { value: false, label: '없음' }
                            ].map(({ value, label }) => {
                                const selected = formData.has_blinds_curtains === value;

                                return (
                                    <button
                                        key={value.toString()}
                                        type="button"
                                        onClick={() =>
                                            setFormData(prev => ({ ...prev, has_blinds_curtains: value }))
                                        }
                                        style={{
                                            padding: '8px 15px',
                                            borderRadius: '24px',
                                            border: selected ? '2px solid #5e865f' : '1px solid #5e865f',
                                            backgroundColor: selected ? '#5e865f' : '#fff',
                                            color: selected ? '#fff' : '#5e865f',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            minWidth: '70px'
                                        }}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '24px',
                        marginBottom: '12px',
                        width: '100%',
                        maxWidth: '600px',
                        marginInline: 'auto'
                    }}>
                        <span style={{
                            fontWeight: 'bold',
                            width: '120px',
                            textAlign: 'left',
                            flexShrink: 0,
                            whiteSpace: 'nowrap'
                        }}>
                            식물 위치
                        </span>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            flexWrap: 'wrap',
                            gap: '10px',
                            flex: 1
                        }}>
                            {[
                                { value: 'Indoor', label: '실내' },
                                { value: 'Window', label: '창가' },
                                { value: 'Balcony', label: '베란다' }
                            ].map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, plant_location: value }))}
                                    style={{
                                        padding: '8px 15px',
                                        borderRadius: '24px',
                                        border: formData.plant_location === value ? '2px solid #5e865f' : '1px solid #5e865f',
                                        backgroundColor: formData.plant_location === value ? '#5e865f' : '#fff',
                                        color: formData.plant_location === value ? '#fff' : '#5e865f',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        minWidth: '70px'
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '24px',
                        marginBottom: '12px',
                        width: '100%',
                        maxWidth: '600px',
                        marginInline: 'auto'
                    }}>
                        <span style={{
                            fontWeight: 'bold',
                            width: '120px',
                            textAlign: 'left',
                            flexShrink: 0,
                            whiteSpace: 'nowrap'
                        }}>
                            물주기 빈도
                        </span>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            flexWrap: 'wrap',
                            gap: '10px',
                            flex: 1
                        }}>
                            {[
                                { value: 1, label: '자주' },
                                { value: 2, label: '주 1~2회' },
                                { value: 3, label: '주 1회 미만' }
                            ].map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, water_frequency: value }))}
                                    style={{
                                        padding: '8px 15px',
                                        borderRadius: '24px',
                                        border: formData.water_frequency === value ? '2px solid #5e865f' : '1px solid #5e865f',
                                        backgroundColor: formData.water_frequency === value ? '#5e865f' : '#fff',
                                        color: formData.water_frequency === value ? '#fff' : '#5e865f',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        minWidth: '70px'
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '16px 42px',
                            backgroundColor: '#5e865f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '24px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? '추천 중...' : '식물 추천받기'}
                    </motion.button>
                </form>
            </motion.div>

            {error && (
                <div style={{ color: 'red', marginTop: '20px' }}>{error}</div>
            )}

            <div style={{
                marginTop: '40px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '32px',
                justifyContent: 'center',
                maxWidth: '1000px',
                marginLeft: 'auto',
                marginRight: 'auto',
                paddingBottom: '30px'
            }}>
                {recommendations.map((plant, index) => (
                    <motion.div
                        key={index}
                        style={{
                            backgroundColor: '#EFF7F8',
                            borderRadius: '16px',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            padding: '32px',
                            minHeight: '420px'
                        }}
                    >
                        <img
                            src={plant.image_url}
                            alt={plant.name}
                            style={{
                                width: '100%',
                                height: '260px',
                                objectFit: 'cover',
                                borderRadius: '8px'
                            }}
                        />
                        <h4 style={{ margin: '16px 0 8px', fontSize: '20px' }}>{plant.name}</h4>
                        <p style={{ fontSize: '15px', color: '#555' }}>{plant.description}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

export default PlantRecommend;
