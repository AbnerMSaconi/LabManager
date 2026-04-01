using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class SystemBackup
{
    public int Id { get; set; }

    public string Filename { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public double? SizeMb { get; set; }

    public int? TriggeredById { get; set; }

    public virtual User? TriggeredBy { get; set; }
}
