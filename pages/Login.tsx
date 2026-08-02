import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { Activity, Eye, EyeOff, Lock, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { api } from '../services/apiClient';

type Branding = {
  appName: string;
  subtitle?: string;
  logo?: string;
  backgroundMode?: 'solid' | 'single' | 'carousel' | 'gradient';
  backgroundColor?: string;
  backgroundImages?: string[];
  backgroundIntervalSeconds?: number;
  backgroundOverlay?: number;
  backgroundPosition?: string;
  captchaPolicy?: { enabled?: boolean; triggerAfterFailures?: number };
};

const fallbackBranding: Branding = {
  appName: 'SLSS MES · 制造运营系统',
  subtitle: '统一管理生产、售后、资产生命周期与交付风险。',
  backgroundMode: 'gradient',
  backgroundColor: '#0f172a',
  backgroundImages: ['/login-backgrounds/logo.jpg'],
  backgroundIntervalSeconds: 8,
  backgroundOverlay: 0.58,
  backgroundPosition: 'center',
};

const resolveAssetUrl = (value: string) => {
  if (!value || /^(https?:|data:|blob:)/i.test(value)) return value;
  const path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
  return `${path}${value.startsWith('/') ? value : `/${value}`}` || value;
};

const Login: React.FC = () => {
  const { login, user, loginError } = useAuth();
  const navigate = useNavigate();
  const [branding, setBranding] = useState<Branding>(fallbackBranding);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaSecondsLeft, setCaptchaSecondsLeft] = useState(0);

  useEffect(() => {
    let active = true;
    api.branding().then((value: Branding) => {
      if (!active) return;
      // An empty server list means no custom background has been configured;
      // retain the bundled default instead of replacing it with an empty list.
      const next = {
        ...fallbackBranding,
        ...value,
        logo: value.logo ? resolveAssetUrl(value.logo) : value.logo,
        backgroundImages: value.backgroundImages?.length ? value.backgroundImages : fallbackBranding.backgroundImages,
      };
      setBranding(next);
      if (next.appName) document.title = next.appName;
    }).catch(() => undefined);
    api.loginBackgroundAssets().then((assets: any[]) => {
      if (!active || !assets?.length) return;
      setBranding(current => ({ ...current, backgroundImages: assets.map(asset => resolveAssetUrl(asset.url || '')) }));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => { if (user) navigate('/dashboard'); }, [user, navigate]);

  useEffect(() => {
    if (!captchaToken || captchaSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setCaptchaSecondsLeft(value => {
        if (value <= 1) {
          window.clearInterval(timer);
          setCaptchaToken('');
          setCaptchaImage('');
          setCaptchaAnswer('');
          setError('验证码已过期，请重新获取');
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [captchaToken, captchaSecondsLeft]);

  const backgrounds = useMemo(() => (branding.backgroundImages || []).filter(Boolean), [branding.backgroundImages]);
  const isCarousel = branding.backgroundMode === 'carousel' && backgrounds.length > 1;
  useEffect(() => {
    if (!isCarousel || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.visibilityState !== 'visible') return;
    const timer = window.setInterval(() => setBackgroundIndex(index => (index + 1) % backgrounds.length), Math.max(3, branding.backgroundIntervalSeconds || 8) * 1000);
    const pause = () => { if (document.visibilityState === 'hidden') setBackgroundIndex(index => index); };
    document.addEventListener('visibilitychange', pause);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', pause); };
  }, [isCarousel, backgrounds.length, branding.backgroundIntervalSeconds]);

  const requestCaptcha = async () => {
    if (!username.trim()) return;
    setCaptchaLoading(true);
    try {
      const challenge = await api.captchaChallenge(username.trim());
      setCaptchaToken(challenge.token || '');
      setCaptchaImage(challenge.image || '');
      setCaptchaAnswer('');
      setCaptchaSecondsLeft(Math.max(0, Number(challenge.expiresInSeconds || 0)));
    } catch (e: any) { setError(e?.message || '验证码获取失败，请稍后重试'); }
    finally { setCaptchaLoading(false); }
  };

  const refreshCaptchaStatus = async () => {
    if (!username.trim()) return;
    try {
      const status = await api.captchaStatus(username.trim());
      setCaptchaRequired(Boolean(status.required));
      if (status.required && !captchaToken) await requestCaptcha();
    } catch { /* older servers may not expose captcha status yet */ }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setSubmitting(true);
    try {
      const ok = await login(username.trim(), password, captchaRequired ? { token: captchaToken, answer: captchaAnswer } : undefined);
      if (ok) navigate('/dashboard');
      else {
        setError(loginError || '用户名或密码错误');
        try { const status = await api.captchaStatus(username.trim()); setCaptchaRequired(Boolean(status.required)); if (status.required) await requestCaptcha(); } catch { /* keep login error */ }
      }
    } catch (e: any) { setError(e?.message || '登录失败，请稍后重试'); }
    finally { setSubmitting(false); }
  };

  const solidBackground = branding.backgroundColor || '#0f172a';
  return <main className="slss-login-page relative grid min-h-screen place-items-center overflow-hidden p-4" style={{ background: solidBackground }}>
    {backgrounds.map((src, index) => <img key={`${src}-${index}`} src={resolveAssetUrl(src)} alt="" aria-hidden="true" onError={event => { (event.currentTarget as HTMLImageElement).style.display = 'none'; }} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${index === (backgroundIndex % backgrounds.length) ? 'opacity-100' : 'opacity-0'}`} style={{ objectPosition: branding.backgroundPosition || 'center' }} />)}
    {backgrounds.length > 0 && <div className="absolute inset-0" style={{ backgroundColor: `rgba(2,6,23,${Math.min(0.9, Math.max(0, (branding.backgroundOverlay ?? 0.58) > 1 ? (branding.backgroundOverlay as number) / 100 : (branding.backgroundOverlay ?? 0.58)))})` }} />}
    <div className="relative z-10 slss-login-card grid w-full max-w-5xl overflow-hidden lg:grid-cols-[1.05fr_.95fr]">
      <section className="slss-login-brand relative hidden overflow-hidden p-10 text-white lg:block"><div className="slss-login-orb" /><div className="relative flex h-full flex-col justify-between"><div><div className="mb-10 flex items-center gap-3"><div className="slss-login-logo-safe">{branding.logo ? <img src={branding.logo} alt="公司 LOGO" /> : <Server size={25} />}</div><span className="text-sm font-bold tracking-wide">{branding.appName}</span></div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--theme-primary-border)]">Manufacturing control</p><h1 className="mt-4 max-w-md text-4xl font-bold leading-tight">让每一次扫码，都成为可追溯的生产事实。</h1><p className="mt-5 max-w-md text-sm leading-7 text-white/70">{branding.subtitle}</p></div><div className="flex items-center gap-6 text-xs text-white/70"><span className="flex items-center gap-2"><Activity size={15} className="text-[var(--theme-primary-border)]" />API 实时连接</span><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[var(--theme-primary-border)]" />RBAC 安全控制</span></div></div></section>
      <section className="bg-white/95 p-7 backdrop-blur sm:p-10"><div className="mx-auto max-w-md"><div className="mb-8 lg:hidden"><div className="mb-5 flex items-center gap-3">{branding.logo ? <img src={branding.logo} alt="公司 LOGO" className="h-11 w-11 object-contain" /> : <Server className="text-[var(--color-primary)]" size={28} />}<span className="font-bold text-[var(--color-primary)]">{branding.appName}</span></div></div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Secure sign in</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-primary)]">登录工作台</h2><p className="mt-2 text-sm text-slate-500">使用管理员为你分配的账号继续。</p><form onSubmit={submit} className="mt-8 space-y-5"><div><label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">用户名</label><input id="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} onBlur={refreshCaptchaStatus} className="slss-input" placeholder="请输入用户名" /></div><div><label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">密码</label><div className="relative"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="slss-input pr-11" placeholder="请输入密码" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-soft)]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>{captchaRequired && <div><div className="mb-2 flex items-center justify-between"><label htmlFor="captcha" className="text-sm font-semibold text-slate-700">验证码</label><div className="flex items-center gap-3"><span className={`text-xs ${captchaSecondsLeft > 10 ? 'text-slate-500' : 'font-semibold text-red-600'}`}>{captchaSecondsLeft > 0 ? `剩余 ${captchaSecondsLeft} 秒` : '已过期'}</span><button type="button" onClick={requestCaptcha} disabled={captchaLoading} className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"><RefreshCw size={13} className={captchaLoading ? 'animate-spin' : ''} />换一张</button></div></div><div className="flex gap-2"><input id="captcha" required value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)} className="slss-input flex-1" placeholder={captchaSecondsLeft > 0 ? '请输入验证码' : '验证码已过期，请换一张'} disabled={captchaSecondsLeft <= 0} />{captchaImage && <img src={captchaImage} alt="验证码" className="h-[46px] w-28 rounded border border-slate-200 object-contain" />}</div></div>}{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}<button disabled={submitting} className="slss-btn-primary min-h-[46px] w-full disabled:cursor-not-allowed disabled:opacity-60"><Lock size={16} />{submitting ? '验证中…' : '登录系统'}</button></form><p className="mt-8 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">登录后可用模块由用户权限实时决定</p></div></section>
    </div>
  </main>;
};
export default Login;
