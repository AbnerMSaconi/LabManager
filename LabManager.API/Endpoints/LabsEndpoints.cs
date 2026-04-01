using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class LabsEndpoints
{
    private static readonly string[] ValidBlocks = ["Bloco A", "Bloco B", "Bloco C"];

    // Método de extensão que vai injetar as rotas no Program.cs
    public static void MapLabsEndpoints(this IEndpointRouteBuilder app)
    {
        // Cria um grupo de rotas com o prefixo e obriga autenticação Keycloak
        var group = app.MapGroup("/api/v1")
                       .RequireAuthorization();

        // ------------------------------------------------------------------ //
        //  LABS
        // ------------------------------------------------------------------ //

        group.MapPost("/labs/available", async (LabAvailabilityRequest req, LabManagerDbContext db) =>
        {
            if (req.Dates == null || req.Dates.Count == 0 || req.SlotIds == null || req.SlotIds.Count == 0)
                return Results.BadRequest(new { detail = "Datas e horários são obrigatórios." });

            var parsedDates = new List<DateOnly>();
            foreach (var d in req.Dates)
            {
                if (!DateOnly.TryParse(d, out var pd))
                    return Results.BadRequest(new { detail = $"Data inválida: {d}" });
                parsedDates.Add(pd);
            }

            var activeStatuses = new[] { "pendente", "aprovado", "aguardando_software", "em_uso" };

            var conflictingIds = await db.Reservations
                .Where(r => parsedDates.Contains(r.Date)
                    && activeStatuses.Contains(r.Status)
                    && r.Slots.Any(s => req.SlotIds.Contains(s.Id)))
                .Select(r => r.LabId)
                .Distinct()
                .ToListAsync();

            var query = db.Laboratories
                .Include(l => l.Softwares)
                .Where(l => l.DeletedAt == null && !conflictingIds.Contains(l.Id));

            if (!string.IsNullOrEmpty(req.Block))
                query = query.Where(l => l.Block == req.Block);

            var labs = await query.OrderBy(l => l.Name).ToListAsync();
            return Results.Ok(labs.Select(MapLab));
        });

        group.MapGet("/labs", async (LabManagerDbContext db) =>
        {
            var labs = await db.Laboratories
                .Include(l => l.Softwares)
                .Where(l => l.DeletedAt == null)
                .ToListAsync();
            return Results.Ok(labs.Select(MapLab));
        });

        group.MapGet("/labs/{labId:int}", async (int labId, LabManagerDbContext db) =>
        {
            var lab = await db.Laboratories
                .Include(l => l.Softwares)
                .FirstOrDefaultAsync(l => l.Id == labId && l.DeletedAt == null);
            
            return lab == null ? Results.NotFound(new { detail = "Laboratório não encontrado." }) : Results.Ok(MapLab(lab));
        });

        group.MapPost("/labs", async (LaboratoryCreateRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            if (!ValidBlocks.Contains(payload.Block))
                return Results.BadRequest(new { detail = $"Bloco inválido: {payload.Block}. Use: {string.Join(", ", ValidBlocks)}" });

            var lab = new Laboratory
            {
                Name = payload.Name, Block = payload.Block, RoomNumber = payload.RoomNumber,
                Capacity = payload.Capacity, IsPractical = payload.IsPractical,
                Description = payload.Description, IsActive = true,
            };
            db.Laboratories.Add(lab);
            await db.SaveChangesAsync();

            if (payload.SoftwareIds?.Count > 0)
            {
                var softwares = await db.Softwares.Where(s => payload.SoftwareIds.Contains(s.Id)).ToListAsync();
                foreach (var sw in softwares) lab.Softwares.Add(sw);
                await db.SaveChangesAsync();
            }

            return Results.Json(new { message = "Laboratório criado.", id = lab.Id }, statusCode: 201);
        });

        group.MapPut("/labs/{labId:int}", async (int labId, LaboratoryUpdateRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var lab = await db.Laboratories.Include(l => l.Softwares).FirstOrDefaultAsync(l => l.Id == labId && l.DeletedAt == null);
            if (lab == null) return Results.NotFound(new { detail = "Laboratório não encontrado." });

            var oldData = new { lab.Name, lab.Block, lab.RoomNumber, lab.Capacity, lab.IsPractical, lab.Description, lab.IsActive };

            if (payload.Name != null) lab.Name = payload.Name;
            if (payload.Block != null)
            {
                if (!ValidBlocks.Contains(payload.Block)) return Results.BadRequest(new { detail = $"Bloco inválido: {payload.Block}." });
                lab.Block = payload.Block;
            }
            if (payload.RoomNumber != null) lab.RoomNumber = payload.RoomNumber;
            if (payload.Capacity.HasValue) lab.Capacity = payload.Capacity.Value;
            if (payload.IsPractical.HasValue) lab.IsPractical = payload.IsPractical.Value;
            if (payload.Description != null) lab.Description = payload.Description;
            if (payload.IsActive.HasValue) lab.IsActive = payload.IsActive.Value;
            
            if (payload.SoftwareIds != null)
            {
                lab.Softwares.Clear();
                var softwares = await db.Softwares.Where(s => payload.SoftwareIds.Contains(s.Id)).ToListAsync();
                foreach (var sw in softwares) lab.Softwares.Add(sw);
            }

            var newData = new { lab.Name, lab.Block, lab.RoomNumber, lab.Capacity, lab.IsPractical, lab.Description, lab.IsActive };
            db.AuditLogs.Add(new AuditLog
            {
                TableName = "laboratories", RecordId = labId,
                OldData = JsonSerializer.Serialize(oldData), NewData = JsonSerializer.Serialize(newData),
                UserId = currentUser.Id,
            });

            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Laboratório atualizado." });
        });

        group.MapDelete("/labs/{labId:int}", async (int labId, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var lab = await db.Laboratories.FirstOrDefaultAsync(l => l.Id == labId && l.DeletedAt == null);
            if (lab == null) return Results.NotFound(new { detail = "Laboratório não encontrado." });

            lab.DeletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Laboratório movido para a quarentena." });
        });

        // ------------------------------------------------------------------ //
        //  SLOTS & SOFTWARES
        // ------------------------------------------------------------------ //

        group.MapGet("/slots", async (LabManagerDbContext db) =>
        {
            var slots = await db.LessonSlots.OrderBy(s => s.Code).ToListAsync();
            return Results.Ok(slots.Select(s => new { s.Id, s.Code, s.StartTime, s.EndTime }));
        });

        group.MapGet("/softwares", async (LabManagerDbContext db) =>
        {
            var softwares = await db.Softwares.Where(s => s.DeletedAt == null).ToListAsync();
            return Results.Ok(softwares.Select(s => new { s.Id, s.Name, s.Version }));
        });

        group.MapPost("/softwares", async (SoftwareCreateRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiManageRoles.Contains(currentUser.Role)) return Results.Forbid();

            var sw = new Software { Name = payload.Name, Version = payload.Version };
            db.Softwares.Add(sw);
            await db.SaveChangesAsync();
            return Results.Json(new { message = "Software cadastrado.", id = sw.Id }, statusCode: 201);
        });

        group.MapDelete("/softwares/{swId:int}", async (int swId, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiManageRoles.Contains(currentUser.Role)) return Results.Forbid();

            var sw = await db.Softwares.FirstOrDefaultAsync(s => s.Id == swId && s.DeletedAt == null);
            if (sw == null) return Results.NotFound(new { detail = "Software não encontrado." });

            sw.DeletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Software movido para a quarentena." });
        });

        group.MapPost("/softwares/import/preview", async (IFormFile file, LabManagerDbContext db) =>
        {
            if (file == null || file.Length == 0)
                return Results.BadRequest(new { detail = "Arquivo não informado." });

            var labs = new List<object>();
            int totalSoftwares = 0;

            using var reader = new System.IO.StreamReader(file.OpenReadStream());
            // CSV: lab_name,software1,software2,...
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                var cols = line.Split(',').Select(c => c.Trim()).ToList();
                if (cols.Count < 1) continue;
                var labName = cols[0];
                var softwares = cols.Skip(1).Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
                var existingLab = await db.Laboratories.FirstOrDefaultAsync(l => l.Name == labName && l.DeletedAt == null);
                labs.Add(new { lab_name = labName, lab_id = existingLab?.Id, softwares });
                totalSoftwares += softwares.Count;
            }

            return Results.Ok(new { labs, total_softwares = totalSoftwares });
        }).DisableAntiforgery();

        group.MapPost("/softwares/import/confirm", async (SoftwareImportConfirmPayload payload, LabManagerDbContext db) =>
        {
            int createdSw = 0, linked = 0;
            foreach (var item in payload.Items)
            {
                Laboratory? lab = null;
                if (item.LabId.HasValue)
                    lab = await db.Laboratories.Include(l => l.Softwares).FirstOrDefaultAsync(l => l.Id == item.LabId.Value);

                foreach (var swName in item.Softwares)
                {
                    if (string.IsNullOrWhiteSpace(swName)) continue;
                    var existing = await db.Softwares.FirstOrDefaultAsync(s => s.Name == swName);
                    if (existing == null)
                    {
                        existing = new Software { Name = swName };
                        db.Softwares.Add(existing);
                        await db.SaveChangesAsync();
                        createdSw++;
                    }
                    if (lab != null && !lab.Softwares.Any(s => s.Id == existing.Id))
                    {
                        lab.Softwares.Add(existing);
                        linked++;
                    }
                }
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { created = createdSw, linked });
        });
    }

    // ------------------------------------------------------------------ //
    //  HELPERS & DTOs
    // ------------------------------------------------------------------ //

    private static Task<User?> GetCurrentUserAsync(ClaimsPrincipal user, LabManagerDbContext db)
        => Shared.GetCurrentUserAsync(user, db);

    private static object MapLab(Laboratory l) => new
    {
        l.Id, l.Name, l.Block, l.RoomNumber, l.Capacity, l.IsPractical, l.Description, l.IsActive, l.DeletedAt,
        softwares = l.Softwares.Select(s => new { s.Id, s.Name, s.Version }),
    };

    public class LabAvailabilityRequest { public List<string> Dates { get; set; } = []; public List<int> SlotIds { get; set; } = []; public string? Block { get; set; } }
    public class LaboratoryCreateRequest { public string Name { get; set; } = null!; public string Block { get; set; } = null!; public string RoomNumber { get; set; } = null!; public int Capacity { get; set; } public bool IsPractical { get; set; } public string? Description { get; set; } public List<int>? SoftwareIds { get; set; } }
    public class LaboratoryUpdateRequest { public string? Name { get; set; } public string? Block { get; set; } public string? RoomNumber { get; set; } public int? Capacity { get; set; } public bool? IsPractical { get; set; } public string? Description { get; set; } public bool? IsActive { get; set; } public List<int>? SoftwareIds { get; set; } }
    public class SoftwareCreateRequest { public string Name { get; set; } = null!; public string? Version { get; set; } }
    public class SoftwareImportConfirmItem { public int? LabId { get; set; } public string LabName { get; set; } = null!; public List<string> Softwares { get; set; } = []; }
    public class SoftwareImportConfirmPayload { public List<SoftwareImportConfirmItem> Items { get; set; } = []; }
}