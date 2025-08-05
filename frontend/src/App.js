import { HashRouter, Routes, Route } from 'react-router-dom';
import Header from './Header';
import PlantRecommend from './PlantRecommend';
import PlantCare from './PlantCare';

function App() {
    return (
        <HashRouter>
            <Header />

            <Routes>
                <Route path="/" element={<PlantRecommend />} />
                <Route path="/recommend" element={<PlantRecommend />} />
                <Route path="/care" element={<PlantCare />} />
            </Routes>
        </HashRouter>
    );
}

export default App;
