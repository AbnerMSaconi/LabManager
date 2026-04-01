using System;
using System.Collections.Generic;

namespace LabManager.API.Models;

public partial class AuditLog
{
    public int Id { get; set; }

    public string TableName { get; set; } = null!;

    public int RecordId { get; set; }

    public string? OldData { get; set; }

    public string? NewData { get; set; }

    public int? UserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User? User { get; set; }
}
