using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class ItemModel
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string Category { get; set; } = null!;

    public string? Description { get; set; }

    public string? ImageUrl { get; set; }

    public int TotalStock { get; set; }

    public int MaintenanceStock { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? ModelNumber { get; set; }

    public virtual ICollection<InstitutionLoan> InstitutionLoans { get; set; } = new List<InstitutionLoan>();

    public virtual ICollection<InventoryMovement> InventoryMovements { get; set; } = new List<InventoryMovement>();

    public virtual ICollection<PhysicalItem> PhysicalItems { get; set; } = new List<PhysicalItem>();

    public virtual ICollection<ReservationItem> ReservationItems { get; set; } = new List<ReservationItem>();
}
