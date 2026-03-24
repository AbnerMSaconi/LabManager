import React, { useState } from "react";
import { motion } from "motion/react";
import { Building2, User as UserIcon, Moon, Sun } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface Props { dark: boolean; toggleDark: () => void; }

export function LoginPage({ dark, toggleDark }: Props) {
  const { login, error } = useAuth();
  const [registration, setRegistration] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await login(registration, password); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: "var(--bg-tertiary)" }}>

      {/* Dark mode toggle */}
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

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-secondary)" }}>
              Registro (RA ou RF) / E-mail
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2" size={18}
                style={{ color: "var(--text-tertiary)" }} />
              <input type="text" required value={registration}
                onChange={e => setRegistration(e.target.value)}
                placeholder="RA2024001 ou email@ucdb.br"
                className="w-full rounded-xl py-3 pl-10 pr-4 border text-sm"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-secondary)" }}>
              Senha
            </label>
            <input type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl py-3 px-4 border text-sm"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
            style={{ background: "var(--ucdb-blue)", color: "#fff" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--ucdb-blue-dark)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--ucdb-blue)"; }}>
            {loading ? "Entrando..." : "Entrar no Sistema"}
          </button>

          <p className="text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
            Acesso restrito a funcionários e alunos autorizados.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
