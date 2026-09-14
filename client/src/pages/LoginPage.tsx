import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다.');
    }
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: 420,
          maxWidth: '90vw',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 10px 32px rgba(34,29,24,0.08)',
          padding: 36,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
            중고차마당
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 24 }}>
          <div className="tab active">로그인</div>
          <Link to="/register" className="tab" style={{ display: 'block' }}>
            회원가입
          </Link>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <p role="alert" style={{ marginBottom: 16 }}>
              {error}
            </p>
          )}
          <div className="field">
            <label>이메일</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>비밀번호</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
            로그인
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-soft)' }}>
          계정이 없으신가요? <Link to="/register">회원가입</Link>
        </div>
      </div>
    </div>
  );
}
