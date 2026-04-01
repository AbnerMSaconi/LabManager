using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class UsersEndpoints
{
    // Esta lista espelha exatamente a variável 'canManage' do seu React
    private static readonly string[] ManageRoles = ["dti_tecnico", "progex", "administrador", "super_admin"];

    public static void MapUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/users").RequireAuthorization();

        // GET /api/v1/users (Removemos o 403 do Técnico)
        group.MapGet("/", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            
            // Trava alinhada com o React
            if (!ManageRoles.Contains(currentUser.Role)) return Results.Forbid();

            var users = await db.Users
                .Select(u => new { u.Id, u.RegistrationNumber, u.FullName, u.Role, u.IsActive, u.CanRequestInventory })
                .OrderBy(u => u.FullName)
                .ToListAsync();

            return Results.Ok(users);
        });

        // POST /api/v1/users
        group.MapPost("/", async (UserCreateRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!ManageRoles.Contains(currentUser.Role)) return Results.Forbid();

            if (await db.Users.AnyAsync(u => u.RegistrationNumber == payload.RegistrationNumber))
                return Results.BadRequest(new { detail = "Matrícula/Usuário já cadastrado no sistema." });

            var newUser = new User
            {
                RegistrationNumber = payload.RegistrationNumber,
                FullName = payload.FullName,
                Role = payload.Role,
                IsActive = true,
                CanRequestInventory = payload.CanRequestInventory ?? false,
                HashedPassword = "SSO_EXTERNAL"
            };

            db.Users.Add(newUser);
            await db.SaveChangesAsync();
            return Results.Json(new { message = "Usuário cadastrado com sucesso.", id = newUser.Id }, statusCode: 201);
        });

        // LÓGICA DE ATUALIZAÇÃO ISOLADA
        var updateHandler = async (int id, UserUpdateRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!ManageRoles.Contains(currentUser.Role)) return Results.Forbid();

            var targetUser = await db.Users.FindAsync(id);
            if (targetUser == null) return Results.NotFound(new { detail = "Usuário não encontrado." });

            if (!string.IsNullOrEmpty(payload.FullName)) targetUser.FullName = payload.FullName;
            if (!string.IsNullOrEmpty(payload.Role)) targetUser.Role = payload.Role;
            if (payload.IsActive.HasValue) targetUser.IsActive = payload.IsActive.Value;
            if (payload.CanRequestInventory.HasValue) targetUser.CanRequestInventory = payload.CanRequestInventory.Value;

            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Usuário atualizado." });
        };

        // MATANDO O ERRO 405: Aceitamos os dois verbos HTTP!
        group.MapPut("/{id:int}", updateHandler);
        group.MapPatch("/{id:int}", updateHandler); 
    }

    public class UserCreateRequest { public string RegistrationNumber { get; set; } = null!; public string FullName { get; set; } = null!; public string Role { get; set; } = null!; public bool? CanRequestInventory { get; set; } }
    public class UserUpdateRequest { public string? FullName { get; set; } public string? Role { get; set; } public bool? IsActive { get; set; } public bool? CanRequestInventory { get; set; } }
}