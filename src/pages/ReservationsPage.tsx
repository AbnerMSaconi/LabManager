/**
 * ReservationsPage — roteador de views por role
 *
 * Professor     → ReservationPageProfessor
 * PROGEX        → ReservationPageProgex
 * DTI_TECNICO   → ReservationPageDTI  (com permissão de aprovação)
 * DTI_ESTAGIARIO→ ReservationPageDTI  (somente leitura)
 */
import React from "react";
import { UserRole } from "../types";
import { useAuth } from "../hooks/useAuth";
import { ReservationPageProfessor } from "./ReservationPageProfessor";
import { ReservationPageProgex }    from "./ReservationPageProgex";
import { ReservationPageDTI }       from "./ReservationPageDTI";

export function ReservationsPage({ onNewReservation }: { onNewReservation: () => void }) {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === UserRole.PROFESSOR)
    return <ReservationPageProfessor onNewReservation={onNewReservation} />;

  if (user.role === UserRole.PROGEX || user.role === UserRole.ADMINISTRADOR)
    return <ReservationPageProgex onNewReservation={onNewReservation} />;

  // DTI_TECNICO e DTI_ESTAGIARIO — a página detecta o role internamente
  return <ReservationPageDTI />;
}
