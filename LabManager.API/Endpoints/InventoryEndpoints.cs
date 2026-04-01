using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class InventoryEndpoints
{
    private static readonly string[] ActiveReservationStatuses = ["pendente", "aprovado", "aguardando_software", "aprovado_com_ressalvas"];

    public static void MapInventoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/inventory").RequireAuthorization();

        // GET /api/v1/inventory/models
        group.MapGet("/models", async (LabManagerDbContext db) =>
        {
            var models = await db.ItemModels
                .Where(m => m.DeletedAt == null)
                .OrderBy(m => m.Name)
                .ToListAsync();

            return Results.Ok(models.Select(MapModel));
        });

        // GET /api/v1/inventory/models/available?date=
        group.MapGet("/models/available", async (string? date, LabManagerDbContext db) =>
        {
            if (string.IsNullOrEmpty(date) || !DateOnly.TryParse(date, out var parsedDate))
                return Results.BadRequest(new { detail = "Parâmetro 'date' inválido ou ausente." });

            var models = await db.ItemModels.Where(m => m.DeletedAt == null).ToListAsync();

            // Itens em uso em reservas ativas para aquela data
            var inUseByModel = await db.ReservationItems
                .Include(i => i.Reservation)
                .Where(i => i.Reservation.Date == parsedDate
                    && ActiveReservationStatuses.Contains(i.Reservation.Status))
                .GroupBy(i => i.ItemModelId)
                .Select(g => new { ModelId = g.Key, Total = g.Sum(i => i.QuantityRequested) })
                .ToListAsync();

            // Itens em empréstimo aberto
            var inLoansByModel = await db.InstitutionLoans
                .Where(l => l.Status == "em_aberto")
                .GroupBy(l => l.ItemModelId)
                .Select(g => new { ModelId = g.Key, Total = g.Sum(l => l.QuantityDelivered - l.QuantityReturned) })
                .ToListAsync();

            var inUseDict = inUseByModel.ToDictionary(x => x.ModelId, x => x.Total);
            var inLoanDict = inLoansByModel.ToDictionary(x => x.ModelId, x => x.Total);

            var result = models.Select(m =>
            {
                var inUse = inUseDict.GetValueOrDefault(m.Id, 0);
                var inLoans = inLoanDict.GetValueOrDefault(m.Id, 0);
                var availableQty = Math.Max(0, m.TotalStock - m.MaintenanceStock - inUse - inLoans);
                return new
                {
                    m.Id, m.Name, m.Category, m.Description, m.ModelNumber, m.ImageUrl, m.TotalStock,
                    AvailableQty = availableQty
                };
            }).Where(m => m.AvailableQty > 0);

            return Results.Ok(result);
        });

        // GET /api/v1/inventory/stock
        group.MapGet("/stock", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var models = await db.ItemModels.Where(m => m.DeletedAt == null).ToListAsync();

            var inUseByModel = await db.ReservationItems
                .Include(i => i.Reservation)
                .Where(i => ActiveReservationStatuses.Contains(i.Reservation.Status))
                .GroupBy(i => i.ItemModelId)
                .Select(g => new { ModelId = g.Key, Total = g.Sum(i => i.QuantityRequested) })
                .ToListAsync();

            var inLoansByModel = await db.InstitutionLoans
                .Where(l => l.Status == "em_aberto")
                .GroupBy(l => l.ItemModelId)
                .Select(g => new { ModelId = g.Key, Total = g.Sum(l => l.QuantityDelivered - l.QuantityReturned) })
                .ToListAsync();

            var inUseDict = inUseByModel.ToDictionary(x => x.ModelId, x => x.Total);
            var inLoanDict = inLoansByModel.ToDictionary(x => x.ModelId, x => x.Total);

            var stock = models.Select(m =>
            {
                var inUse = inUseDict.GetValueOrDefault(m.Id, 0);
                var inLoans = inLoanDict.GetValueOrDefault(m.Id, 0);
                return new
                {
                    m.Id, m.Name, m.Category, m.Description, m.ModelNumber, m.ImageUrl, m.TotalStock, m.MaintenanceStock,
                    InUse = inUse,
                    InLoans = inLoans,
                    AvailableQty = Math.Max(0, m.TotalStock - m.MaintenanceStock - inUse - inLoans)
                };
            });

            return Results.Ok(stock);
        });

        // GET /api/v1/inventory/movements
        group.MapGet("/movements", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var movements = await db.InventoryMovements
                .Include(m => m.ItemModel)
                .Include(m => m.Operator)
                .OrderByDescending(m => m.CreatedAt)
                .Take(500)
                .ToListAsync();

            return Results.Ok(movements.Select(m => new
            {
                m.Id, m.ItemModelId, m.Action, m.Quantity, m.OperatorId,
                m.Target, m.ReservationId, m.LoanId, m.Observation, m.CreatedAt,
                Model = m.ItemModel == null ? null : (object)new { m.ItemModel.Id, m.ItemModel.Name, m.ItemModel.Category },
                Operator = m.Operator == null ? null : (object)new { m.Operator.Id, m.Operator.FullName, m.Operator.Role }
            }));
        });

        // GET /api/v1/inventory/pending-requests
        group.MapGet("/pending-requests", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var reservations = await db.Reservations
                .Include(r => r.Slots)
                .Include(r => r.ReservationItems).ThenInclude(i => i.ItemModel)
                .Include(r => r.Lab)
                .Include(r => r.User)
                .Where(r => r.Status == "aprovado" && r.ReservationItems.Any())
                .OrderBy(r => r.Date)
                .ToListAsync();

            return Results.Ok(reservations.Select(Shared.MapReservation));
        });

        // POST /api/v1/inventory/item-models
        group.MapPost("/item-models", async (ItemModelRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var model = new ItemModel
            {
                Name = payload.Name, Category = payload.Category, Description = payload.Description,
                ModelNumber = payload.ModelNumber, ImageUrl = payload.ImageUrl,
                TotalStock = payload.TotalStock, MaintenanceStock = payload.MaintenanceStock ?? 0
            };
            db.ItemModels.Add(model);
            await db.SaveChangesAsync();
            return Results.Json(MapModel(model), statusCode: 201);
        });

        // PATCH /api/v1/inventory/item-models/{id}
        group.MapPatch("/item-models/{id:int}", async (int id, ItemModelPatchRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var model = await db.ItemModels.FirstOrDefaultAsync(m => m.Id == id && m.DeletedAt == null);
            if (model == null) return Results.NotFound(new { detail = "Modelo não encontrado." });

            if (payload.Name != null) model.Name = payload.Name;
            if (payload.Category != null) model.Category = payload.Category;
            if (payload.Description != null) model.Description = payload.Description;
            if (payload.ModelNumber != null) model.ModelNumber = payload.ModelNumber;
            if (payload.ImageUrl != null) model.ImageUrl = payload.ImageUrl;
            if (payload.TotalStock.HasValue) model.TotalStock = payload.TotalStock.Value;
            if (payload.MaintenanceStock.HasValue) model.MaintenanceStock = payload.MaintenanceStock.Value;

            await db.SaveChangesAsync();
            return Results.Ok(MapModel(model));
        });

        // POST /api/v1/inventory/item-models/{id}/resolve-maintenance
        group.MapPost("/item-models/{id:int}/resolve-maintenance", async (int id, ResolveMaintenanceRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            var model = await db.ItemModels.FirstOrDefaultAsync(m => m.Id == id && m.DeletedAt == null);
            if (model == null) return Results.NotFound(new { detail = "Modelo não encontrado." });

            var repaired = payload.QtyRepaired;
            var discarded = payload.QtyDiscarded;
            model.MaintenanceStock = Math.Max(0, model.MaintenanceStock - repaired - discarded);
            model.TotalStock = Math.Max(0, model.TotalStock - discarded);

            db.InventoryMovements.Add(new InventoryMovement
            {
                ItemModelId = id, Action = "entrada", Quantity = repaired,
                OperatorId = currentUser.Id,
                Target = "Manutenção resolvida",
                Observation = payload.Observation,
                CreatedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Manutenção registrada." });
        });

        // POST /api/v1/inventory/import/preview
        group.MapPost("/import/preview", async (IFormFile file, LabManagerDbContext db) =>
        {
            if (file == null || file.Length == 0)
                return Results.BadRequest(new { detail = "Arquivo não informado." });

            var items = new List<object>();
            var errors = new List<string>();

            using var reader = new System.IO.StreamReader(file.OpenReadStream());
            await reader.ReadLineAsync(); // pula cabeçalho
            int lineNum = 1;
            string? line;

            while ((line = await reader.ReadLineAsync()) != null)
            {
                lineNum++;
                if (string.IsNullOrWhiteSpace(line)) continue;
                var cols = line.Split(',').Select(c => c.Trim()).ToArray();

                if (cols.Length < 3)
                { errors.Add($"Linha {lineNum}: colunas insuficientes."); continue; }

                if (!int.TryParse(cols.Length > 3 ? cols[3] : "1", out var stock))
                { errors.Add($"Linha {lineNum}: estoque inválido."); continue; }

                items.Add(new { name = cols[0], category = cols[1], model_number = cols[2], total_stock = stock });
            }

            return Results.Ok(new { items, errors, total = items.Count });
        }).DisableAntiforgery();

        // POST /api/v1/inventory/import/confirm
        group.MapPost("/import/confirm", async (ImportConfirmRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiRoles.Contains(currentUser.Role)) return Results.Forbid();

            int created = 0, skipped = 0;
            foreach (var item in payload.Items)
            {
                var exists = await db.ItemModels.AnyAsync(m => m.Name == item.Name && m.DeletedAt == null);
                if (exists) { skipped++; continue; }

                db.ItemModels.Add(new ItemModel
                {
                    Name = item.Name, Category = item.Category,
                    ModelNumber = item.ModelNumber, TotalStock = item.TotalStock
                });
                created++;
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { created, skipped });
        });
    }

    private static object MapModel(ItemModel m) => new
    {
        m.Id, m.Name, m.Category, m.Description, m.ModelNumber, m.ImageUrl, m.TotalStock, m.MaintenanceStock, m.DeletedAt
    };

    public class ItemModelRequest
    {
        public string Name { get; set; } = null!;
        public string Category { get; set; } = null!;
        public string? Description { get; set; }
        public string? ModelNumber { get; set; }
        public string? ImageUrl { get; set; }
        public int TotalStock { get; set; }
        public int? MaintenanceStock { get; set; }
    }

    public class ItemModelPatchRequest
    {
        public string? Name { get; set; }
        public string? Category { get; set; }
        public string? Description { get; set; }
        public string? ModelNumber { get; set; }
        public string? ImageUrl { get; set; }
        public int? TotalStock { get; set; }
        public int? MaintenanceStock { get; set; }
    }

    public class ResolveMaintenanceRequest { public int QtyRepaired { get; set; } public int QtyDiscarded { get; set; } public string? Observation { get; set; } }
    public class ImportItem { public string Name { get; set; } = null!; public string Category { get; set; } = null!; public string ModelNumber { get; set; } = null!; public int TotalStock { get; set; } }
    public class ImportConfirmRequest { public List<ImportItem> Items { get; set; } = []; }
}
