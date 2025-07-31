import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './Header';
import PlantRecommend from './PlantRecommend';
import PlantCare from './PlantCare';

function App() {
    return (
        <BrowserRouter>
            <Header />

            <Routes>
                <Route path="/recommend" element={<PlantRecommend />} />
                <Route path="/care" element={<PlantCare />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;