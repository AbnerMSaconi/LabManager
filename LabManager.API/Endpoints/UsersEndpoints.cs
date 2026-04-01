using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class UsersEndpoints
{
    public static void MapUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/users").RequireAuthorization();

        // GET /api/v1/users
        group.MapGet("/", async (ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var users = await db.Users
                .Where(u => u.DeletedAt == null)
                .OrderBy(u => u.FullName)
                .ToListAsync();

            return Results.Ok(users.Select(MapUser));
        });

        // POST /api/v1/users
        group.MapPost("/", async (CreateUserRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var exists = await db.Users.AnyAsync(u => u.RegistrationNumber == payload.RegistrationNumber);
            if (exists)
                return Results.Conflict(new { detail = "Usuário com este número de registro já existe." });

            var newUser = new User
            {
                RegistrationNumber = payload.RegistrationNumber,
                FullName = payload.FullName,
                HashedPassword = BCrypt.Net.BCrypt.HashPassword(payload.Password),
                Role = payload.Role,
                IsActive = true
            };
            db.Users.Add(newUser);
            await db.SaveChangesAsync();
            return Results.Json(new { id = newUser.Id, message = "Usuário criado." }, statusCode: 201);
        });

        // PATCH /api/v1/users/{id}
        group.MapPatch("/{id:int}", async (int id, UpdateUserRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.AdminRoles.Contains(currentUser.Role)) return Results.Forbid();

            var target = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.DeletedAt == null);
            if (target == null) return Results.NotFound(new { detail = "Usuário não encontrado." });

            if (payload.FullName != null) target.FullName = payload.FullName;
            if (payload.Role != null) target.Role = payload.Role;
            if (payload.IsActive.HasValue) target.IsActive = payload.IsActive.Value;
            if (!string.IsNullOrEmpty(payload.Password))
                target.HashedPassword = BCrypt.Net.BCrypt.HashPassword(payload.Password);

            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Usuário atualizado." });
        });
    }

    private static object MapUser(User u) => new
    {
        u.Id,
        RegistrationNumber = u.RegistrationNumber,
        u.FullName,
        u.Role,
        u.IsActive
    };

    public class CreateUserRequest
    {
        public string RegistrationNumber { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string Role { get; set; } = null!;
    }

    public class UpdateUserRequest
    {
        public string? FullName { get; set; }
        public string? Role { get; set; }
        public bool? IsActive { get; set; }
        public string? Password { get; set; }
    }
}
