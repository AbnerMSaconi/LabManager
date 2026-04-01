using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class AuthEndpoints
{
    // A lista oficial de cargos aceitos pelo LabManager
    private static readonly HashSet<string> ValidRoles =
    [
        "professor", "dti_estagiario", "dti_tecnico",
        "progex", "administrador", "super_admin"
    ];

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth")
                       .RequireAuthorization(new Microsoft.AspNetCore.Authorization.AuthorizeAttribute { AuthenticationSchemes = "Keycloak" });

        group.MapPost("/sync", async (ClaimsPrincipal user, LabManagerDbContext db, IConfiguration config) =>
        {
            var username = user.FindFirst("preferred_username")?.Value;
            var name = user.FindFirst("name")?.Value ?? "Usuário Sincronizado";

            if (string.IsNullOrEmpty(username))
                return Results.BadRequest(new { detail = "Token SSO inválido." });

            // 1. O FILTRO DE TRIAGEM: O usuário tem uma role válida do LabManager cadastrada no Keycloak?
            var role = ResolveRoleFromToken(user);
            
            if (role == null)
            {
                // Se a pessoa logou no Keycloak da instituição mas não tem role do LabManager, barra na porta.
                return Results.Json(new { detail = "Acesso negado. Você não possui um cargo (Role) do laboratório atribuído à sua conta institucional." }, statusCode: 403);
            }

            var dbUser = await db.Users.FirstOrDefaultAsync(u => u.RegistrationNumber == username);

            // 2. O JIT PROVISIONING: A pessoa passou no filtro e não existe no banco local? Cria na hora!
            if (dbUser == null)
            {
                dbUser = new User
                {
                    RegistrationNumber = username,
                    FullName = name,
                    Role = role, // Salva a role validada
                    IsActive = true,
                    HashedPassword = "SSO_EXTERNAL"
                };
                db.Users.Add(dbUser);
                await db.SaveChangesAsync();
            }
            else
            {
                // 3. O BLOQUEIO LOCAL: A pessoa existe, mas foi inativada por um administrador no React?
                if (!dbUser.IsActive) 
                    return Results.Json(new { detail = "Seu cadastro está inativo no LabManager." }, statusCode: 403);

                // 4. A SINCRONIZAÇÃO: Se o nome ou o cargo mudaram lá no Keycloak, nós atualizamos aqui também
                bool changed = false;
                if (dbUser.FullName != name) { dbUser.FullName = name; changed = true; }
                if (dbUser.Role != role) { dbUser.Role = role; changed = true; }
                
                if (changed) await db.SaveChangesAsync();
            }

            // 5. O PASSE LIVRE: Gera o token local com o ID do banco de dados
            return Results.Ok(new
            {
                id = dbUser.Id, 
                identifier = dbUser.RegistrationNumber, 
                full_name = dbUser.FullName,
                role = dbUser.Role,
                is_active = dbUser.IsActive,
                access_token = GenerateLocalToken(dbUser.Id, config)
            });
        });
    }

    private static string GenerateLocalToken(int userId, IConfiguration config)
    {
        var secret = config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key ausente");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expireMinutes = int.TryParse(config["Jwt:ExpireMinutes"], out var m) ? m : 480;

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            claims: [new Claim("sub", userId.ToString())],
            expires: DateTime.UtcNow.AddMinutes(expireMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // Método que inspeciona as entranhas do Token do Keycloak atrás da Role
    private static string? ResolveRoleFromToken(ClaimsPrincipal user)
    {
        var realmAccess = user.FindFirst("realm_access")?.Value;
        if (string.IsNullOrEmpty(realmAccess)) return null;

        try
        {
            var doc = JsonDocument.Parse(realmAccess);
            if (!doc.RootElement.TryGetProperty("roles", out var rolesEl)) return null;

            foreach (var r in rolesEl.EnumerateArray())
            {
                var val = r.GetString();
                if (val != null && ValidRoles.Contains(val)) return val;
            }
        }
        catch { /* claim malformado */ }
        return null;
    }
}