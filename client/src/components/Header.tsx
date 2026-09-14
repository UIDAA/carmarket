import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user } = useAuth();

  return (
    <header className="app-header">
      <Link to="/" className="display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
        중고차마당
      </Link>
      <div className="app-header-nav">
        {user ? (
          <>
            <Link to="/mypage?tab=favorites" className="nav-link">
              찜한 매물
            </Link>
            <Link to="/mypage?tab=chats" className="nav-link">
              채팅
            </Link>
            <Link to="/mypage" className="avatar">
              {user.nickname.slice(0, 1)}
            </Link>
            <Link to="/cars/new" className="btn-primary">
              + 매물 등록
            </Link>
          </>
        ) : (
          <Link to="/login" className="btn-primary">
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
