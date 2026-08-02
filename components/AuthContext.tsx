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
    // Check localStorage for persisted session
    const savedUser = localStorage.getItem('slss_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    // Refresh the server session on boot so permission changes made by an
    // administrator are reflected immediately without relying on stale cache.
    if (localStorage.getItem('slss_token')) {
      api.refreshSession().then((result: any) => {
        const previous = savedUser ? JSON.parse(savedUser) : {};
        const synchronizedUser = {
          ...previous,
          id: previous.id || 0,
          username: result.username || previous.username,
          permissions: (result.authorities || []).map((a: string) => a.replace(/^PERM_/, '')),
          mustChangePassword: Boolean(result.mustChangePassword),
        } as User;
        localStorage.setItem('slss_token', result.token);
        localStorage.setItem('slss_user', JSON.stringify(synchronizedUser));
        setUser(synchronizedUser);
        window.dispatchEvent(new CustomEvent('slss-session-updated', { detail: synchronizedUser }));
      }).catch(() => {
        // Keep the existing session; the request interceptor will handle an
        // actually expired/revoked session on the next API call.
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    const synchronize = (event: Event) => setUser((event as CustomEvent<User>).detail);
    window.addEventListener('slss-session-updated', synchronize);
    return () => window.removeEventListener('slss-session-updated', synchronize);
  }, []);

  const login = async (username: string, password?: string, captcha?: { token?: string; answer?: string }): Promise<boolean> => {
    setLoginError('');
    sessionStorage.removeItem('slss_password_change_skipped');
    try {
        const result = await api.login(username, password || '', captcha);
        localStorage.setItem('slss_token', result.token);
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
    setUser(null);
    localStorage.removeItem('slss_user');
    localStorage.removeItem('slss_token');
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
