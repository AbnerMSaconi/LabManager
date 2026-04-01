using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class Laboratory
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string Block { get; set; } = null!;

    public string RoomNumber { get; set; } = null!;

    public int Capacity { get; set; }

    public bool IsPractical { get; set; }

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime? DeletedAt { get; set; }

    public virtual ICollection<MaintenanceTicket> MaintenanceTickets { get; set; } = new List<MaintenanceTicket>();

    public virtual ICollection<PhysicalItem> PhysicalItems { get; set; } = new List<PhysicalItem>();

    public virtual ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();

    public virtual ICollection<Hardware> Hardwares { get; set; } = new List<Hardware>();

    public virtual ICollection<Software> Softwares { get; set; } = new List<Software>();
}
