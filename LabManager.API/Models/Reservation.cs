using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class Reservation
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int? LabId { get; set; }

    public DateOnly Date { get; set; }

    public string Status { get; set; } = null!;

    public string? RequestedSoftwares { get; set; }

    public bool SoftwareInstallationRequired { get; set; }

    public int? ApprovedById { get; set; }

    public string? RejectionReason { get; set; }

    public string? ApprovalNotes { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? GroupId { get; set; }

    public virtual User? ApprovedBy { get; set; }

    public virtual ICollection<InventoryMovement> InventoryMovements { get; set; } = new List<InventoryMovement>();

    public virtual Laboratory? Lab { get; set; }

    public virtual ICollection<ReservationItem> ReservationItems { get; set; } = new List<ReservationItem>();

    public virtual TeacherAttendance? TeacherAttendance { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual ICollection<LessonSlot> Slots { get; set; } = new List<LessonSlot>();
}
