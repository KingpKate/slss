
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Permission } from '../types';
import bcrypt from 'bcryptjs';

interface RegisterData {
  username: string;
  password?: string;
  role: UserRole;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  usersList: User[];
  login: (username: string, password?: string) => Promise<{success: boolean; message?: string}>;
  logout: () => void;
  register: (data: RegisterData) => Promise<{success: boolean; message?: string}>;
  updateUserStatus: (id: number, status: 'active' | 'pending') => void;
  deleteUser: (id: number) => void;
  addUser: (newUser: Omit<User, 'id'>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedSession = localStorage.getItem('slss_user');
      if (savedSession) {
        try {
          setUser(JSON.parse(savedSession));
        } catch (e) {
          localStorage.removeItem('slss_user');
        }
      }
      await fetchUsers();
      setLoading(false);
    };
    initAuth();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (e) {
      console.error("Failed to fetch users:", e);
    }
  };

  const login = async (username: string, password?: string): Promise<{success: boolean; message?: string}> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        localStorage.setItem('slss_user', JSON.stringify(data.user));
        return { success: true };
      }
      return { success: false, message: data.message || '登录失败' };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { success: false, message: '服务器响应超时，请检查网络或联系管理员' };
      }
      return { success: false, message: '服务器连接失败' };
    }
  };

  const register = async (data: RegisterData): Promise<{success: boolean; message?: string}> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        fetchUsers();
        return { success: true, message: '注册成功！请等待管理员审核。' };
      }
      return { success: false, message: result.message || '注册失败' };
    } catch (e) {
      return { success: false, message: '服务器错误' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('slss_user');
  };

  // --- Admin Functions ---

  const updateUserStatus = async (id: number, status: 'active' | 'pending') => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setUsersList(prev => prev.map(u => u.id === id ? { ...u, status } : u));
    } catch (e) { console.error(e); }
  };

  const deleteUser = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setUsersList(prev => prev.filter(u => u.id !== id));
    } catch (e) { console.error(e); }
  };

  const addUser = async (userData: Omit<User, 'id'>) => {
    const hashedPassword = userData.password ? await bcrypt.hash(userData.password, 10) : '';
    const newUser: User = {
      id: Date.now(),
      ...userData,
      password: hashedPassword,
      permissions: userData.permissions && userData.permissions.length > 0
        ? userData.permissions
        : getDefaultPermissions(userData.role)
    };

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      fetchUsers();
    } catch (e) { console.error(e); }
  };

  // V2.0: Default permissions for all 8 roles
  const getDefaultPermissions = (role: UserRole): Permission[] => {
    switch (role) {
      case UserRole.ADMIN:
        return [
          'VIEW_DASHBOARD', 'MANAGE_SYSTEM',
          'VIEW_ORDERS', 'MANAGE_ORDERS', 'DESIGN_PROCESS',
          'PROD_ENTRY_ASSEMBLY', 'PROD_ENTRY_INSPECT_INIT', 'PROD_ENTRY_AGING', 'PROD_ENTRY_INSPECT_FINAL',
          'PROD_REPAIR', 'PROD_QUERY',
          'FIN_VIEW_QUOTATION', 'FIN_CREATE_QUOTATION', 'FIN_PRODUCT_REVIEW', 'FIN_PROCUREMENT_PRICE',
          'FIN_APPROVE_MARGIN', 'FIN_INITIATE_PROJECT', 'FIN_PROCUREMENT_EXECUTE', 'FIN_BUSINESS_TRACK',
          'FIN_SETTLEMENT', 'FIN_PAYMENT_REVIEW', 'FIN_VIEW_DASHBOARD',
          'PROD_MANAGE_SETTINGS', 'PROD_MANAGE_SCAN_TPL', 'PROD_SOP_MANAGE', 'PROD_SHIPPING'
        ];
      case UserRole.MANAGER:
        return [
          'VIEW_DASHBOARD', 'VIEW_ORDERS', 'MANAGE_ORDERS',
          'PROD_QUERY', 'FIN_VIEW_QUOTATION', 'FIN_VIEW_DASHBOARD', 'FIN_APPROVE_MARGIN'
        ];
      case UserRole.TECHNICIAN:
        return ['VIEW_DASHBOARD', 'VIEW_ORDERS', 'MANAGE_ORDERS'];
      case UserRole.PRODUCTION:
        return [
          'VIEW_DASHBOARD',
          'PROD_ENTRY_ASSEMBLY', 'PROD_ENTRY_INSPECT_INIT', 'PROD_ENTRY_AGING', 'PROD_ENTRY_INSPECT_FINAL',
          'PROD_REPAIR', 'PROD_QUERY', 'PROD_MANAGE_SETTINGS', 'PROD_MANAGE_SCAN_TPL', 'PROD_SOP_MANAGE', 'PROD_SHIPPING'
        ];
      case UserRole.SALES:
        return [
          'VIEW_DASHBOARD',
          'FIN_VIEW_QUOTATION', 'FIN_CREATE_QUOTATION', 'FIN_INITIATE_PROJECT',
          'FIN_BUSINESS_TRACK', 'FIN_PAYMENT_REVIEW', 'FIN_VIEW_DASHBOARD'
        ];
      case UserRole.FINANCE:
        return [
          'VIEW_DASHBOARD',
          'FIN_VIEW_QUOTATION', 'FIN_SETTLEMENT', 'FIN_PAYMENT_REVIEW', 'FIN_VIEW_DASHBOARD'
        ];
      case UserRole.PROCUREMENT:
        return [
          'VIEW_DASHBOARD',
          'FIN_VIEW_QUOTATION', 'FIN_PROCUREMENT_PRICE', 'FIN_PROCUREMENT_EXECUTE'
        ];
      case UserRole.PRODUCT:
        return [
          'VIEW_DASHBOARD',
          'FIN_VIEW_QUOTATION', 'FIN_PRODUCT_REVIEW'
        ];
      default:
        return ['VIEW_DASHBOARD'];
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      usersList,
      login,
      logout,
      register,
      updateUserStatus,
      deleteUser,
      addUser
    }}>
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
