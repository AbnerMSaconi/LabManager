import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Calendar, Package, Monitor,
  LogOut, Clock, Wrench, Building2,
  Menu, X, Users, Settings, Moon, Sun, ChevronLeft, ChevronRight, ShieldCheck, UserCheck,
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
import SysAdminPage from "./pages/SysAdminPage";
import { AttendancePage } from "./pages/AttendancePage";

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
  { id: "dashboard",    label: "Início",          icon: LayoutDashboard, roles: [UserRole.PROFESSOR, UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "daily",        label: "Agenda do Dia",   icon: Clock,           roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "reservations", label: "Reservas",        icon: Calendar,        roles: [UserRole.PROFESSOR, UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "inventory",    label: "Almoxarifado",    icon: Package,         roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROFESSOR, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "labs",         label: "Laboratórios",    icon: Monitor,         roles: [UserRole.DTI_TECNICO, UserRole.PROGEX, UserRole.PROFESSOR, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "maintenance",  label: "Manutenção",      icon: Wrench,          roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "movements",    label: "Movimentações",   icon: Package,         roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "users",        label: "Usuários",        icon: Users,           roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "settings",     label: "Configurações",   icon: Settings,        roles: [UserRole.PROFESSOR, UserRole.DTI_ESTAGIARIO, UserRole.DTI_TECNICO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "attendance",   label: "Lista de Presença", icon: UserCheck,      roles: [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN] },
  { id: "governance",   label: "Governança",      icon: ShieldCheck,     roles: [UserRole.SUPER_ADMIN] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PROFESSOR]:       "Professor",
  [UserRole.DTI_ESTAGIARIO]:  "DTI Estagiário",
  [UserRole.DTI_TECNICO]:     "DTI Técnico",
  [UserRole.PROGEX]:          "Progex",
  [UserRole.ADMINISTRADOR]:   "Administrador",
  [UserRole.SUPER_ADMIN]:     "Super Admin",
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
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full overflow-hidden bg-ucdb-blue shadow-xl border-r border-white/10"
    >
      {/* Logo */}
      <div
        className="flex items-center border-b border-white/10 shrink-0"
        style={{
          height: 72,
          padding: collapsed ? "0" : "0 20px",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <div className="rounded-xl p-2.5 flex items-center justify-center shrink-0 bg-white/10">
          <Building2 size={20} className="text-white" />
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
              <p className="font-black text-[15px] leading-tight text-white tracking-tight">LabManager Pro</p>
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5">Institucional</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-1.5 custom-scrollbar"
        style={{ padding: collapsed ? "24px 12px" : "24px 16px" }}>
        {items.map(item => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-bold transition-all group ${
                active 
                  ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20" 
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              style={{
                gap: collapsed ? 0 : 12,
                padding: collapsed ? "12px 0" : "12px 14px",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <item.icon size={18} className={`shrink-0 transition-colors ${active ? "text-white" : "text-white/60 group-hover:text-white"}`} />
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
        className="border-t border-white/10 shrink-0"
        style={{ padding: collapsed ? "16px 12px" : "16px" }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="w-full flex items-center rounded-xl text-xs font-bold transition-all mb-2 text-white/40 hover:bg-white/10 hover:text-white"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? "10px 0" : "10px 14px",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {collapsed ? <ChevronRight size={16} className="shrink-0" /> : <ChevronLeft size={16} className="shrink-0" />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.12 }} className="overflow-hidden whitespace-nowrap uppercase tracking-widest">
                Recolher Menu
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          onClick={toggleDark}
          title={collapsed ? (dark ? "Modo claro" : "Modo escuro") : undefined}
          className="w-full flex items-center rounded-xl text-xs font-bold transition-all mb-4 text-white/40 hover:bg-white/10 hover:text-white"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? "10px 0" : "10px 14px",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {dark ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.12 }} className="overflow-hidden whitespace-nowrap uppercase tracking-widest">
                {dark ? "Modo Claro" : "Modo Escuro"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User info Card */}
        <div className={`flex items-center bg-white/5 border border-white/10 rounded-2xl transition-all ${collapsed ? "p-2 justify-center" : "p-3 gap-3"}`}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 bg-white text-ucdb-blue shadow-sm"
            title={collapsed ? `${user.full_name} · ${ROLE_LABELS[user.role]}` : undefined}
          >
            {user.full_name.charAt(0)}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.12 }} className="flex-1 min-w-0 overflow-hidden pr-2">
                <p className="text-sm font-bold text-white truncate leading-tight">{user.full_name}</p>
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5 truncate">{ROLE_LABELS[user.role]}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title={collapsed ? "Sair" : undefined}
          className="w-full flex items-center rounded-xl text-sm font-bold transition-all mt-3 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? "12px 0" : "12px 14px",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <LogOut size={16} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.12 }} className="overflow-hidden whitespace-nowrap">
                Terminar Sessão
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
    <div className="flex flex-col h-full w-72 bg-ucdb-blue shadow-2xl border-r border-white/10">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5 flex items-center justify-center bg-white/10">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <p className="font-black text-[15px] leading-tight text-white tracking-tight">LabManager Pro</p>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5">Institucional</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 custom-scrollbar">
        {items.map(item => {
          const active = activeTab === item.id;
          return (
            <button key={item.id}
              onClick={() => { setActiveTab(item.id); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group ${
                active 
                  ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20" 
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon size={18} className={`shrink-0 transition-colors ${active ? "text-white" : "text-white/60 group-hover:text-white"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-6 space-y-2 border-t border-white/10">
        <button onClick={toggleDark}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-white/50 hover:bg-white/10 hover:text-white uppercase tracking-widest mb-4"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {dark ? "Modo claro" : "Modo escuro"}
        </button>

        <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 bg-white text-ucdb-blue shadow-sm">
            {user.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-sm font-bold text-white truncate leading-tight">{user.full_name}</p>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5 truncate">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>

        <button onClick={() => { logout(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all mt-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut size={16} /> Terminar Sessão
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
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4 text-ucdb-blue">
          <div className="w-10 h-10 border-[3px] rounded-full animate-spin border-neutral-200 border-t-ucdb-blue" />
          <p className="text-sm font-bold uppercase tracking-widest">Carregando Sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage dark={dark} toggleDark={toggleDark} />;

  const handleWizardComplete = () => { setShowWizard(false); setActiveTab("reservations"); };

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Sidebar desktop */}
      <div className="hidden md:flex h-screen sticky top-0 shrink-0 z-40">
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
              className="fixed inset-0 z-40 md:hidden bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileSidebar(false)} />
            <motion.div key="dr" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden h-full">
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
        {/* Mobile topbar (Azul Marinho também para manter consistência) */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30 bg-ucdb-blue shadow-md border-b border-white/10">
          <button onClick={() => setMobileSidebar(true)} className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-white" />
            <span className="font-black text-sm text-white tracking-tight">LabManager</span>
          </div>
          <button onClick={toggleDark} className="ml-auto p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto relative">
          <div className="max-w-[1400px] mx-auto w-full">
            <AnimatePresence mode="wait">
              {showWizard ? (
                <motion.div key="wiz" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
                  <ReservationWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />
                </motion.div>
              ) : (
                <motion.div key={activeTab} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
                  {activeTab === "dashboard"    && <DashboardPage onNewReservation={() => setShowWizard(true)} onNavigate={setActiveTab} />}
                  {activeTab === "daily"        && <DailyPage />}
                  {activeTab === "reservations" && <ReservationsPage onNewReservation={() => setShowWizard(true)} />}
                  {activeTab === "inventory"    && <InventoryPage />}
                  {activeTab === "labs"         && <LabsPage />}
                  {activeTab === "maintenance"  && <MaintenancePage />}
                  {activeTab === "movements"   && <MovementsPage />}
                  {activeTab === "users"        && <UsersPage />}
                  {activeTab === "settings"     && <SettingsPage />}
                  {activeTab === "attendance"   && <AttendancePage />}
                  {activeTab === "governance"   && <SysAdminPage />}
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
      <SSEListener />
      <Shell />
    </AuthProvider>
  );
}