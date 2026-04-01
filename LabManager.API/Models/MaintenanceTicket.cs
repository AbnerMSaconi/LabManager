using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class MaintenanceTicket
{
    public int Id { get; set; }

    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public int? LabId { get; set; }

    public int? PhysicalItemId { get; set; }

    public int OpenedById { get; set; }

    public int? ResolvedById { get; set; }

    public string Status { get; set; } = null!;

    public string Severity { get; set; } = null!;

    public string? ResolutionNotes { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public virtual Laboratory? Lab { get; set; }

    public virtual User OpenedBy { get; set; } = null!;

    public virtual PhysicalItem? PhysicalItem { get; set; }

    public virtual User? ResolvedBy { get; set; }
}
