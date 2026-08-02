import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { Server, Lock } from 'lucide-react';
import { api } from '../services/apiClient';

const Login: React.FC = () => {
  const { login, user, loginError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [appName, setAppName] = useState('SLSS - 服务器全生命周期系统');
  const [companyLogo, setCompanyLogo] = useState('');

  // Branding is intentionally loaded from the same public settings endpoints
  // used by the authenticated layout. This keeps the login page in sync with
  // the name and logo configured in System Management, without requiring a
  // session just to render the login screen.
  useEffect(() => {
    let active = true;
    Promise.all([api.systemSettings(), api.companyLogo()])
      .then(([settings, logo]) => {
        if (!active) return;
        if (settings?.appName) {
          setAppName(settings.appName);
          document.title = settings.appName;
        }
        if (logo?.value) setCompanyLogo(logo.value);
      })
      .catch(() => {
        // Login must remain usable when the optional branding request fails.
      });
    return () => { active = false; };
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const success = await login(username, password);
    if (success) {
      navigate('/dashboard');
    } else {
      setError(loginError || '用户名或密码错误');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          {companyLogo ? (
            <img src={companyLogo} alt={`${appName} Logo`} className="mx-auto h-12 max-w-[220px] object-contain" />
          ) : (
            <Server className="mx-auto h-12 w-12 text-blue-600" />
          )}
          <h2 className="mt-4 text-3xl font-extrabold text-gray-900">{appName}</h2>
          <p className="mt-2 text-sm text-gray-600">系统登录</p>
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">用户名</label>
            <input 
              type="text" 
              required 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">密码</label>
            <input 
              type="password" 
              required 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>
          
          {error && <div className="text-red-500 text-sm text-center">{error}</div>}

          <div>
            <button 
              type="submit" 
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
            >
              <Lock className="w-4 h-4 mr-2" /> 登录系统
            </button>
          </div>
        </form>
        <div className="mt-4 text-center text-xs text-gray-400">
           <p>演示账号: admin / admin123</p>
           <p>其他角色密码: 123456</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
