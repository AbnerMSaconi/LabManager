using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class ReservationsEndpoints
{
    private static readonly string[] ActiveStatuses = ["pendente", "aprovado", "aguardando_software", "em_uso", "aprovado_com_ressalvas"];

    public static void MapReservationsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/reservations").RequireAuthorization();

        // GET /api/v1/reservations/my
        group.MapGet("/my", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            var reservations = await db.Reservations
                .Include(r => r.Slots)
                .Include(r => r.ReservationItems).ThenInclude(i => i.ItemModel)
                .Include(r => r.Lab)
                .Include(r => r.User)
                .Where(r => r.UserId == currentUser.Id)
                .OrderByDescending(r => r.Date)
                .ToListAsync();

            return Results.Ok(reservations.Select(Shared.MapReservation));
        });

        // GET /api/v1/reservations/my/practical — reservas em labs práticos (Bloco C)
        group.MapGet("/my/practical", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            var reservations = await db.Reservations
                .Include(r => r.Slots)
                .Include(r => r.ReservationItems).ThenInclude(i => i.ItemModel)
                .Include(r => r.Lab)
                .Include(r => r.User)
                .Where(r => r.UserId == currentUser.Id
                    && ActiveStatuses.Contains(r.Status)
                    && r.Lab != null && r.Lab.IsPractical)
                .OrderByDescending(r => r.Date)
                .ToListAsync();

            return Results.Ok(reservations.Select(Shared.MapReservation));
        });

        // GET /api/v1/reservations/pending
        group.MapGet("/pending", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.ReviewerRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservations = await db.Reservations
                .Include(r => r.Slots)
                .Include(r => r.ReservationItems).ThenInclude(i => i.ItemModel)
                .Include(r => r.Lab)
                .Include(r => r.User)
                .Where(r => r.Status == "pendente")
                .OrderBy(r => r.Date)
                .ToListAsync();

            return Results.Ok(reservations.Select(Shared.MapReservation));
        });

        // GET /api/v1/reservations/today
        group.MapGet("/today", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var reservations = await db.Reservations
                .Include(r => r.Slots)
                .Include(r => r.ReservationItems).ThenInclude(i => i.ItemModel)
                .Include(r => r.Lab)
                .Include(r => r.User)
                .Where(r => r.Date == today && ActiveStatuses.Contains(r.Status))
                .OrderBy(r => r.Lab!.Name)
                .ToListAsync();

            return Results.Ok(reservations.Select(Shared.MapReservation));
        });

        // GET /api/v1/reservations/awaiting-software
        group.MapGet("/awaiting-software", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservations = await db.Reservations
                .Include(r => r.Slots)
                .Include(r => r.ReservationItems).ThenInclude(i => i.ItemModel)
                .Include(r => r.Lab)
                .Include(r => r.User)
                .Where(r => r.Status == "aguardando_software")
                .OrderBy(r => r.Date)
                .ToListAsync();

            return Results.Ok(reservations.Select(Shared.MapReservation));
        });

        // GET /api/v1/reservations/date/{date}
        group.MapGet("/date/{date}", async (string date, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            if (!DateOnly.TryParse(date, out var parsedDate))
                return Results.BadRequest(new { detail = "Data inválida." });

            var reservations = await db.Reservations
                .Include(r => r.Slots)
                .Include(r => r.ReservationItems).ThenInclude(i => i.ItemModel)
                .Include(r => r.Lab)
                .Include(r => r.User)
                .Where(r => r.Date == parsedDate)
                .OrderBy(r => r.Lab!.Name)
                .ToListAsync();

            return Results.Ok(reservations.Select(Shared.MapReservation));
        });

        // GET /api/v1/reservations — todas (admin/DTI)
        group.MapGet("/", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.ReviewerRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservations = await db.Reservations
                .Include(r => r.Slots)
                .Include(r => r.ReservationItems).ThenInclude(i => i.ItemModel)
                .Include(r => r.Lab)
                .Include(r => r.User)
                .OrderByDescending(r => r.Date)
                .ToListAsync();

            return Results.Ok(reservations.Select(Shared.MapReservation));
        });

        // POST /api/v1/reservations
        group.MapPost("/", async (CreateReservationRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            if (payload.Dates == null || payload.Dates.Count == 0)
                return Results.BadRequest(new { detail = "Informe pelo menos uma data." });

            var slots = await db.LessonSlots.Where(s => payload.SlotIds.Contains(s.Id)).ToListAsync();
            if (slots.Count == 0)
                return Results.BadRequest(new { detail = "Horários inválidos." });

            string? groupId = payload.Dates.Count > 1 ? Guid.NewGuid().ToString("N")[..20] : null;
            var ids = new List<int>();

            foreach (var dateStr in payload.Dates)
            {
                if (!DateOnly.TryParse(dateStr, out var date))
                    return Results.BadRequest(new { detail = $"Data inválida: {dateStr}" });

                var reservation = new Reservation
                {
                    UserId = currentUser.Id,
                    LabId = payload.LabId,
                    Date = date,
                    Status = "pendente",
                    RequestedSoftwares = payload.RequestedSoftwares,
                    SoftwareInstallationRequired = payload.SoftwareInstallationRequired ?? false,
                    GroupId = groupId,
                    CreatedAt = DateTime.UtcNow
                };

                foreach (var slot in slots) reservation.Slots.Add(slot);

                db.Reservations.Add(reservation);
                await db.SaveChangesAsync();

                if (payload.Items?.Count > 0)
                {
                    foreach (var item in payload.Items)
                        db.ReservationItems.Add(new ReservationItem
                        {
                            ReservationId = reservation.Id,
                            ItemModelId = item.ItemModelId,
                            QuantityRequested = item.QuantityRequested
                        });
                    await db.SaveChangesAsync();
                }

                ids.Add(reservation.Id);
            }

            return Results.Json(new { message = "Reserva(s) criada(s).", group_id = groupId, ids }, statusCode: 201);
        });

        // PUT /api/v1/reservations/{id}
        group.MapPut("/{id:int}", async (int id, UpdateReservationRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            var reservation = await db.Reservations.Include(r => r.Slots)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (reservation == null) return Results.NotFound(new { detail = "Reserva não encontrada." });

            if (reservation.UserId != currentUser.Id && !Shared.ReviewerRoles.Contains(currentUser.Role))
                return Results.Forbid();

            if (payload.LabId.HasValue) reservation.LabId = payload.LabId.Value;
            if (payload.Date != null && DateOnly.TryParse(payload.Date, out var newDate)) reservation.Date = newDate;

            if (payload.SlotIds?.Count > 0)
            {
                reservation.Slots.Clear();
                var slots = await db.LessonSlots.Where(s => payload.SlotIds.Contains(s.Id)).ToListAsync();
                foreach (var slot in slots) reservation.Slots.Add(slot);
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Reserva atualizada." });
        });

        // DELETE /api/v1/reservations/{id}
        group.MapDelete("/{id:int}", async (int id, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == id);
            if (reservation == null) return Results.NotFound(new { detail = "Reserva não encontrada." });

            if (reservation.UserId != currentUser.Id && !Shared.ReviewerRoles.Contains(currentUser.Role))
                return Results.Forbid();

            reservation.Status = "cancelado";
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Reserva cancelada." });
        });

        // PATCH /api/v1/reservations/{id}/review
        group.MapPatch("/{id:int}/review", async (int id, ReviewPayload payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.ReviewerRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == id);
            if (reservation == null) return Results.NotFound(new { detail = "Reserva não encontrada." });

            reservation.Status = payload.Status;
            reservation.ApprovedById = currentUser.Id;
            reservation.RejectionReason = payload.RejectionReason;
            reservation.ApprovalNotes = payload.ApprovalNotes;

            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Reserva revisada." });
        });

        // PATCH /api/v1/reservations/group/{groupId}/review
        group.MapPatch("/group/{groupId}/review", async (string groupId, ReviewPayload payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.ReviewerRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservations = await db.Reservations.Where(r => r.GroupId == groupId).ToListAsync();
            if (reservations.Count == 0) return Results.NotFound(new { detail = "Grupo não encontrado." });

            foreach (var r in reservations)
            {
                r.Status = payload.Status;
                r.ApprovedById = currentUser.Id;
                r.RejectionReason = payload.RejectionReason;
                r.ApprovalNotes = payload.ApprovalNotes;
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { message = $"{reservations.Count} reserva(s) revisada(s)." });
        });

        // POST /api/v1/reservations/{id}/confirm-installation
        group.MapPost("/{id:int}/confirm-installation", async (int id, ConfirmInstallationRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservation = await db.Reservations.Include(r => r.Lab)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (reservation == null) return Results.NotFound(new { detail = "Reserva não encontrada." });

            reservation.Status = "aprovado";
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Instalação confirmada." });
        });

        // POST /api/v1/reservations/group/{groupId}/confirm-installation
        group.MapPost("/group/{groupId}/confirm-installation", async (string groupId, ConfirmInstallationRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservations = await db.Reservations.Where(r => r.GroupId == groupId).ToListAsync();
            if (reservations.Count == 0) return Results.NotFound(new { detail = "Grupo não encontrado." });

            foreach (var r in reservations) r.Status = "aprovado";
            await db.SaveChangesAsync();
            return Results.Ok(new { message = $"{reservations.Count} reserva(s) confirmada(s)." });
        });

        // POST /api/v1/reservations/{id}/add-items
        group.MapPost("/{id:int}/add-items", async (int id, AddItemsRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();

            var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == id);
            if (reservation == null) return Results.NotFound(new { detail = "Reserva não encontrada." });

            if (reservation.UserId != currentUser.Id && !Shared.DtiRoles.Contains(currentUser.Role))
                return Results.Forbid();

            foreach (var item in payload.Items)
                db.ReservationItems.Add(new ReservationItem
                {
                    ReservationId = id,
                    ItemModelId = item.ItemModelId,
                    QuantityRequested = item.QuantityRequested
                });

            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Itens adicionados." });
        });
    }

    // DTOs
    public class CreateReservationRequest
    {
        public int? LabId { get; set; }
        public List<string> Dates { get; set; } = [];
        public List<int> SlotIds { get; set; } = [];
        public List<ReservationItemRequest> Items { get; set; } = [];
        public string? RequestedSoftwares { get; set; }
        public bool? SoftwareInstallationRequired { get; set; }
    }

    public class ReservationItemRequest { public int ItemModelId { get; set; } public int QuantityRequested { get; set; } }
    public class UpdateReservationRequest { public int? LabId { get; set; } public string? Date { get; set; } public List<int>? SlotIds { get; set; } }
    public class ReviewPayload { public string Status { get; set; } = null!; public string? RejectionReason { get; set; } public string? ApprovalNotes { get; set; } }
    public class ConfirmInstallationRequest { public List<int> SoftwareIds { get; set; } = []; }
    public class AddItemsRequest { public List<ReservationItemRequest> Items { get; set; } = []; }
}
