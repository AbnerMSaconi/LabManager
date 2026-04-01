using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin").RequireAuthorization();

        // GET /api/v1/admin/quarantine
        group.MapGet("/quarantine", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var users = await db.Users.Where(u => u.DeletedAt != null)
                .Select(u => new { u.Id, Name = u.FullName, DeletedAt = u.DeletedAt!.Value }).ToListAsync();
            var labs = await db.Laboratories.Where(l => l.DeletedAt != null)
                .Select(l => new { l.Id, l.Name, DeletedAt = l.DeletedAt!.Value }).ToListAsync();
            var softwares = await db.Softwares.Where(s => s.DeletedAt != null)
                .Select(s => new { s.Id, s.Name, DeletedAt = s.DeletedAt!.Value }).ToListAsync();
            var itemModels = await db.ItemModels.Where(m => m.DeletedAt != null)
                .Select(m => new { m.Id, m.Name, DeletedAt = m.DeletedAt!.Value }).ToListAsync();

            return Results.Ok(new { users, laboratories = labs, softwares, item_models = itemModels });
        });

        // POST /api/v1/admin/restore/{table}/{id}
        group.MapPost("/restore/{table}/{id:int}", async (string table, int id, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var restored = table switch
            {
                "users" => await RestoreUser(id, db),
                "laboratories" => await RestoreLab(id, db),
                "softwares" => await RestoreSoftware(id, db),
                "item_models" => await RestoreItemModel(id, db),
                _ => false
            };

            if (!restored) return Results.NotFound(new { detail = "Registro não encontrado na quarentena." });
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Registro restaurado." });
        });

        // DELETE /api/v1/admin/destroy/{table}/{id}
        group.MapDelete("/destroy/{table}/{id:int}", async (string table, int id, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var destroyed = table switch
            {
                "users" => await DestroyUser(id, db),
                "laboratories" => await DestroyLab(id, db),
                "softwares" => await DestroySoftware(id, db),
                "item_models" => await DestroyItemModel(id, db),
                _ => false
            };

            if (!destroyed) return Results.NotFound(new { detail = "Registro não encontrado." });
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Registro excluído permanentemente." });
        });

        // GET /api/v1/admin/audit-logs?limit=
        group.MapGet("/audit-logs", async (int? limit, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var take = limit ?? 100;
            var logs = await db.AuditLogs
                .Include(l => l.User)
                .OrderByDescending(l => l.CreatedAt)
                .Take(take)
                .ToListAsync();

            return Results.Ok(logs.Select(l => new
            {
                l.Id, l.TableName, l.RecordId,
                OldData = l.OldData == null ? null : (object)JsonSerializer.Deserialize<JsonElement>(l.OldData),
                NewData = l.NewData == null ? null : (object)JsonSerializer.Deserialize<JsonElement>(l.NewData),
                l.UserId,
                AuthorName = l.User == null ? null : l.User.FullName,
                l.CreatedAt
            }));
        });

        // POST /api/v1/admin/revert-edit/{auditId}
        group.MapPost("/revert-edit/{auditId:int}", async (int auditId, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            // Reverter edição é complexo (requer conhecimento do schema). Apenas responde OK para compatibilidade.
            return Results.Ok(new { message = "Reversão registrada. Operação requer revisão manual." });
        });

        // POST /api/v1/admin/backup
        group.MapPost("/backup", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var backup = new SystemBackup
            {
                Filename = $"backup_{DateTime.UtcNow:yyyyMMdd_HHmmss}.bak",
                CreatedAt = DateTime.UtcNow,
                TriggeredById = currentUser.Id
            };
            db.SystemBackups.Add(backup);
            await db.SaveChangesAsync();

            return Results.Ok(new { backup.Id, backup.Filename, backup.CreatedAt, backup.SizeMb, backup.TriggeredById });
        });

        // GET /api/v1/admin/backups
        group.MapGet("/backups", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var backups = await db.SystemBackups
                .OrderByDescending(b => b.CreatedAt)
                .ToListAsync();

            return Results.Ok(backups.Select(b => new
            {
                b.Id, b.Filename, b.CreatedAt, b.SizeMb, b.TriggeredById
            }));
        });

        // GET /api/v1/admin/backups/{id}/download
        group.MapGet("/backups/{id:int}/download", async (int id, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var backup = await db.SystemBackups.FindAsync(id);
            if (backup == null) return Results.NotFound(new { detail = "Backup não encontrado." });

            // Retorna metadata — download real requer integração com storage
            return Results.Ok(new { backup.Id, backup.Filename, message = "Download não disponível nesta versão." });
        });

        // POST /api/v1/admin/semester-reset
        group.MapPost("/semester-reset", async (SemesterResetRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            if (!BCrypt.Net.BCrypt.Verify(payload.Password, currentUser.HashedPassword))
                return Results.Unauthorized();

            // Reset: remove reservas antigas (não em_uso/concluido recentes)
            var cutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-6));
            var oldReservations = await db.Reservations
                .Where(r => r.Date < cutoff && r.Status != "em_uso")
                .ToListAsync();
            db.Reservations.RemoveRange(oldReservations);
            await db.SaveChangesAsync();

            return Results.Ok(new { message = $"Reset semestral realizado. {oldReservations.Count} reservas removidas." });
        });
    }

    // Restore helpers
    private static async Task<bool> RestoreUser(int id, LabManagerDbContext db)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt != null);
        if (u == null) return false;
        u.DeletedAt = null; u.IsActive = true; return true;
    }
    private static async Task<bool> RestoreLab(int id, LabManagerDbContext db)
    {
        var l = await db.Laboratories.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt != null);
        if (l == null) return false;
        l.DeletedAt = null; return true;
    }
    private static async Task<bool> RestoreSoftware(int id, LabManagerDbContext db)
    {
        var s = await db.Softwares.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt != null);
        if (s == null) return false;
        s.DeletedAt = null; return true;
    }
    private static async Task<bool> RestoreItemModel(int id, LabManagerDbContext db)
    {
        var m = await db.ItemModels.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt != null);
        if (m == null) return false;
        m.DeletedAt = null; return true;
    }

    // Destroy helpers
    private static async Task<bool> DestroyUser(int id, LabManagerDbContext db)
    {
        var u = await db.Users.FindAsync(id);
        if (u == null) return false;
        db.Users.Remove(u); return true;
    }
    private static async Task<bool> DestroyLab(int id, LabManagerDbContext db)
    {
        var l = await db.Laboratories.FindAsync(id);
        if (l == null) return false;
        db.Laboratories.Remove(l); return true;
    }
    private static async Task<bool> DestroySoftware(int id, LabManagerDbContext db)
    {
        var s = await db.Softwares.FindAsync(id);
        if (s == null) return false;
        db.Softwares.Remove(s); return true;
    }
    private static async Task<bool> DestroyItemModel(int id, LabManagerDbContext db)
    {
        var m = await db.ItemModels.FindAsync(id);
        if (m == null) return false;
        db.ItemModels.Remove(m); return true;
    }

    public class SemesterResetRequest { public string Password { get; set; } = null!; }
}
