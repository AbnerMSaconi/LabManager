using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using LabManager.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

namespace LabManager.API.Controllers
{
    [ApiController]
    [Route("api/v1/auth")]
    public class AuthController : ControllerBase
    {
        private static readonly HashSet<string> ValidRoles =
        [
            "professor", "dti_estagiario", "dti_tecnico",
            "progex", "administrador", "super_admin"
        ];

        private readonly LabManagerDbContext _context;
        private readonly IConfiguration _config;

        public AuthController(LabManagerDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        [HttpPost("sync")]
        [Authorize(AuthenticationSchemes = "Keycloak")]
        public async Task<IActionResult> SyncUser()
        {
            var username = User.FindFirst("preferred_username")?.Value;
            var name = User.FindFirst("name")?.Value ?? "Usuário Sincronizado";

            if (string.IsNullOrEmpty(username))
                return BadRequest(new { detail = "Token inválido: preferred_username não encontrado." });

            // Lê a role do Keycloak via realm_access.roles
            var role = ResolveRoleFromToken();
            if (role == null)
                return BadRequest(new { detail = "Token inválido: nenhuma role válida do sistema encontrada. Verifique as roles atribuídas ao usuário no Keycloak." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.RegistrationNumber == username);

            if (user == null)
            {
                // JIT Provisioning: cria o usuário no primeiro acesso
                user = new User
                {
                    RegistrationNumber = username,
                    FullName = name,
                    Role = role,
                    IsActive = true,
                    HashedPassword = "SSO_EXTERNAL"
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }
            else
            {
                if (!user.IsActive)
                    return Unauthorized(new { detail = "Cadastro inativo no sistema LabManager." });

                // Atualiza role e nome caso tenham mudado no Keycloak
                user.Role = role;
                user.FullName = name;
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                id = user.Id,
                identifier = user.RegistrationNumber,
                full_name = user.FullName,
                role = user.Role,
                is_active = user.IsActive,
                access_token = GeneratePythonCompatibleToken(user.Id)
            });
        }

        /// <summary>
        /// Gera um JWT HS256 compatível com o backend Python (mesma secret e formato de claims).
        /// </summary>
        private string GeneratePythonCompatibleToken(int userId)
        {
            var secret = _config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key não configurado");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expireMinutes = int.TryParse(_config["Jwt:ExpireMinutes"], out var m) ? m : 480;

            var token = new JwtSecurityToken(
                claims: [new Claim("sub", userId.ToString())],
                expires: DateTime.UtcNow.AddMinutes(expireMinutes),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>
        /// Extrai a primeira role válida do sistema a partir de realm_access.roles no token Keycloak.
        /// </summary>
        private string? ResolveRoleFromToken()
        {
            var realmAccessClaim = User.FindFirst("realm_access")?.Value;
            if (string.IsNullOrEmpty(realmAccessClaim)) return null;

            try
            {
                var doc = JsonDocument.Parse(realmAccessClaim);
                if (!doc.RootElement.TryGetProperty("roles", out var rolesEl)) return null;

                foreach (var r in rolesEl.EnumerateArray())
                {
                    var val = r.GetString();
                    if (val != null && ValidRoles.Contains(val))
                        return val;
                }
            }
            catch { /* claim malformado */ }

            return null;
        }
    }
}
