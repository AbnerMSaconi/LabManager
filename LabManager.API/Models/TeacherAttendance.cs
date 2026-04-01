using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class TeacherAttendance
{
    public int Id { get; set; }

    public int ReservationId { get; set; }

    public string Status { get; set; } = null!;

    public int? RegisteredById { get; set; }

    public DateTime RegisteredAt { get; set; }

    public virtual User? RegisteredBy { get; set; }

    public virtual Reservation Reservation { get; set; } = null!;
}
