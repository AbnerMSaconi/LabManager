using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class PhysicalItem
{
    public int Id { get; set; }

    public int ModelId { get; set; }

    public string PatrimonyId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public int? CurrentLabId { get; set; }

    public virtual Laboratory? CurrentLab { get; set; }

    public virtual ICollection<MaintenanceTicket> MaintenanceTickets { get; set; } = new List<MaintenanceTicket>();

    public virtual ItemModel Model { get; set; } = null!;

    public virtual ICollection<ReservationItem> ReservationItems { get; set; } = new List<ReservationItem>();
}
