using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using LabManager.API.Models;

namespace LabManager.API.Endpoints;

public static class AttendanceEndpoints
{
    public static void MapAttendanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/attendance").RequireAuthorization();

        // GET /api/v1/attendance?date=&date_from=&date_to=&weekday=&lab_id=
        group.MapGet("/", async (
            string? date, string? date_from, string? date_to,
            int? weekday, int? lab_id,
            ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiManageRoles.Contains(currentUser.Role)) return Results.Forbid();

            var query = db.Reservations
                .Include(r => r.Slots)
                .Include(r => r.Lab)
                .Include(r => r.User)
                .Include(r => r.TeacherAttendance)
                .Where(r => r.Status != "cancelado" && r.Status != "rejeitado"
                    && r.User.Role == "professor")
                .AsQueryable();

            if (!string.IsNullOrEmpty(date) && DateOnly.TryParse(date, out var d))
                query = query.Where(r => r.Date == d);
            else
            {
                if (!string.IsNullOrEmpty(date_from) && DateOnly.TryParse(date_from, out var df))
                    query = query.Where(r => r.Date >= df);
                if (!string.IsNullOrEmpty(date_to) && DateOnly.TryParse(date_to, out var dt))
                    query = query.Where(r => r.Date <= dt);
            }

            if (weekday.HasValue)
                query = query.Where(r => (int)r.Date.DayOfWeek == weekday.Value);

            if (lab_id.HasValue)
                query = query.Where(r => r.LabId == lab_id.Value);

            var reservations = await query
                .OrderBy(r => r.Date)
                .ThenBy(r => r.User.FullName)
                .ToListAsync();

            // Calcula faltas consecutivas por professor
            var allAbsences = await db.TeacherAttendances
                .Include(a => a.Reservation).ThenInclude(r => r.User)
                .Where(a => a.Status == "falta")
                .OrderByDescending(a => a.Reservation.Date)
                .ToListAsync();

            var rows = reservations.Select(r =>
            {
                var attStatus = r.TeacherAttendance?.Status;

                // Conta faltas consecutivas recentes para o professor
                var professorAbsences = allAbsences
                    .Where(a => a.Reservation.UserId == r.UserId && a.Reservation.Date <= r.Date)
                    .OrderByDescending(a => a.Reservation.Date)
                    .ToList();

                int consecutive = 0;
                DateOnly? lastDate = null;
                foreach (var abs in professorAbsences)
                {
                    if (lastDate == null || abs.Reservation.Date.AddDays(7) >= lastDate)
                    { consecutive++; lastDate = abs.Reservation.Date; }
                    else break;
                }

                return new
                {
                    ReservationId = r.Id,
                    ProfessorId = r.UserId,
                    ProfessorName = r.User.FullName,
                    LabId = r.LabId,
                    LabName = r.Lab == null ? null : r.Lab.Name,
                    Date = r.Date.ToString("yyyy-MM-dd"),
                    Slots = r.Slots.Select(s => new { s.Id, s.Code, s.StartTime, s.EndTime }),
                    AttendanceStatus = attStatus,
                    ConsecutiveAbsences = consecutive,
                    Alert = consecutive >= 3
                };
            });

            return Results.Ok(rows);
        });

        // POST /api/v1/attendance/batch
        group.MapPost("/batch", async (BatchAttendanceRequest payload, ClaimsPrincipal user, LabManagerDbContext db) =>
        {
            var currentUser = await Shared.GetCurrentUserAsync(user, db);
            if (currentUser == null) return Results.Unauthorized();
            if (!Shared.DtiManageRoles.Contains(currentUser.Role)) return Results.Forbid();

            int saved = 0;
            foreach (var record in payload.Records)
            {
                var existing = await db.TeacherAttendances
                    .FirstOrDefaultAsync(a => a.ReservationId == record.ReservationId);

                if (existing != null)
                {
                    existing.Status = record.Status;
                    existing.RegisteredById = currentUser.Id;
                    existing.RegisteredAt = DateTime.UtcNow;
                }
                else
                {
                    db.TeacherAttendances.Add(new TeacherAttendance
                    {
                        ReservationId = record.ReservationId,
                        Status = record.Status,
                        RegisteredById = currentUser.Id,
                        RegisteredAt = DateTime.UtcNow
                    });
                }
                saved++;
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { saved });
        });
    }

    public class AttendanceBatchItem { public int ReservationId { get; set; } public string Status { get; set; } = null!; }
    public class BatchAttendanceRequest { public List<AttendanceBatchItem> Records { get; set; } = []; }
}
