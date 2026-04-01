using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

internal static class Shared
{
    internal static readonly string[] AdminRoles = ["administrador", "super_admin"];
    internal static readonly string[] DtiManageRoles = ["dti_tecnico", "administrador", "super_admin"];
    internal static readonly string[] DtiRoles = ["dti_estagiario", "dti_tecnico", "administrador", "super_admin"];
    internal static readonly string[] ReviewerRoles = ["dti_tecnico", "progex", "administrador", "super_admin"];

    internal static async Task<User?> GetCurrentUserAsync(ClaimsPrincipal user, LabManagerDbContext db)
    {
        var userId = user.FindFirst("sub")?.Value;
        if (userId == null || !int.TryParse(userId, out var id)) return null;
        return await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.IsActive);
    }

    internal static object MapReservation(Reservation r) => new
    {
        r.Id,
        r.UserId,
        r.LabId,
        Date = r.Date.ToString("yyyy-MM-dd"),
        r.Status,
        r.RequestedSoftwares,
        r.SoftwareInstallationRequired,
        r.ApprovalNotes,
        r.RejectionReason,
        CreatedAt = r.CreatedAt,
        r.GroupId,
        Slots = r.Slots.Select(s => new { s.Id, s.Code, s.StartTime, s.EndTime }),
        Items = r.ReservationItems.Select(i => new
        {
            i.Id, i.ReservationId, i.ItemModelId, i.QuantityRequested, i.QuantityReturned,
            i.ReturnStatus, i.DamageObservation,
            Model = i.ItemModel == null ? null : (object)new { i.ItemModel.Id, i.ItemModel.Name, i.ItemModel.Category }
        }),
        User = r.User == null ? null : (object)new
        {
            r.User.Id,
            r.User.FullName,
            r.User.Role,
            RegistrationNumber = r.User.RegistrationNumber
        },
        Laboratory = r.Lab == null ? null : (object)new { r.Lab.Id, r.Lab.Name, r.Lab.Block, r.Lab.RoomNumber }
    };
}
