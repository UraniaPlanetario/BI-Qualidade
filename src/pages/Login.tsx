import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Loader2, ArrowLeft } from 'lucide-react';
import logoUrania from '@/assets/logo-urania.png';

type Mode = 'login' | 'forgot';

export default function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccess('Email enviado! Verifique sua caixa de entrada para redefinir a senha.');
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar email de recuperação');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm card-glass p-8">
        <div className="text-center mb-8">
          <img src={logoUrania} alt="Urânia" className="h-16 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">BI Urânia</p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <button
              type="submit"
              className="w-full py-2 rounded-lg gradient-primary text-white font-medium disabled:opacity-50"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Esqueci minha senha
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <p className="text-sm text-foreground mb-2 text-center">Redefinir senha</p>
              <p className="text-xs text-muted-foreground text-center">
                Digite seu email e enviaremos um link para criar uma nova senha.
              </p>
            </div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            {success && <p className="text-green-500 text-sm text-center">{success}</p>}
            <button
              type="submit"
              className="w-full py-2 rounded-lg gradient-primary text-white font-medium disabled:opacity-50"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Enviar link'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={12} /> Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
