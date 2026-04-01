using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class Hardware
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Specifications { get; set; }

    public virtual ICollection<Laboratory> Labs { get; set; } = new List<Laboratory>();
}
