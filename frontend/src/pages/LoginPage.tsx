import { motion } from "motion/react";
import { Building2, LogIn, Moon, Sun, Loader } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useAuth as useOidcAuth } from "react-oidc-context";

interface Props { dark: boolean; toggleDark: () => void; }

export function LoginPage({ dark, toggleDark }: Props) {
  const { login, error } = useAuth();
  const oidc = useOidcAuth();

  const oidcReady = !oidc.isLoading && !oidc.error;
  const oidcInitError = oidc.error
    ? `Não foi possível conectar ao servidor de autenticação: ${oidc.error.message}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: "var(--bg-tertiary)" }}>

      <button onClick={toggleDark}
        className="absolute top-4 right-4 p-2 rounded-xl border transition-all"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-md)" }}>

        {/* Header UCDB */}
        <div className="p-8 text-center" style={{ background: "var(--ucdb-blue)" }}>
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl" style={{ background: "var(--ucdb-gold)" }}>
              <Building2 size={32} style={{ color: "var(--ucdb-blue-dark)" }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">LabManager Pro</h1>
          <p className="text-sm mt-1 font-medium" style={{ color: "var(--ucdb-gold)" }}>
            Universidade Católica Dom Bosco
          </p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
            Sistema de Gestão de Laboratórios
          </p>
        </div>

        <div className="p-8 space-y-5">
          {(error || oidcInitError) && (
            <div className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}>
              {error || oidcInitError}
            </div>
          )}

          <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            O acesso é realizado pelo portal institucional da UCDB.<br />
            Clique abaixo para ser redirecionado com segurança.
          </p>

          <button
            onClick={login}
            disabled={!oidcReady}
            className="w-full flex items-center justify-center gap-3 font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--ucdb-blue)", color: "#fff" }}
            onMouseEnter={e => { if (oidcReady) (e.currentTarget as HTMLElement).style.background = "var(--ucdb-blue-dark)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--ucdb-blue)"; }}>
            {oidc.isLoading
              ? <><Loader size={18} className="animate-spin" /> Conectando ao servidor...</>
              : <><LogIn size={18} /> Entrar com Conta Institucional UCDB</>
            }
          </button>

          <p className="text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
            Acesso restrito a funcionários e alunos autorizados.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
