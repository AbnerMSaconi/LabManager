using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class User
{
    public int Id { get; set; }

    public string RegistrationNumber { get; set; } = null!;

    public string HashedPassword { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string Role { get; set; } = null!;

    public bool IsActive { get; set; }

    public DateTime? DeletedAt { get; set; }

    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public virtual ICollection<InstitutionLoan> InstitutionLoans { get; set; } = new List<InstitutionLoan>();

    public virtual ICollection<InventoryMovement> InventoryMovements { get; set; } = new List<InventoryMovement>();

    public virtual ICollection<MaintenanceTicket> MaintenanceTicketOpenedBies { get; set; } = new List<MaintenanceTicket>();

    public virtual ICollection<MaintenanceTicket> MaintenanceTicketResolvedBies { get; set; } = new List<MaintenanceTicket>();

    public virtual ICollection<Reservation> ReservationApprovedBies { get; set; } = new List<Reservation>();

    public virtual ICollection<Reservation> ReservationUsers { get; set; } = new List<Reservation>();

    public virtual ICollection<SystemBackup> SystemBackups { get; set; } = new List<SystemBackup>();

    public virtual ICollection<TeacherAttendance> TeacherAttendances { get; set; } = new List<TeacherAttendance>();
}
