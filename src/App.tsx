import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Calendar, Package, Monitor,
  LogOut, Clock, Wrench, Building2,
  Menu, X, Users, Settings, Moon, Sun, ChevronLeft, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserRole } from "./types";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { LoginPage }         from "./pages/LoginPage";
import { DashboardPage }     from "./pages/DashboardPage";
import { ReservationsPage }  from "./pages/ReservationsPage";
import { ReservationWizard } from "./pages/ReservationWizard";
import { InventoryPage }     from "./pages/InventoryPage";
import { LabsPage }          from "./pages/LabsPage";
import { DailyPage }         from "./pages/DailyPage";
import { MaintenancePage }   from "./pages/MaintenancePage";
import { UsersPage }         from "./pages/UsersPage";
import { MovementsPage }     from "./pages/MovementsPage";
import { SSEListener } from './components/SSEListener';
import { SettingsPage } from "./pages/SettingsPage";

// ── Dark mode hook ────────────────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("ucdb-theme");
    return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("ucdb-theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, () => setDark(d => !d)] as const;
}

// ── Menu ──────────────────────────────────────────────────────────────────────
interface MenuItem { id: string; label: string; icon: React.ElementType; roles: UserRole[] }

const MENU_ITEMS: MenuItem[] = [
  { id: "dashboard",    label: "Início",          icon: LayoutDashboard, roles: [UserRole.PROFESSOR, UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR] },
  { id: "daily",        label: "Agenda do Dia",   icon: Clock,           roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR] },
  { id: "reservations", label: "Reservas",         icon: Calendar,        roles: [UserRole.PROFESSOR, UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR] },
  { id: "inventory",    label: "Almoxarifado",     icon: Package,         roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROFESSOR, UserRole.ADMINISTRADOR] },
  { id: "labs",         label: "Laboratórios",     icon: Monitor,         roles: [UserRole.DTI_TECNICO, UserRole.PROGEX, UserRole.PROFESSOR, UserRole.ADMINISTRADOR] },
  { id: "maintenance",  label: "Manutenção",       icon: Wrench,          roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR] },
  { id: "movements",   label: "Movimentações",    icon: Package,         roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR] },
  { id: "users",        label: "Usuários",         icon: Users,           roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR] },
  { id: "settings",     label: "Configurações",    icon: Settings,        roles: [UserRole.PROFESSOR, UserRole.DTI_ESTAGIARIO, UserRole.DTI_TECNICO, UserRole.PROGEX, UserRole.ADMINISTRADOR] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PROFESSOR]:       "Professor",
  [UserRole.DTI_ESTAGIARIO]:  "DTI Estagiário",
  [UserRole.DTI_TECNICO]:     "DTI Técnico",
  [UserRole.PROGEX]:          "Progex · Admin",
  [UserRole.ADMINISTRADOR]:   "Administrador",
};

// ── Sidebar desktop (colapsável) ──────────────────────────────────────────────
function DesktopSidebar({
  activeTab, setActiveTab, dark, toggleDark, collapsed, setCollapsed,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  dark: boolean;
  toggleDark: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = MENU_ITEMS.filter(i => i.roles.includes(user.role));

  return (
    <motion.div
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full overflow-hidden"
      style={{ background: "var(--bg-sidebar)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center border-b shrink-0"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          height: 60,
          padding: collapsed ? "0 0 0 0" : "0 20px",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <div className="rounded-lg p-2 flex items-center justify-center shrink-0"
          style={{ background: "var(--ucdb-gold)" }}>
          <Building2 size={18} style={{ color: "var(--ucdb-blue-dark)" }} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="ml-3 overflow-hidden whitespace-nowrap"
            >
              <p className="font-bold text-sm leading-tight" style={{ color: "var(--text-sidebar)" }}>LabManager Pro</p>
              <p className="text-[10px] font-medium" style={{ color: "var(--ucdb-gold)" }}>UCDB</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-0.5"
        style={{ padding: collapsed ? "16px 8px" : "16px 12px" }}>
        {items.map(item => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
              className="w-full flex items-center rounded-xl text-sm font-medium transition-all"
              style={{
                gap: collapsed ? 0 : 12,
                padding: collapsed ? "10px 0" : "10px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: active ? "var(--ucdb-gold)" : "transparent",
                color: active ? "var(--ucdb-blue-dark)" : "var(--text-sidebar)",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <item.icon size={17} className="shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.12 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="border-t shrink-0"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          padding: collapsed ? "12px 8px" : "12px 12px",
        }}
      >
        {/* Botão expandir/recolher */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="w-full flex items-center rounded-xl text-sm font-medium transition-all mb-1"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? "10px 0" : "10px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            color: "var(--text-sidebar-muted)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {collapsed ? <ChevronRight size={17} className="shrink-0" /> : <ChevronLeft size={17} className="shrink-0" />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.12 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Recolher menu
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          title={collapsed ? (dark ? "Modo claro" : "Modo escuro") : undefined}
          className="w-full flex items-center rounded-xl text-sm font-medium transition-all mb-1"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? "10px 0" : "10px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            color: "var(--text-sidebar-muted)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {dark ? <Sun size={17} className="shrink-0" /> : <Moon size={17} className="shrink-0" />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.12 }}
                className="overflow-hidden whitespace-nowrap"
              >
                {dark ? "Modo claro" : "Modo escuro"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User info */}
        <div
          className="flex items-center py-2"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? "8px 0" : "8px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: "var(--ucdb-gold)", color: "var(--ucdb-blue-dark)" }}
            title={collapsed ? `${user.full_name} · ${ROLE_LABELS[user.role]}` : undefined}
          >
            {user.full_name.charAt(0)}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-sidebar)" }}>{user.full_name}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--ucdb-gold)" }}>{ROLE_LABELS[user.role]}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title={collapsed ? "Sair" : undefined}
          className="w-full flex items-center rounded-xl text-sm font-medium transition-all"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? "10px 0" : "10px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            color: "#f87171",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <LogOut size={17} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.12 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Sair
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.div>
  );
}

// ── Sidebar mobile (drawer completo, sem colapso) ─────────────────────────────
function MobileSidebarContent({
  activeTab, setActiveTab, dark, toggleDark, onClose,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  dark: boolean;
  toggleDark: () => void;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = MENU_ITEMS.filter(i => i.roles.includes(user.role));

  return (
    <div className="flex flex-col h-full w-64" style={{ background: "var(--bg-sidebar)" }}>
      {/* Logo */}
      <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 flex items-center justify-center" style={{ background: "var(--ucdb-gold)" }}>
            <Building2 size={18} style={{ color: "var(--ucdb-blue-dark)" }} />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: "var(--text-sidebar)" }}>LabManager Pro</p>
            <p className="text-[10px] font-medium" style={{ color: "var(--ucdb-gold)" }}>UCDB</p>
          </div>
        </div>
        <button onClick={onClose} style={{ color: "var(--text-sidebar-muted)" }} className="p-1 rounded hover:opacity-70">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {items.map(item => {
          const active = activeTab === item.id;
          return (
            <button key={item.id}
              onClick={() => { setActiveTab(item.id); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active ? "var(--ucdb-gold)" : "transparent",
                color: active ? "var(--ucdb-blue-dark)" : "var(--text-sidebar)",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 space-y-1 border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <button onClick={toggleDark}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: "var(--text-sidebar-muted)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
          {dark ? "Modo claro" : "Modo escuro"}
        </button>

        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: "var(--ucdb-gold)", color: "var(--ucdb-blue-dark)" }}>
            {user.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-sidebar)" }}>{user.full_name}</p>
            <p className="text-[10px] truncate" style={{ color: "var(--ucdb-gold)" }}>{ROLE_LABELS[user.role]}</p>
          </div>
        </div>

        <button onClick={() => { logout(); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: "#f87171" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <LogOut size={17} /> Sair
        </button>
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function Shell() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab]         = useState("dashboard");
  const [showWizard, setShowWizard]       = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [collapsed, setCollapsed]         = useState(false);
  const [dark, toggleDark]                = useDarkMode();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-tertiary)" }}>
        <div className="flex flex-col items-center gap-4" style={{ color: "var(--text-tertiary)" }}>
          <div className="w-10 h-10 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--ucdb-blue)" }} />
          <p className="text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage dark={dark} toggleDark={toggleDark} />;

  const handleWizardComplete = () => { setShowWizard(false); setActiveTab("reservations"); };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-tertiary)" }}>
      {/* Sidebar desktop */}
      <div className="hidden md:flex h-screen sticky top-0 shrink-0" style={{ boxShadow: "var(--shadow-md)" }}>
        <DesktopSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          dark={dark}
          toggleDark={toggleDark}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      </div>

      {/* Sidebar mobile */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div key="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setMobileSidebar(false)} />
            <motion.div key="dr" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden h-full shadow-2xl">
              <MobileSidebarContent
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                dark={dark}
                toggleDark={toggleDark}
                onClose={() => setMobileSidebar(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b sticky top-0 z-30"
          style={{ background: "var(--bg-sidebar)", borderColor: "rgba(255,255,255,0.08)" }}>
          <button onClick={() => setMobileSidebar(true)} className="p-2 rounded-lg" style={{ color: "var(--text-sidebar)" }}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Building2 size={16} style={{ color: "var(--ucdb-gold)" }} />
            <span className="font-bold text-sm" style={{ color: "var(--text-sidebar)" }}>LabManager Pro</span>
          </div>
          <button onClick={toggleDark} className="ml-auto p-2 rounded-lg" style={{ color: "var(--text-sidebar)" }}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              {showWizard ? (
                <motion.div key="wiz" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <ReservationWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />
                </motion.div>
              ) : (
                <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  {activeTab === "dashboard"    && <DashboardPage onNewReservation={() => setShowWizard(true)} onNavigate={setActiveTab} />}
                  {activeTab === "daily"        && <DailyPage />}
                  {activeTab === "reservations" && <ReservationsPage onNewReservation={() => setShowWizard(true)} />}
                  {activeTab === "inventory"    && <InventoryPage />}
                  {activeTab === "labs"         && <LabsPage />}
                  {activeTab === "maintenance"  && <MaintenancePage />}
                  {activeTab === "movements"   && <MovementsPage />}
                  {activeTab === "users"        && <UsersPage />}
                  {activeTab === "settings"     && <SettingsPage />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SSEListener /> {/* 🔹 Adicionado aqui para rodar de forma invisível */}
      <Shell />
    </AuthProvider>
  );
}