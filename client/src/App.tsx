import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CarListPage from './pages/CarListPage';
import SearchResultsPage from './pages/SearchResultsPage';
import CarDetailPage from './pages/CarDetailPage';
import CarFormPage from './pages/CarFormPage';
import MyPage from './pages/MyPage';
import ChatRoomPage from './pages/ChatRoomPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<CarListPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/cars/new" element={<CarFormPage />} />
          <Route path="/cars/:id/edit" element={<CarFormPage />} />
          <Route path="/cars/:id" element={<CarDetailPage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/chat/:id" element={<ChatRoomPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
