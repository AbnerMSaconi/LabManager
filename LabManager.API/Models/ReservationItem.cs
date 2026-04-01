using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class ReservationItem
{
    public int Id { get; set; }

    public int ReservationId { get; set; }

    public int ItemModelId { get; set; }

    public int? PhysicalItemId { get; set; }

    public int QuantityRequested { get; set; }

    public int QuantityReturned { get; set; }

    public string? ReturnStatus { get; set; }

    public string? DamageObservation { get; set; }

    public virtual ItemModel ItemModel { get; set; } = null!;

    public virtual PhysicalItem? PhysicalItem { get; set; }

    public virtual Reservation Reservation { get; set; } = null!;
}
