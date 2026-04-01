using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class InstitutionLoan
{
    public int Id { get; set; }

    public int ItemModelId { get; set; }

    public string RequesterName { get; set; } = null!;

    public int QuantityDelivered { get; set; }

    public int QuantityReturned { get; set; }

    public DateOnly? ReturnDate { get; set; }

    public string? NoReturnReason { get; set; }

    public string Status { get; set; } = null!;

    public string? DamageObservation { get; set; }

    public bool? IsOperational { get; set; }

    public int CreatedById { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ReturnedAt { get; set; }

    public virtual User CreatedBy { get; set; } = null!;

    public virtual ICollection<InventoryMovement> InventoryMovements { get; set; } = new List<InventoryMovement>();

    public virtual ItemModel ItemModel { get; set; } = null!;
}
