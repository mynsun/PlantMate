import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_PLANTS = '/precommend/my-plants';
const API_CARE = '/precommend/plant-care';
const API_SAVE_ADDRESS = '/precommend/users/me/address';

const POSTCODE_SRC =
    'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

function PlantCare() {
    const navigate = useNavigate();

    const [myPlants, setMyPlants] = useState([]);
    const [selectedPlant, setSelectedPlant] = useState('');

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [addressInput, setAddressInput] = useState('');
    const [hasAddress, setHasAddress] = useState(true);
    const [postcodeReady, setPostcodeReady] = useState(false);

    const redirectToLogin = useCallback(() => {
        const current = window.location.href;
        const loginUrl = `https://plantmate.site/login?redirect=${encodeURIComponent(current)}`;
        alert('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
        window.location.replace(loginUrl);
    }, []);

    const getToken = () => localStorage.getItem('token') || '';
    const authHeaders = () => {
        const token = getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    };
    const ensureLoggedIn = () => {
        const token = getToken();
        if (!token) {
            redirectToLogin();
            return false;
        }
        return true;
    };
    const handleAuthError = (res) => {
        if (res?.status === 401) {
            alert('세션이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.');
            redirectToLogin();
            return true;
        }
        return false;
    };

    const ensurePostcodeScript = useCallback(() => {
        if (window.daum && window.daum.Postcode) {
            setPostcodeReady(true);
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${POSTCODE_SRC}"]`)) {
                const check = () => {
                    if (window.daum && window.daum.Postcode) {
                        setPostcodeReady(true);
                        resolve();
                    } else setTimeout(check, 100);
                };
                check();
                return;
            }
            const s = document.createElement('script');
            s.src = POSTCODE_SRC;
            s.async = true;
            s.onload = () => {
                setPostcodeReady(true);
                resolve();
            };
            s.onerror = () => reject(new Error('Daum Postcode 스크립트 로드 실패'));
            document.body.appendChild(s);
        });
    }, []);

    const openPostcode = useCallback(async () => {
        try {
            await ensurePostcodeScript();
            new window.daum.Postcode({
                oncomplete: (data) => {
                    const addr = data.roadAddress || data.address || '';
                    setAddressInput(addr);
                    handleAddressSubmit(addr);
                },
            }).open();
        } catch (e) {
            alert('주소 검색 로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
            console.error(e);
        }
    }, [ensurePostcodeScript]);

    const fetchMyPlants = useCallback(async () => {
        if (!ensureLoggedIn()) return;
        try {
            const res = await fetch(API_PLANTS, { headers: { ...authHeaders() } });
            const data = await res.json().catch(() => null);

            if (handleAuthError(res)) return;

            if (!res.ok) {
                setError(data?.detail || `식물 목록 요청 실패 (${res.status})`);
                return;
            }
            const plants = data?.plants ?? [];
            setMyPlants(plants);

            if (!plants.length) {
                alert('보유한 식물이 없습니다. 식물을 등록해주세요.');
                window.location.href = 'https://plantmate.site/plantgrowthtracker';
                return;
            }

            setSelectedPlant((prev) => prev || plants[0]);
        } catch (e) {
            console.error(e);
            setError('내 식물 목록을 불러오지 못했습니다.');
        }
    }, []);

    const fetchCareAdvice = useCallback(
        async (signal, addressOverride, plantNameOverride) => {
            if (!ensureLoggedIn()) return;

            setResult(null);
            setLoading(true);
            setError('');

            try {
                const params = new URLSearchParams();
                if (addressOverride) params.set('address', addressOverride);
                const pName = plantNameOverride || selectedPlant;
                if (pName) params.set('plant_name', pName);

                const url = params.toString() ? `${API_CARE}?${params.toString()}` : API_CARE;

                const res = await fetch(url, { method: 'GET', headers: { ...authHeaders() }, signal });
                const ct = res.headers.get('content-type') || '';
                const body = ct.includes('application/json') ? await res.json().catch(() => null) : null;

                if (handleAuthError(res)) return;

                if (!res.ok) {
                    if (res.status === 422) {
                        setHasAddress(false);
                        setResult(null);
                        return;
                    }
                    setError(`요청 실패: ${body?.detail || res.status}`);
                    return;
                }

                if (body?.need_plant_identification) {
                    alert('보유한 식물이 없습니다. 식물 식별 페이지로 이동합니다.');
                    window.location.href = 'https://plantmate.site/plantgrowthtracker';
                    return;
                }

                if (!body.address) {
                    setHasAddress(false);
                    setResult(null);
                    return;
                }

                setHasAddress(true);
                setResult(body);
            } catch (e) {
                if (e.name === 'AbortError') return;
                console.error('요청 오류:', e);
                setHasAddress(false);
                setResult(null);
                setError('네트워크 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        },
        [selectedPlant]
    );

    const saveAddress = useCallback(async (address) => {
        if (!ensureLoggedIn()) throw new Error('로그인이 필요합니다.');
        let lastErr;
        try {
            const res = await fetch(API_SAVE_ADDRESS, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ address }),
            });
            if (handleAuthError(res)) {
                lastErr = new Error('인증 오류');
            } else if (!res.ok) {
                lastErr = res;
            }
        } catch (e) {
            lastErr = e;
        }
        if (lastErr) {
            throw new Error(`주소 저장 실패 (${lastErr?.status || lastErr?.message || '알 수 없음'})`);
        }
    }, []);

    useEffect(() => {
        if (!getToken()) {
            redirectToLogin();
            return;
        }
        fetchMyPlants();
    }, [fetchMyPlants, redirectToLogin]);

    useEffect(() => {
        if (!selectedPlant) return;
        const controller = new AbortController();
        fetchCareAdvice(controller.signal, undefined, selectedPlant);
        return () => controller.abort();
    }, [selectedPlant, fetchCareAdvice]);

    const handleRefresh = () => {
        const controller = new AbortController();
        fetchCareAdvice(controller.signal, undefined, selectedPlant);
    };

    const handleAddressSubmit = async (override) => {
        const addr = (override ?? addressInput).trim();
        if (!addr) {
            alert('주소를 입력하거나 검색 버튼으로 선택해주세요.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await saveAddress(addr);
            setHasAddress(true);
            navigate('/care', { replace: true });
            const controller = new AbortController();
            await fetchCareAdvice(controller.signal, addr, selectedPlant);
        } catch (e) {
            console.error(e);
            alert(e.message || '주소 저장 중 문제가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (!hasAddress) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#D9E4E4', padding: 24 }}>
                <div style={{ width: '100%', maxWidth: 520, backgroundColor: '#fff', padding: 28, borderRadius: 16, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', textAlign: 'center' }}>
                    <h2 style={{ marginBottom: 10, color: '#2c3e50' }}>주소가 필요해요</h2>
                    <p style={{ marginBottom: 16, color: '#6b7280', fontSize: 14 }}>
                        날씨 기반 식물 가이드를 위해 주소(구/군 단위면 충분합니다)를 입력하거나 검색해 주세요.
                    </p>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <input
                            type="text"
                            value={addressInput}
                            onChange={(e) => setAddressInput(e.target.value)}
                            placeholder="예: 서울특별시 강남구 / 부산 해운대구"
                            style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #d1d5db', outline: 'none', fontSize: 15 }}
                        />
                        <button
                            onClick={openPostcode}
                            style={{ whiteSpace: 'nowrap', padding: '12px 14px', borderRadius: 10, border: '1px solid #b8c2cc', backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}
                        >
                            주소 검색
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button
                            onClick={() => handleAddressSubmit()}
                            disabled={loading}
                            style={{ padding: '10px 18px', backgroundColor: '#5e865f', color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                        >
                            {loading ? '저장 중...' : '확인(저장)'}
                        </button>
                    </div>

                    {!postcodeReady && (
                        <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
                            주소 검색 스크립트를 준비 중입니다…
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ paddingTop: 10, backgroundColor: '#D9E4E4', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: 1000, width: '100%', margin: '50px 20px', padding: 20, borderRadius: 16, backgroundColor: '#EFF7F8', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', textAlign: 'center', position: 'relative' }}>
                <h2 style={{ fontSize: 30, color: '#7f8c8d', marginBottom: 20, paddingTop: 30, fontWeight: 'bold' }}>
                    날씨 맞춤 식물 가이드
                </h2>

                {myPlants.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ marginRight: 12, fontWeight: 600, color: '#2c3e50' }}>보유 식물 선택</label>
                        <select
                            value={selectedPlant}
                            onChange={(e) => {
                                setSelectedPlant(e.target.value);
                                setResult(null);
                                setLoading(true);
                            }}
                            disabled={loading}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', outline: 'none' }}
                        >
                            {myPlants.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {loading && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.6)', borderRadius: 16, zIndex: 2
                    }}>
                        <div style={{ padding: '10px 16px', borderRadius: 999, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600 }}>
                            불러오는 중…
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ color: 'red', marginBottom: 20 }}>
                        <p>{error}</p>
                        <button
                            onClick={handleRefresh}
                            style={{ marginTop: 12, padding: '10px 20px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                        >
                            다시 시도
                        </button>
                    </div>
                )}

                {result?.weather && (
                    <div style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: 24 }}>
                        <h3 style={{ fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginBottom: 16 }}>
                            실시간 날씨 ({result.address})
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, textAlign: 'center' }}>
                            <div style={{ backgroundColor: '#f0f7f3', padding: 16, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>날씨</div>
                                <div style={{ color: '#555', marginTop: 4 }}>{result.weather['날씨']}</div>
                            </div>
                            <div style={{ backgroundColor: '#f0f7f3', padding: 16, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>기온</div>
                                <div style={{ color: '#555', marginTop: 4 }}>{result.weather['기온(°C)']}°C</div>
                            </div>
                            <div style={{ backgroundColor: '#f0f7f3', padding: 16, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>습도</div>
                                <div style={{ color: '#555', marginTop: 4 }}>{result.weather['습도(%)']}%</div>
                            </div>
                            <div style={{ backgroundColor: '#f0f7f3', padding: 16, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>바람</div>
                                <div style={{ color: '#555', marginTop: 4 }}>{result.weather['바람속도(m/s)']} m/s</div>
                            </div>
                            <div style={{ backgroundColor: '#f0f7f3', padding: 16, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>강수량</div>
                                <div style={{ color: '#555', marginTop: 4 }}>{result.weather['강수량(mm, 1시간)']} mm</div>
                            </div>
                        </div>
                    </div>
                )}

                {result?.care_advice?.length > 0 && (
                    <div style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginBottom: 20 }}>
                            {selectedPlant ? `${selectedPlant} 맞춤 관리 조언` : '식물별 맞춤 관리 조언'}
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, justifyItems: 'stretch', alignItems: 'stretch' }}>
                            {result.care_advice.map((item, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: 24,
                                        borderRadius: 12,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                        backgroundColor: '#f0f7f3',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        minHeight: 220,
                                        width: '100%',
                                        maxWidth: 'none',
                                    }}
                                >
                                    <h4 style={{ margin: 0, fontSize: 18, fontWeight: 'bold', color: '#15803d' }}>
                                        {item.plant}
                                    </h4>
                                    <p style={{ margin: '12px 0 0', color: '#374151', fontSize: 15, lineHeight: 1.8, textAlign: 'center' }}>
                                        {item.advice}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PlantCare;
