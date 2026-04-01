using System.Text;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class SseEndpoints
{
    public static void MapSseEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/events", async (
            ClaimsPrincipal user,
            LabManagerDbContext db,
            HttpContext ctx,
            CancellationToken ct) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null)
            {
                ctx.Response.StatusCode = 401;
                return;
            }

            ctx.Response.Headers.ContentType = "text/event-stream";
            ctx.Response.Headers.CacheControl = "no-cache";
            ctx.Response.Headers.Connection = "keep-alive";
            ctx.Response.Headers["X-Accel-Buffering"] = "no";

            await ctx.Response.Body.FlushAsync(ct);
            await WriteEventAsync(ctx, """{"type":"connected"}""", ct);

            try
            {
                while (!ct.IsCancellationRequested)
                {
                    await Task.Delay(TimeSpan.FromSeconds(30), ct);
                    await WriteKeepAliveAsync(ctx, ct);
                }
            }
            catch (OperationCanceledException) {}
            
        }).RequireAuthorization(); // Protegido pelas regras globais nativas!
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
}