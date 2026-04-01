using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class LogisticsEndpoints
{
    public static void MapLogisticsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/logistics").RequireAuthorization();

        // POST /api/v1/logistics/checkout
        group.MapPost("/checkout", async (CheckoutRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservation = await db.Reservations
                .Include(r => r.ReservationItems)
                .FirstOrDefaultAsync(r => r.Id == payload.ReservationId);
            if (reservation == null) return Results.NotFound(new { detail = "Reserva não encontrada." });

            foreach (var item in payload.Items)
            {
                var ri = reservation.ReservationItems.FirstOrDefault(i => i.Id == item.ReservationItemId);
                if (ri == null) continue;

                if (item.PhysicalItemId.HasValue)
                {
                    ri.PhysicalItemId = item.PhysicalItemId;
                    var physical = await db.PhysicalItems.FindAsync(item.PhysicalItemId);
                    if (physical != null) physical.Status = "em_uso";
                }

                db.InventoryMovements.Add(new InventoryMovement
                {
                    ItemModelId = ri.ItemModelId,
                    Action = "saida",
                    Quantity = item.QuantityDelivered ?? ri.QuantityRequested,
                    OperatorId = currentUser.Id,
                    Target = $"Reserva #{payload.ReservationId}",
                    ReservationId = payload.ReservationId,
                    CreatedAt = DateTime.UtcNow
                });
            }

            reservation.Status = "em_uso";
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Checkout realizado." });
        });

        // POST /api/v1/logistics/checkin
        group.MapPost("/checkin", async (CheckinRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservation = await db.Reservations
                .Include(r => r.ReservationItems)
                .FirstOrDefaultAsync(r => r.Id == payload.ReservationId);
            if (reservation == null) return Results.NotFound(new { detail = "Reserva não encontrada." });

            foreach (var item in payload.Items)
            {
                var ri = reservation.ReservationItems.FirstOrDefault(i => i.Id == item.ReservationItemId);
                if (ri == null) continue;

                ri.ReturnStatus = item.NewStatus;
                ri.DamageObservation = item.DamageObservation;
                ri.QuantityReturned = item.QuantityReturned ?? ri.QuantityRequested;

                if (ri.PhysicalItemId.HasValue)
                {
                    var physical = await db.PhysicalItems.FindAsync(ri.PhysicalItemId);
                    if (physical != null)
                        physical.Status = item.NewStatus == "avariado" ? "manutencao" : "disponivel";
                }

                db.InventoryMovements.Add(new InventoryMovement
                {
                    ItemModelId = ri.ItemModelId,
                    Action = "entrada",
                    Quantity = ri.QuantityReturned,
                    OperatorId = currentUser.Id,
                    Target = $"Devolução Reserva #{payload.ReservationId}",
                    ReservationId = payload.ReservationId,
                    Observation = item.DamageObservation,
                    CreatedAt = DateTime.UtcNow
                });
            }

            reservation.Status = "concluido";
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Check-in realizado." });
        });

        // POST /api/v1/logistics/loans
        group.MapPost("/loans", async (LoanCreateRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var model = await db.ItemModels.FirstOrDefaultAsync(m => m.Id == payload.ItemModelId && m.DeletedAt == null);
            if (model == null) return Results.NotFound(new { detail = "Modelo não encontrado." });

            var loan = new InstitutionLoan
            {
                ItemModelId = payload.ItemModelId,
                RequesterName = payload.RequesterName,
                QuantityDelivered = payload.QuantityDelivered,
                ReturnDate = payload.ReturnDate.HasValue ? DateOnly.FromDateTime(payload.ReturnDate.Value) : null,
                NoReturnReason = payload.NoReturnReason,
                CreatedById = currentUser.Id,
                Status = "em_aberto",
                CreatedAt = DateTime.UtcNow
            };
            db.InstitutionLoans.Add(loan);

            db.InventoryMovements.Add(new InventoryMovement
            {
                ItemModelId = payload.ItemModelId,
                Action = "emprestimo",
                Quantity = payload.QuantityDelivered,
                OperatorId = currentUser.Id,
                Target = payload.RequesterName,
                CreatedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync();
            return Results.Json(new { message = "Empréstimo criado.", id = loan.Id }, statusCode: 201);
        });

        // GET /api/v1/logistics/loans
        group.MapGet("/loans", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var loans = await db.InstitutionLoans
                .Include(l => l.ItemModel)
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync();

            return Results.Ok(loans.Select(l => new
            {
                l.Id, l.ItemModelId, l.RequesterName, l.QuantityDelivered, l.QuantityReturned,
                ReturnDate = l.ReturnDate.HasValue ? l.ReturnDate.Value.ToString("yyyy-MM-dd") : null,
                l.NoReturnReason, l.Status, l.DamageObservation, l.IsOperational,
                l.CreatedAt,
                ReturnedAt = l.ReturnedAt,
                Model = l.ItemModel == null ? null : (object)new { l.ItemModel.Id, l.ItemModel.Name, l.ItemModel.Category }
            }));
        });

        // PATCH /api/v1/logistics/loans/{id}/return
        group.MapPatch("/loans/{id:int}/return", async (int id, LoanReturnRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var loan = await db.InstitutionLoans.FindAsync(id);
            if (loan == null) return Results.NotFound(new { detail = "Empréstimo não encontrado." });

            loan.QuantityReturned = payload.QuantityReturned;
            loan.DamageObservation = payload.DamageObservation;
            loan.IsOperational = payload.IsOperational;
            loan.ReturnedAt = DateTime.UtcNow;

            if (payload.AllReturned)
                loan.Status = payload.HasDamage ? "devolvido_com_avaria" : "devolvido";
            else
                loan.Status = "devolvido_com_avaria";

            db.InventoryMovements.Add(new InventoryMovement
            {
                ItemModelId = loan.ItemModelId,
                Action = "devolucao",
                Quantity = payload.QuantityReturned,
                OperatorId = currentUser.Id,
                Target = loan.RequesterName,
                LoanId = id,
                Observation = payload.DamageObservation,
                CreatedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Devolução registrada." });
        });
    }

    // DTOs
    public class CheckoutItemRequest { public int ReservationItemId { get; set; } public int? PhysicalItemId { get; set; } public int? QuantityDelivered { get; set; } }
    public class CheckoutRequest { public int ReservationId { get; set; } public List<CheckoutItemRequest> Items { get; set; } = []; }
    public class CheckinItemRequest { public int ReservationItemId { get; set; } public string NewStatus { get; set; } = null!; public string? DamageObservation { get; set; } public int? QuantityReturned { get; set; } }
    public class CheckinRequest { public int ReservationId { get; set; } public List<CheckinItemRequest> Items { get; set; } = []; }
    public class LoanCreateRequest
    {
        public int ItemModelId { get; set; }
        public string RequesterName { get; set; } = null!;
        public int QuantityDelivered { get; set; }
        public DateTime? ReturnDate { get; set; }
        public string? NoReturnReason { get; set; }
    }
    public class LoanReturnRequest { public bool AllReturned { get; set; } public int QuantityReturned { get; set; } public bool HasDamage { get; set; } public bool? IsOperational { get; set; } public string? DamageObservation { get; set; } }
}
