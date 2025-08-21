import React, { useEffect, useState } from "react";
import "./App.css";
import { Link, useNavigate } from 'react-router-dom';

const Header = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        setIsLoggedIn(!!token);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        setIsLoggedIn(false);
        navigate("/");
    };

    return (
        <div>
            <link
                rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
            />
            <title>PlantMate</title>
            <header className="app-header">
                <a href="https://plantmate.site" className="logo" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="logo">
                        <i className="fas fa-leaf"></i>
                        <span>PlantMate</span>
                    </div>
                </a>

                <nav className="main-nav">
                    <a href="https://plantmate.site" className="nav-link active">홈</a>
                    <a href="https://plantmate.site/plantsearch" className="nav-link">식물 식별</a>
                    <Link to="/recommend" className="nav-link">식물 추천</Link>
                    <Link to="/care" className="nav-link">성장 가이드</Link>
                    <a href="https://plantmate.site/plantgrowthtracker" className="nav-link">성장 레포트</a>
                    <a href="https://plantmate.site/garden" className="nav-link">정원 꾸미기</a>
                </nav>

                <div className="auth-buttons">
                    {isLoggedIn ? (
                        <button className="btn btn-outline" onClick={handleLogout}>
                            로그아웃
                        </button>
                    ) : (
                        <>
                            <a href="https://plantmate.site/login" className="btn btn-outline">로그인</a>
                            <a href="https://plantmate.site/register" className="btn btn-primary">회원가입</a>
                        </>
                    )}
                </div>
            </header>
        </div>
    );
};

export default Header;
