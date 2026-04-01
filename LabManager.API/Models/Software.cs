using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class Software
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Version { get; set; }

    public DateTime? DeletedAt { get; set; }

    public virtual ICollection<Laboratory> Labs { get; set; } = new List<Laboratory>();
}
