using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class MaintenanceEndpoints
{
    public static void MapMaintenanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/maintenance").RequireAuthorization();

        // GET /api/v1/maintenance
        group.MapGet("/", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            var query = db.MaintenanceTickets
                .Include(t => t.Lab)
                .Include(t => t.OpenedBy)
                .Include(t => t.ResolvedBy)
                .AsQueryable();

            // Professores veem apenas os seus próprios chamados
            if (currentUser.Role == "professor")
                query = query.Where(t => t.OpenedById == currentUser.Id);

            var tickets = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();

            return Results.Ok(tickets.Select(t => new
            {
                t.Id, t.Title, t.Description,
                LabId = t.LabId,
                LabName = t.Lab == null ? null : t.Lab.Name,
                t.PhysicalItemId,
                OpenedBy = t.OpenedBy == null ? null : t.OpenedBy.FullName,
                t.Status, t.Severity, t.ResolutionNotes,
                t.CreatedAt,
                t.ResolvedAt
            }));
        });

        // POST /api/v1/maintenance
        group.MapPost("/", async (CreateTicketRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            var ticket = new MaintenanceTicket
            {
                Title = payload.Title,
                Description = payload.Description,
                LabId = payload.LabId,
                PhysicalItemId = payload.PhysicalItemId,
                Severity = payload.Severity ?? "medio",
                OpenedById = currentUser.Id,
                Status = "aberto",
                CreatedAt = DateTime.UtcNow
            };

            db.MaintenanceTickets.Add(ticket);
            await db.SaveChangesAsync();
            return Results.Json(new { id = ticket.Id, message = "Chamado aberto." }, statusCode: 201);
        });

        // PATCH /api/v1/maintenance/{id}
        group.MapPatch("/{id:int}", async (int id, ResolveTicketRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiManageRoles.Contains(currentUser.Role)) return Results.Forbid();

            var ticket = await db.MaintenanceTickets.FindAsync(id);
            if (ticket == null) return Results.NotFound(new { detail = "Chamado não encontrado." });

            ticket.Status = payload.Status;
            ticket.ResolutionNotes = payload.ResolutionNotes;

            if (payload.Status == "resolvido")
            {
                ticket.ResolvedById = currentUser.Id;
                ticket.ResolvedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Chamado atualizado." });
        });
    }

    public class CreateTicketRequest
    {
        public string Title { get; set; } = null!;
        public string Description { get; set; } = null!;
        public int? LabId { get; set; }
        public int? PhysicalItemId { get; set; }
        public string? Severity { get; set; }
    }

    public class ResolveTicketRequest
    {
        public string ResolutionNotes { get; set; } = null!;
        public string Status { get; set; } = null!;
    }
}
