import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Logo } from '@/components/layout/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { PriorityBadge } from '@/components/Badges';

const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
const registerSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email: z.string().email('Enter a valid email'), password: z.string().min(8, 'Use at least 8 characters') });

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register: signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';
  const form = useForm<{ name?: string; email: string; password: string }>({ resolver: zodResolver(isLogin ? loginSchema : registerSchema), defaultValues: { name: '', email: '', password: '' } });
  const { errors } = form.formState;

  if (user) return <Navigate to={from} replace />;

  const onSubmit = form.handleSubmit(async (v) => {
    setBusy(true);
    try {
      const u = isLogin ? await login(v.email, v.password) : await signup(v.name!, v.email, v.password);
      toast.success(isLogin ? `Welcome back, ${u.name.split(' ')[0]}` : 'Account created. Make your first board!');
      navigate(from, { replace: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-extrabold">{isLogin ? 'Sign in to TaskFlow' : 'Create your account'}</h1>
          <p className="mt-2 text-muted">{isLogin ? 'Pick up right where your team left off.' : 'Plan, track and ship work together, in real time.'}</p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {!isLogin && <Field label="Full name" error={errors.name?.message} htmlFor="name"><Input id="name" autoComplete="name" invalid={!!errors.name} {...form.register('name')} /></Field>}
            <Field label="Work email" error={errors.email?.message} htmlFor="email"><Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...form.register('email')} /></Field>
            <Field label="Password" error={errors.password?.message} htmlFor="password"><Input id="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} invalid={!!errors.password} {...form.register('password')} /></Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>{isLogin ? 'Sign in' : 'Create account'}</Button>
          </form>
          {isLogin && (
            <div className="mt-6 rounded-2xl border border-dashed border-line p-4 text-sm">
              <p className="font-semibold">Demo accounts <span className="font-normal text-muted">· password Demo@1234</span></p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[['Fayaz', 'fayaz', '#5E5CE6'], ['Priya', 'priya', '#EC4899'], ['Arjun', 'arjun', '#0EA5E9']].map(([n, e, c]) => (
                  <button key={e} type="button" onClick={() => { form.setValue('email', `${e}@taskflow.dev`); form.setValue('password', 'Demo@1234'); }} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 font-semibold transition hover:border-brand-300">
                    <Avatar name={n} color={c} size={24} /> {n}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">Open two browsers as different people to watch tasks move live.</p>
            </div>
          )}
          <p className="mt-8 text-center text-sm text-muted">
            {isLogin ? 'New here? ' : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} className="font-semibold text-brand-600 hover:underline">{isLogin ? 'Create an account' : 'Sign in'}</Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-brand-500 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_10%,rgba(255,255,255,.25),transparent_60%),radial-gradient(60%_60%_at_0%_100%,rgba(17,19,34,.35),transparent_70%)]" />
        <div className="relative flex h-full flex-col justify-center gap-10 p-14 text-white">
          <div className="grid max-w-xl grid-cols-3 gap-3">
            {[
              ['To do', '#3B82F6', [['Design pricing page', 'high'], ['Storybook setup', 'medium']]],
              ['In progress', '#F59E0B', [['Responsive nav', 'urgent']]],
              ['Done', '#10B981', [['Colour tokens', 'high'], ['Kick-off', 'low']]],
            ].map(([name, color, cards]) => (
              <div key={name as string} className="rounded-2xl bg-white/10 p-2.5 backdrop-blur">
                <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold"><span className="h-2 w-2 rounded-full" style={{ background: color as string }} />{name as string}</p>
                <div className="space-y-2">
                  {(cards as string[][]).map(([t, p]) => (
                    <div key={t} className="rounded-lg bg-white p-2.5 text-ink shadow-lg">
                      <p className="text-xs font-semibold">{t}</p>
                      <div className="mt-2"><PriorityBadge priority={p as 'low'} compact /></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="max-w-md space-y-3">
            {['Drag tasks across columns and everyone sees it instantly', 'Roles for admins, members and viewers', 'Deadlines, checklists, comments and notifications'].map((t) => (
              <p key={t} className="flex items-center gap-3 font-semibold"><CheckCircle2 className="h-5 w-5 shrink-0 text-white/80" /> {t}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
