using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class InventoryMovement
{
    public int Id { get; set; }

    public int ItemModelId { get; set; }

    public string Action { get; set; } = null!;

    public int Quantity { get; set; }

    public int OperatorId { get; set; }

    public string Target { get; set; } = null!;

    public int? ReservationId { get; set; }

    public int? LoanId { get; set; }

    public string? Observation { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ItemModel ItemModel { get; set; } = null!;

    public virtual InstitutionLoan? Loan { get; set; }

    public virtual User Operator { get; set; } = null!;

    public virtual Reservation? Reservation { get; set; }
}
