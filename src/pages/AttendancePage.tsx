import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  UserCheck, Calendar, Building2, AlertTriangle, X,
  CheckCircle2, XCircle, Clock, FileCheck, Palmtree, CalendarDays,
  ChevronLeft, ChevronRight, LayoutGrid,
} from "lucide-react";
import { AttendanceRow, AttendanceStatus, Laboratory } from "../types";
import { useFetch } from "../hooks/useFetch";
import { labsApi } from "../api/labsApi";
import { attendanceApi } from "../api/attendanceApi";
import { useToast, LoadingSpinner, ErrorMessage } from "../components/ui";
import { ApiError } from "../api/client";
import { CustomDropdown, TIME_SLOTS, SLOT_TIMES, WEEK_DAYS } from "./reservationShared";

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAY_OPTIONS = [
  { value: "all", label: "Todos os dias" },
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string; ring: string; gridBg: string }> = {
  presente:    { label: "Presente",    bg: "bg-green-500",   text: "text-white", ring: "ring-green-600",    gridBg: "bg-green-100 text-green-800 border-green-300" },
  falta:       { label: "Falta",       bg: "bg-red-500",     text: "text-white", ring: "ring-red-600",      gridBg: "bg-red-100 text-red-700 border-red-300" },
  adiado:      { label: "Adiado",      bg: "bg-amber-400",   text: "text-white", ring: "ring-amber-500",    gridBg: "bg-amber-100 text-amber-700 border-amber-300" },
  justificada: { label: "Justificada", bg: "bg-neutral-900", text: "text-white", ring: "ring-neutral-700",  gridBg: "bg-neutral-200 text-neutral-700 border-neutral-400" },
  feriado:     { label: "Feriado",     bg: "bg-amber-800",   text: "text-white", ring: "ring-amber-900",    gridBg: "bg-orange-100 text-orange-800 border-orange-300" },
};

const STATUS_ICONS: Record<AttendanceStatus, React.ElementType> = {
  presente: CheckCircle2, falta: XCircle, adiado: Clock, justificada: FileCheck, feriado: Palmtree,
};

const ALL_STATUSES: AttendanceStatus[] = ["presente", "falta", "adiado", "justificada", "feriado"];

function todayStr(): string { return new Date().toISOString().split("T")[0]; }

function getMondayOfWeek(offset: number): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date): string { return d.toISOString().split("T")[0]; }

function fmtDisplayDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ─── Status button (list view) ────────────────────────────────────────────────

function StatusButton({ status, active, onClick }: { status: AttendanceStatus; active: boolean; onClick: () => void }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = STATUS_ICONS[status];
  return (
    <button type="button" onClick={onClick} title={cfg.label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 border-2 ${
        active ? `${cfg.bg} ${cfg.text} border-transparent ring-2 ${cfg.ring} shadow-md`
               : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 shadow-sm"
      }`}>
      <Icon size={13} />
      <span className="hidden sm:inline">{cfg.label}</span>
    </button>
  );
}

// ─── Attendance card (list view) ──────────────────────────────────────────────

function AttendanceCard({ row, pendingStatus, onSelect }: {
  row: AttendanceRow; pendingStatus: AttendanceStatus | undefined; onSelect: (s: AttendanceStatus) => void;
}) {
  const effectiveStatus = pendingStatus ?? row.attendance_status ?? null;
  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow ${
      pendingStatus !== undefined ? "border-blue-300 ring-1 ring-blue-200" : "border-neutral-200"
    }`}>
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className={`flex-1 min-w-0 px-3 py-2 rounded-xl ${row.alert ? "bg-red-50 border border-red-200" : "bg-neutral-50 border border-neutral-100"}`}>
            <div className="flex items-center gap-2 min-w-0">
              {row.alert && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
              <p className={`font-black text-sm truncate ${row.alert ? "text-red-700" : "text-neutral-900"}`}>{row.professor_name}</p>
            </div>
            {row.alert && <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mt-0.5">{row.consecutive_absences} faltas consecutivas</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 shrink-0">
            {row.lab_name && (
              <span className="flex items-center gap-1 font-bold bg-neutral-100 px-2 py-1 rounded-lg border border-neutral-200">
                <Building2 size={11} />{row.lab_name}
              </span>
            )}
            <span className="flex items-center gap-1 font-medium bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-100">
              <Calendar size={11} />{new Date(row.date + "T12:00:00").toLocaleDateString("pt-BR")}
            </span>
            {row.slots.length > 0 && (
              <span className="flex items-center gap-1 font-medium bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-100">
                <Clock size={11} />{row.slots[0].start_time}–{row.slots[row.slots.length - 1].end_time}
              </span>
            )}
            {effectiveStatus && (
              <span className={`flex items-center gap-1 font-bold px-2 py-1 rounded-lg ${STATUS_CONFIG[effectiveStatus].bg} ${STATUS_CONFIG[effectiveStatus].text} text-[10px] uppercase tracking-wider`}>
                {STATUS_CONFIG[effectiveStatus].label}{pendingStatus !== undefined && " *"}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-neutral-100">
          {ALL_STATUSES.map(s => (
            <StatusButton key={s} status={s} active={effectiveStatus === s} onClick={() => onSelect(s)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Weekly grid modal ────────────────────────────────────────────────────────

function WeeklyAttendanceGrid({ onClose, labs }: { onClose: () => void; labs: Laboratory[] }) {
  const [selectedLabId, setSelectedLabId] = useState<number | "all">("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const monday = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const saturday = useMemo(() => addDays(monday, 5), [monday]);

  const weekLabel = `${fmtDisplayDate(monday)} – ${fmtDisplayDate(saturday)}/${saturday.getFullYear()}`;

  const fetchWeek = useCallback(async () => {
    if (selectedLabId === "all") { setRows([]); return; }
    setLoading(true);
    try {
      const data = await attendanceApi.list({
        lab_id: selectedLabId as number,
        date_from: fmtDate(monday),
        date_to: fmtDate(saturday),
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [selectedLabId, monday, saturday]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  // Build grid: TIME_SLOTS × WEEK_DAYS
  const gridMatrix = useMemo(() => {
    const matrix = TIME_SLOTS.map(() => WEEK_DAYS.map(() => ({ row: null as AttendanceRow | null, rowSpan: 1, skip: false })));
    if (!rows.length) return matrix;

    TIME_SLOTS.forEach((slotCode, rIdx) => {
      WEEK_DAYS.forEach((day, cIdx) => {
        // day.id: 1=Mon … 6=Sat; JS getDay(): 0=Sun, 1=Mon … 6=Sat
        const match = rows.find(r => {
          const jsDay = new Date(r.date + "T12:00:00").getDay();
          return jsDay === day.id && r.slots?.some(s => s.code === slotCode);
        });
        matrix[rIdx][cIdx].row = match ?? null;
      });
    });

    // Merge consecutive slots for same reservation
    WEEK_DAYS.forEach((_, cIdx) => {
      let rIdx = 0;
      while (rIdx < TIME_SLOTS.length) {
        const cur = matrix[rIdx][cIdx].row;
        if (cur) {
          let span = 1;
          while (rIdx + span < TIME_SLOTS.length && matrix[rIdx + span][cIdx].row?.reservation_id === cur.reservation_id) {
            matrix[rIdx + span][cIdx].skip = true;
            span++;
          }
          matrix[rIdx][cIdx].rowSpan = span;
          rIdx += span;
        } else { rIdx++; }
      }
    });

    return matrix;
  }, [rows]);

  const labOptions = [
    { value: "all", label: "Selecione um laboratório" },
    ...labs.map(l => ({ value: l.id, label: l.name })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-4">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-neutral-900 rounded-xl flex items-center justify-center shrink-0">
              <LayoutGrid size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-neutral-900">Registros Semanais</h2>
              <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-widest">{weekLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-neutral-100">
          <div className="flex-1 min-w-[200px]">
            <CustomDropdown
              value={selectedLabId}
              options={labOptions}
              onChange={v => setSelectedLabId(v === "all" ? "all" : Number(v))}
              icon={Building2}
              placeholder="Laboratório"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors text-neutral-600 shadow-sm">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setWeekOffset(0)}
              className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold hover:bg-neutral-50 transition-colors text-neutral-600 shadow-sm">
              Semana atual
            </button>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors text-neutral-600 shadow-sm">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-neutral-100 bg-neutral-50/30">
          {ALL_STATUSES.map(s => (
            <span key={s} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${STATUS_CONFIG[s].gridBg}`}>
              {React.createElement(STATUS_ICONS[s], { size: 10 })}
              {STATUS_CONFIG[s].label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
            Sem registro
          </span>
        </div>

        {/* Grid */}
        <div className="overflow-auto custom-scrollbar flex-1" style={{ maxHeight: "60vh" }}>
          {selectedLabId === "all" ? (
            <div className="p-16 text-center">
              <Building2 size={40} className="mx-auto mb-3 text-neutral-200" />
              <p className="font-bold text-neutral-500">Selecione um laboratório para ver a grade.</p>
            </div>
          ) : loading ? (
            <div className="p-12 text-center"><LoadingSpinner label="Carregando grade..." /></div>
          ) : (
            <table className="w-full text-left min-w-[720px] border-collapse">
              <thead className="bg-white sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest w-12 text-center border-b border-neutral-200">Aula</th>
                  <th className="px-2 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest w-14 text-center border-b border-r border-neutral-200">Início</th>
                  {WEEK_DAYS.map((day, i) => {
                    const d = addDays(monday, i);
                    return (
                      <th key={day.id} className="px-2 py-3 text-center border-l border-b border-neutral-200 min-w-[100px]">
                        <p className="text-[11px] font-bold text-neutral-800 uppercase">{day.label}</p>
                        <p className="text-[10px] font-medium text-neutral-400">{fmtDisplayDate(d)}</p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slotCode, rIdx) => (
                  <tr key={slotCode} className="hover:bg-neutral-50/30 transition-colors">
                    <td className="px-2 py-1.5 text-[10px] font-bold text-neutral-500 bg-neutral-50/50 border-b border-neutral-200 text-center">{slotCode}</td>
                    <td className="px-2 py-1.5 text-[10px] font-bold text-neutral-500 bg-neutral-50/50 border-r border-b border-neutral-200 text-center">{SLOT_TIMES[slotCode]}</td>
                    {WEEK_DAYS.map((day, cIdx) => {
                      const cell = gridMatrix[rIdx][cIdx];
                      if (cell.skip) return null;
                      if (!cell.row) return (
                        <td key={day.id} className="border-l border-b border-neutral-200 p-1">
                          <div className="min-h-[42px] rounded-lg border border-dashed border-transparent hover:border-neutral-200 transition-colors" />
                        </td>
                      );
                      const att = cell.row.attendance_status as AttendanceStatus | null;
                      const colorClass = att ? STATUS_CONFIG[att].gridBg : "bg-blue-50 text-blue-700 border-blue-200";
                      return (
                        <td key={day.id} rowSpan={cell.rowSpan} className="border-l border-b border-neutral-200 p-1">
                          <div className={`h-full w-full min-h-[42px] p-2 rounded-lg border flex flex-col justify-center items-center text-center shadow-sm ${colorClass}`}>
                            <p className="text-[10px] font-black leading-tight w-full truncate" title={cell.row.professor_name}>{cell.row.professor_name}</p>
                            {cell.row.alert && <AlertTriangle size={9} className="text-red-500 mt-0.5 shrink-0" title="Alerta: faltas consecutivas" />}
                            {att && <p className="text-[9px] font-bold opacity-75 mt-0.5 uppercase tracking-wider">{STATUS_CONFIG[att].label}</p>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AttendancePage() {
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterWeekday, setFilterWeekday] = useState<number | "all">("all");
  const [filterLabId, setFilterLabId] = useState<number | "all">("all");
  const [showWeekly, setShowWeekly] = useState(false);

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<number, AttendanceStatus>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: labs } = useFetch<Laboratory[]>(labsApi.list);
  const { showToast, ToastComponent } = useToast();

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const filters: Parameters<typeof attendanceApi.list>[0] = {};
      if (filterDate) filters.date = filterDate;
      if (filterWeekday !== "all") filters.weekday = filterWeekday as number;
      if (filterLabId !== "all") filters.lab_id = filterLabId as number;
      setRows(await attendanceApi.list(filters));
    } catch (e) {
      setFetchError(e instanceof ApiError ? e.message : "Erro ao carregar presenças.");
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterWeekday, filterLabId]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const handleSubmit = async () => {
    const records = (Object.entries(pending) as [string, AttendanceStatus][]).map(([id, status]) => ({ reservation_id: Number(id), status }));
    if (!records.length) return;
    setSubmitting(true);
    try {
      const res = await attendanceApi.batch(records);
      showToast(`${res.saved} presença(s) registrada(s) com sucesso.`, "success");
      setPending({});
      fetchAttendance();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao registrar presenças.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = Object.keys(pending).length;
  const labOptions = [
    { value: "all", label: "Todos os Labs" },
    ...((labs ?? []).map(l => ({ value: l.id, label: l.name }))),
  ];

  return (
    <div className="space-y-5 pb-20">
      {ToastComponent}
      {showWeekly && <WeeklyAttendanceGrid onClose={() => setShowWeekly(false)} labs={labs ?? []} />}

      {/* Header */}
      <header className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center shadow-inner shrink-0">
              <UserCheck size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Lista de Presença</h1>
              <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-widest">
                {rows.length} reserva{rows.length !== 1 ? "s" : ""} encontrada{rows.length !== 1 ? "s" : ""}
                {pendingCount > 0 && <span className="ml-2 text-blue-600">· {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button onClick={() => setShowWeekly(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700 hover:bg-neutral-50 shadow-sm transition-all active:scale-95">
              <LayoutGrid size={15} /> Registros semanais
            </button>

            <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 shadow-sm">
              <CalendarDays size={15} className="text-neutral-500 shrink-0" />
              <input type="date" value={filterDate}
                onChange={e => { setFilterDate(e.target.value); setFilterWeekday("all"); }}
                className="text-sm font-medium text-neutral-700 bg-transparent focus:outline-none" />
            </div>

            <CustomDropdown value={filterWeekday} options={WEEKDAY_OPTIONS}
              onChange={v => { setFilterWeekday(v === "all" ? "all" : Number(v)); setFilterDate(""); }}
              icon={CalendarDays} placeholder="Dia da semana" />

            <CustomDropdown value={filterLabId} options={labOptions}
              onChange={v => setFilterLabId(v === "all" ? "all" : Number(v))}
              icon={Building2} placeholder="Laboratório" />
          </div>
        </div>
      </header>

      {/* Content */}
      {loading && <LoadingSpinner label="Carregando reservas..." />}
      {fetchError && <ErrorMessage message={fetchError} onRetry={fetchAttendance} />}
      {!loading && !fetchError && (
        rows.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-neutral-200 p-16 text-center">
            <UserCheck size={48} className="mx-auto mb-4 text-neutral-200" />
            <p className="text-lg font-bold text-neutral-600">Nenhuma reserva encontrada.</p>
            <p className="text-sm text-neutral-400 mt-1">Ajuste os filtros para localizar as reservas do período.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <AttendanceCard key={row.reservation_id} row={row}
                pendingStatus={pending[row.reservation_id]}
                onSelect={status => setPending(prev => ({ ...prev, [row.reservation_id]: status }))} />
            ))}
          </div>
        )
      )}

      {/* Sticky submit */}
      {pendingCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 w-full max-w-md">
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 px-6 rounded-2xl bg-neutral-900 text-white font-black text-sm shadow-2xl shadow-neutral-900/40 hover:bg-neutral-800 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3">
            {submitting ? <LoadingSpinner label="" /> : (
              <><CheckCircle2 size={18} /> Registrar Presenças ({pendingCount} alteraç{pendingCount !== 1 ? "ões" : "ão"})</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
