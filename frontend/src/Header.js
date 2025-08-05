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
                <Link
                    to="/"
                    className="logo"
                    style={{ textDecoration: "none", color: "inherit" }}
                >
                    <div className="logo">
                        <i className="fas fa-leaf"></i>
                        <span>PlantMate</span>
                    </div>
                </Link>

                <nav className="main-nav">
                    <a href="/" className="nav-link active">
                        홈
                    </a>
                    <a href="#" className="nav-link">
                        식물 관리
                    </a>
                    <a href="#" className="nav-link">
                        기능 소개
                    </a>
                    <a href="#" className="nav-link">
                        문의하기
                    </a>
                </nav>

                <div className="auth-buttons">
                    {isLoggedIn ? (
                        <button className="btn btn-outline" onClick={handleLogout}>
                            로그아웃
                        </button>
                    ) : (
                        <>
                            <Link to="http://15.168.150.125:5000/login" className="btn btn-outline">
                                로그인
                            </Link>
                            <Link to="/register" className="btn btn-primary">
                                회원가입
                            </Link>
                        </>
                    )}
                </div>
            </header>
        </div>
    );
};

export default Header;