using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class LessonSlot
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string StartTime { get; set; } = null!;

    public string EndTime { get; set; } = null!;

    public virtual ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}
