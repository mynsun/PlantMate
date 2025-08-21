import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_FORM = {
    has_south_sun: false,
    has_north_sun: false,
    has_east_sun: false,
    has_west_sun: false,
    plant_location: 'Indoor',
    has_blinds_curtains: false,
    water_frequency: 2,
};

const API_BASE =
    process.env.REACT_APP_API_BASE?.replace(/\/$/, '') || window.location.origin;

const toAbsoluteProxy = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/proxy-image')) {
        return `${API_BASE}${url}`;
    }
    return url;
};

function PlantCard({ name, imageUrl }) {
    const fallback = '/fallback-plant.png';
    const initial = toAbsoluteProxy(imageUrl) || fallback;

    const [src, setSrc] = useState(initial);

    useEffect(() => {
        setSrc(toAbsoluteProxy(imageUrl) || fallback);
    }, [imageUrl]);

    const onErr = useCallback(() => {
        if (src !== fallback) setSrc(fallback);
    }, [src]);

    return (
        <img
            src={src}
            alt={name}
            loading="lazy"
            onError={onErr}
            style={{
                width: '100%',
                height: '260px',
                objectFit: 'cover',
                borderRadius: '8px',
            }}
        />
    );
}

function PlantRecommend() {
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isOpen, setIsOpen] = useState(true);

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
            const response = await fetch('/precommend/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || '추천 실패');
            }

            const data = await response.json();

            const normalized = (data.recommendations || []).map((r) => ({
                ...r,
                image_url: toAbsoluteProxy(r.image_url),
            }));

            setRecommendations(normalized);
        } catch (err) {
            setError('식물 추천을 가져오는 데 실패했습니다: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFormData(INITIAL_FORM);
        setRecommendations([]);
        setError(null);
        setLoading(false);
        setIsOpen(true);
    };

    const toggleForm = () => {
        setIsOpen(!isOpen);
    };

    const buildShopUrl = (plantName) => {
        const q = encodeURIComponent(plantName || '');
        return `https://www.simpol.co.kr/front/productsearch.php?s_from=top&s_check=prodname&search=${q}`;
    };

    return (
        <div style={{ paddingTop: '10px', backgroundColor: '#D9E4E4', minHeight: '100vh' }}>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                    maxWidth: '1000px',
                    margin: '50px auto 20px',
                    padding: '20px',
                    borderRadius: '16px',
                    backgroundColor: '#EFF7F8',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                }}
            >
                <header
                    onClick={toggleForm}
                    style={{
                        textAlign: 'center',
                        marginBottom: '40px',
                        paddingTop: '30px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                    }}
                >
                    <h2 style={{ color: '#7f8c8d', fontSize: '30px', margin: 0 }}>
                        환경에 딱 맞는 식물을 찾아보세요!
                    </h2>
                    <motion.svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#7f8c8d"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </motion.svg>
                </header>

                <AnimatePresence>
                    {isOpen && (
                        <motion.form
                            onSubmit={handleSubmit}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{
                                display: 'grid',
                                gap: '20px',
                                justifyContent: 'center',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '24px',
                                    marginBottom: '12px',
                                    width: '100%',
                                    maxWidth: '600px',
                                    marginInline: 'auto',
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: 'bold',
                                        width: '120px',
                                        textAlign: 'left',
                                        flexShrink: 0,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    햇빛 방향(중복 가능)
                                </span>

                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        flexWrap: 'wrap',
                                        gap: '10px',
                                        flex: 1,
                                    }}
                                >
                                    {[
                                        { key: 'south', label: '남향' },
                                        { key: 'north', label: '북향' },
                                        { key: 'east', label: '동향' },
                                        { key: 'west', label: '서향' },
                                    ].map(({ key, label }) => {
                                        const field = `has_${key}_sun`;
                                        const selected = formData[field];

                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        [field]: !prev[field],
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
                                                    minWidth: '70px',
                                                }}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '24px',
                                    marginBottom: '12px',
                                    width: '100%',
                                    maxWidth: '600px',
                                    marginInline: 'auto',
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: 'bold',
                                        width: '120px',
                                        textAlign: 'left',
                                        flexShrink: 0,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    블라인드
                                </span>

                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        flexWrap: 'wrap',
                                        gap: '10px',
                                        flex: 1,
                                    }}
                                >
                                    {[
                                        { value: true, label: '있음' },
                                        { value: false, label: '없음' },
                                    ].map(({ value, label }) => {
                                        const selected = formData.has_blinds_curtains === value;

                                        return (
                                            <button
                                                key={value.toString()}
                                                type="button"
                                                onClick={() => setFormData((prev) => ({ ...prev, has_blinds_curtains: value }))}
                                                style={{
                                                    padding: '8px 15px',
                                                    borderRadius: '24px',
                                                    border: selected ? '2px solid #5e865f' : '1px solid #5e865f',
                                                    backgroundColor: selected ? '#5e865f' : '#fff',
                                                    color: selected ? '#fff' : '#5e865f',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    minWidth: '70px',
                                                }}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '24px',
                                    marginBottom: '12px',
                                    width: '100%',
                                    maxWidth: '600px',
                                    marginInline: 'auto',
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: 'bold',
                                        width: '120px',
                                        textAlign: 'left',
                                        flexShrink: 0,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    식물 위치
                                </span>

                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        flexWrap: 'wrap',
                                        gap: '10px',
                                        flex: 1,
                                    }}
                                >
                                    {[
                                        { value: 'Indoor', label: '실내' },
                                        { value: 'Window', label: '창가' },
                                        { value: 'Balcony', label: '베란다' },
                                    ].map(({ value, label }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setFormData((prev) => ({ ...prev, plant_location: value }))}
                                            style={{
                                                padding: '8px 15px',
                                                borderRadius: '24px',
                                                border: formData.plant_location === value ? '2px solid #5e865f' : '1px solid #5e865f',
                                                backgroundColor: formData.plant_location === value ? '#5e865f' : '#fff',
                                                color: formData.plant_location === value ? '#fff' : '#5e865f',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                minWidth: '70px',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '24px',
                                    marginBottom: '12px',
                                    width: '100%',
                                    maxWidth: '600px',
                                    marginInline: 'auto',
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: 'bold',
                                        width: '120px',
                                        textAlign: 'left',
                                        flexShrink: 0,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    물주기 빈도
                                </span>

                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        flexWrap: 'wrap',
                                        gap: '10px',
                                        flex: 1,
                                    }}
                                >
                                    {[
                                        { value: 1, label: '자주' },
                                        { value: 2, label: '주 1~2회' },
                                        { value: 3, label: '주 1회 미만' },
                                    ].map(({ value, label }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setFormData((prev) => ({ ...prev, water_frequency: value }))}
                                            style={{
                                                padding: '8px 15px',
                                                borderRadius: '24px',
                                                border: formData.water_frequency === value ? '2px solid #5e865f' : '1px solid #5e865f',
                                                backgroundColor: formData.water_frequency === value ? '#5e865f' : '#fff',
                                                color: formData.water_frequency === value ? '#fff' : '#5e865f',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                minWidth: '70px',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        padding: '14px 30px',
                                        backgroundColor: '#5e865f',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '30px',
                                        fontSize: '18px',
                                        fontWeight: 'bold',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {loading ? '추천 중...' : '식물 추천받기'}
                                </motion.button>

                                <button
                                    type="button"
                                    onClick={handleReset}
                                    style={{
                                        padding: '14px 30px',
                                        backgroundColor: '#ffffff',
                                        color: '#5e865f',
                                        border: '2px solid #5e865f',
                                        borderRadius: '30px',
                                        fontSize: '18px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                    }}
                                >
                                    초기화
                                </button>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>

            {error && <div style={{ color: 'red', marginTop: '20px' }}>{error}</div>}

            <div
                style={{
                    marginTop: '40px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '32px',
                    justifyContent: 'center',
                    maxWidth: '1000px',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    paddingBottom: '30px',
                }}
            >
                {recommendations.map((plant) => (
                    <motion.div
                        key={plant.name}
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
                            minHeight: '460px',
                        }}
                    >
                        <PlantCard name={plant.name} imageUrl={plant.image_url} />

                        <h4 style={{ margin: '16px 0 8px', fontSize: '20px' }}>{plant.name}</h4>
                        <p style={{ fontSize: '15px', color: '#555', marginBottom: '16px' }}>{plant.description}</p>

                        <a
                            href={buildShopUrl(plant.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                marginTop: 'auto',
                                padding: '10px 16px',
                                borderRadius: '10px',
                                border: '1px solid #5e865f',
                                background: '#5e865f',
                                color: '#fff',
                                fontWeight: 700,
                                textDecoration: 'none',
                                display: 'inline-block',
                            }}
                        >
                            구매하러 가기
                        </a>
                    </motion.div>
                ))}
            </div>
        </div >
    );
}

export default PlantRecommend;
