import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  login: (username: string, password?: string, captcha?: { token?: string; answer?: string }) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  loginError: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const synchronize = (event: Event) => setUser((event as CustomEvent<User>).detail);
    window.addEventListener('slss-session-updated', synchronize);
    let mounted = true;

    // Do not trust a cached user object as an authenticated session. The
    // refresh cookie is HttpOnly and therefore cannot be inspected here; ask
    // the server on every boot and only hydrate the UI after it validates the
    // session and returns the current authorities.
    api.refreshSession().then((result: any) => {
      if (!mounted || !result?.token) return;
      const cached = JSON.parse(localStorage.getItem('slss_user') || '{}');
      const synchronizedUser = {
        id: Number(cached.id || 0),
        username: result.username || cached.username || '',
        role: cached.role || UserRole.ADMIN,
        password: '',
        status: 'active',
        permissions: (result.authorities || []).map((a: string) => a.replace(/^PERM_/, '')),
        mustChangePassword: Boolean(result.mustChangePassword),
      } as User;
      localStorage.setItem('slss_user', JSON.stringify(synchronizedUser));
      setUser(synchronizedUser);
      window.dispatchEvent(new CustomEvent('slss-session-updated', { detail: synchronizedUser }));
    }).catch(() => {
      // A revoked/expired cookie must not leave a stale cached account active.
      localStorage.removeItem('slss_user');
      if (mounted) setUser(null);
    }).finally(() => { if (mounted) setLoading(false); });

    return () => {
      mounted = false;
      window.removeEventListener('slss-session-updated', synchronize);
    };
  }, []);

  const login = async (username: string, password?: string, captcha?: { token?: string; answer?: string }): Promise<boolean> => {
    setLoginError('');
    sessionStorage.removeItem('slss_password_change_skipped');
    try {
        const result = await api.login(username, password || '', captcha);
        const remoteUser = { id: 0, username: result.username, role: UserRole.ADMIN, password: '', status: 'active', permissions: result.authorities.map(a => a.replace(/^PERM_/, '')), mustChangePassword: Boolean(result.mustChangePassword) } as unknown as User;
        setUser(remoteUser);
        localStorage.setItem('slss_user', JSON.stringify(remoteUser));
        return true;
    } catch (error: any) {
      setLoginError(error?.message || '用户名或密码错误');
      return false;
    }
  };

  const logout = () => {
    // Revoke the server-side refresh token before removing the local access
    // token. Cleanup still happens when the network is unavailable.
    void api.logout().catch(() => undefined);
    setUser(null);
    localStorage.removeItem('slss_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, loginError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
