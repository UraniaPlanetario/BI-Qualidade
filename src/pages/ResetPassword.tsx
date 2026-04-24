import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import logoUrania from '@/assets/logo-urania.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // O Supabase processa o token automaticamente quando a página carrega
    // via hash params e cria uma sessão de recovery
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });

    // Checar se já tem sessão (caso o event tenha disparado antes do listener)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => {
        supabase.auth.signOut();
        navigate('/');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm card-glass p-8">
        <div className="text-center mb-8">
          <img src={logoUrania} alt="Urânia" className="h-16 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">BI Urânia</p>
        </div>

        {success ? (
          <div className="text-center space-y-3">
            <CheckCircle2 className="mx-auto text-green-500" size={48} />
            <p className="text-foreground font-medium">Senha atualizada!</p>
            <p className="text-xs text-muted-foreground">Redirecionando para o login...</p>
          </div>
        ) : !sessionReady ? (
          <div className="text-center space-y-3">
            <Loader2 className="animate-spin text-primary mx-auto" size={32} />
            <p className="text-sm text-muted-foreground">Validando link...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-foreground mb-2 text-center">Nova senha</p>
              <p className="text-xs text-muted-foreground text-center">
                Escolha uma senha com pelo menos 8 caracteres.
              </p>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirmar senha"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
                minLength={8}
              />
            </div>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <button
              type="submit"
              className="w-full py-2 rounded-lg gradient-primary text-white font-medium disabled:opacity-50"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
