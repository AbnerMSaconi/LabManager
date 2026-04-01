using System.Text;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using LabManager.API.Models;
using Microsoft.EntityFrameworkCore;

namespace LabManager.API.Endpoints;

public static class SseEndpoints
{
    public static void MapSseEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /api/v1/events?token=<jwt>
        // Endpoint SSE — token via query string (EventSource não suporta headers)
        app.MapGet("/api/v1/events", async (
            string? token,
            IConfiguration config,
            LabManagerDbContext db,
            HttpContext ctx,
            CancellationToken ct) =>
        {
            // Valida o token manualmente (vem como query param, não como header)
            if (string.IsNullOrEmpty(token))
            {
                ctx.Response.StatusCode = 401;
                return;
            }

            var userId = ValidateToken(token, config);
            if (userId == null)
            {
                ctx.Response.StatusCode = 401;
                return;
            }

            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);
            if (user == null)
            {
                ctx.Response.StatusCode = 401;
                return;
            }

            // Configura headers SSE
            ctx.Response.Headers.ContentType = "text/event-stream";
            ctx.Response.Headers.CacheControl = "no-cache";
            ctx.Response.Headers.Connection = "keep-alive";
            ctx.Response.Headers["X-Accel-Buffering"] = "no";

            await ctx.Response.Body.FlushAsync(ct);

            // Envia evento de conexão estabelecida
            await WriteEventAsync(ctx, """{"type":"connected"}""", ct);

            // Mantém a conexão viva com keepalives a cada 30s
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    await Task.Delay(TimeSpan.FromSeconds(30), ct);
                    await WriteKeepAliveAsync(ctx, ct);
                }
            }
            catch (OperationCanceledException)
            {
                // Cliente desconectou — encerra normalmente
            }
        });
    }

    private static async Task WriteEventAsync(HttpContext ctx, string jsonData, CancellationToken ct)
    {
        var bytes = Encoding.UTF8.GetBytes($"data: {jsonData}\n\n");
        await ctx.Response.Body.WriteAsync(bytes, ct);
        await ctx.Response.Body.FlushAsync(ct);
    }

    private static async Task WriteKeepAliveAsync(HttpContext ctx, CancellationToken ct)
    {
        var bytes = Encoding.UTF8.GetBytes(": keepalive\n\n");
        await ctx.Response.Body.WriteAsync(bytes, ct);
        await ctx.Response.Body.FlushAsync(ct);
    }

    private static int? ValidateToken(string token, IConfiguration config)
    {
        try
        {
            var key = config["Jwt:Key"] ?? throw new InvalidOperationException();
            var issuer = config["Jwt:Issuer"];
            var keyBytes = Encoding.ASCII.GetBytes(key);

            var handler = new JwtSecurityTokenHandler();
            var result = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = false,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out _);

            var sub = result.FindFirst("sub")?.Value;
            return int.TryParse(sub, out var id) ? id : null;
        }
        catch
        {
            return null;
        }
    }
}
