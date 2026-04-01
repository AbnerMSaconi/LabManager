using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace LabManager.API.Models;

public partial class LabManagerDbContext : DbContext
{
    public LabManagerDbContext()
    {
    }

    public LabManagerDbContext(DbContextOptions<LabManagerDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AlembicVersion> AlembicVersions { get; set; }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<Hardware> Hardwares { get; set; }

    public virtual DbSet<InstitutionLoan> InstitutionLoans { get; set; }

    public virtual DbSet<InventoryMovement> InventoryMovements { get; set; }

    public virtual DbSet<ItemModel> ItemModels { get; set; }

    public virtual DbSet<Laboratory> Laboratories { get; set; }

    public virtual DbSet<LessonSlot> LessonSlots { get; set; }

    public virtual DbSet<MaintenanceTicket> MaintenanceTickets { get; set; }

    public virtual DbSet<PhysicalItem> PhysicalItems { get; set; }

    public virtual DbSet<Reservation> Reservations { get; set; }

    public virtual DbSet<ReservationItem> ReservationItems { get; set; }

    public virtual DbSet<Software> Softwares { get; set; }

    public virtual DbSet<SystemBackup> SystemBackups { get; set; }

    public virtual DbSet<TeacherAttendance> TeacherAttendances { get; set; }

    public virtual DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AlembicVersion>(entity =>
        {
            entity.HasKey(e => e.VersionNum).HasName("alembic_version_pkc");

            entity.ToTable("alembic_version");

            entity.Property(e => e.VersionNum)
                .HasMaxLength(32)
                .IsUnicode(false)
                .HasColumnName("version_num");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__audit_lo__3213E83F64A0FE24");

            entity.ToTable("audit_logs");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.NewData)
                .IsUnicode(false)
                .HasColumnName("new_data");
            entity.Property(e => e.OldData)
                .IsUnicode(false)
                .HasColumnName("old_data");
            entity.Property(e => e.RecordId).HasColumnName("record_id");
            entity.Property(e => e.TableName)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("table_name");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__audit_log__user___01142BA1");
        });

        modelBuilder.Entity<Hardware>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__hardware__3213E83F345122B1");

            entity.ToTable("hardwares");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("name");
            entity.Property(e => e.Specifications)
                .IsUnicode(false)
                .HasColumnName("specifications");
        });

        modelBuilder.Entity<InstitutionLoan>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__institut__3213E83F9C599750");

            entity.ToTable("institution_loans");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedById).HasColumnName("created_by_id");
            entity.Property(e => e.DamageObservation)
                .IsUnicode(false)
                .HasColumnName("damage_observation");
            entity.Property(e => e.IsOperational).HasColumnName("is_operational");
            entity.Property(e => e.ItemModelId).HasColumnName("item_model_id");
            entity.Property(e => e.NoReturnReason)
                .IsUnicode(false)
                .HasColumnName("no_return_reason");
            entity.Property(e => e.QuantityDelivered).HasColumnName("quantity_delivered");
            entity.Property(e => e.QuantityReturned)
                .HasDefaultValueSql("('0')")
                .HasColumnName("quantity_returned");
            entity.Property(e => e.RequesterName)
                .HasMaxLength(255)
                .IsUnicode(false)
                .HasColumnName("requester_name");
            entity.Property(e => e.ReturnDate).HasColumnName("return_date");
            entity.Property(e => e.ReturnedAt)
                .HasColumnType("datetime")
                .HasColumnName("returned_at");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasDefaultValue("em_aberto")
                .HasColumnName("status");

            entity.HasOne(d => d.CreatedBy).WithMany(p => p.InstitutionLoans)
                .HasForeignKey(d => d.CreatedById)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__instituti__creat__75A278F5");

            entity.HasOne(d => d.ItemModel).WithMany(p => p.InstitutionLoans)
                .HasForeignKey(d => d.ItemModelId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__instituti__item___74AE54BC");
        });

        modelBuilder.Entity<InventoryMovement>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__inventor__3213E83FA7C8CADE");

            entity.ToTable("inventory_movements");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Action)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("action");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.ItemModelId).HasColumnName("item_model_id");
            entity.Property(e => e.LoanId).HasColumnName("loan_id");
            entity.Property(e => e.Observation)
                .IsUnicode(false)
                .HasColumnName("observation");
            entity.Property(e => e.OperatorId).HasColumnName("operator_id");
            entity.Property(e => e.Quantity).HasColumnName("quantity");
            entity.Property(e => e.ReservationId).HasColumnName("reservation_id");
            entity.Property(e => e.Target)
                .HasMaxLength(255)
                .IsUnicode(false)
                .HasColumnName("target");

            entity.HasOne(d => d.ItemModel).WithMany(p => p.InventoryMovements)
                .HasForeignKey(d => d.ItemModelId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__inventory__item___797309D9");

            entity.HasOne(d => d.Loan).WithMany(p => p.InventoryMovements)
                .HasForeignKey(d => d.LoanId)
                .HasConstraintName("FK__inventory__loan___7C4F7684");

            entity.HasOne(d => d.Operator).WithMany(p => p.InventoryMovements)
                .HasForeignKey(d => d.OperatorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__inventory__opera__7A672E12");

            entity.HasOne(d => d.Reservation).WithMany(p => p.InventoryMovements)
                .HasForeignKey(d => d.ReservationId)
                .HasConstraintName("FK__inventory__reser__7B5B524B");
        });

        modelBuilder.Entity<ItemModel>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__item_mod__3213E83F86F13842");

            entity.ToTable("item_models");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Category)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("category");
            entity.Property(e => e.DeletedAt)
                .HasColumnType("datetime")
                .HasColumnName("deleted_at");
            entity.Property(e => e.Description)
                .IsUnicode(false)
                .HasColumnName("description");
            entity.Property(e => e.ImageUrl)
                .HasMaxLength(512)
                .IsUnicode(false)
                .HasColumnName("image_url");
            entity.Property(e => e.MaintenanceStock)
                .HasDefaultValueSql("('0')")
                .HasColumnName("maintenance_stock");
            entity.Property(e => e.ModelNumber)
                .HasMaxLength(100)
                .HasColumnName("model_number");
            entity.Property(e => e.Name)
                .HasMaxLength(255)
                .IsUnicode(false)
                .HasColumnName("name");
            entity.Property(e => e.TotalStock)
                .HasDefaultValueSql("('0')")
                .HasColumnName("total_stock");
        });

        modelBuilder.Entity<Laboratory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__laborato__3213E83F30946E80");

            entity.ToTable("laboratories");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Block)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("block");
            entity.Property(e => e.Capacity).HasColumnName("capacity");
            entity.Property(e => e.DeletedAt)
                .HasColumnType("datetime")
                .HasColumnName("deleted_at");
            entity.Property(e => e.Description)
                .IsUnicode(false)
                .HasColumnName("description");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.IsPractical).HasColumnName("is_practical");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("name");
            entity.Property(e => e.RoomNumber)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("room_number");

            entity.HasMany(d => d.Hardwares).WithMany(p => p.Labs)
                .UsingEntity<Dictionary<string, object>>(
                    "LabHardware",
                    r => r.HasOne<Hardware>().WithMany()
                        .HasForeignKey("HardwareId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__lab_hardw__hardw__4CA06362"),
                    l => l.HasOne<Laboratory>().WithMany()
                        .HasForeignKey("LabId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__lab_hardw__lab_i__4BAC3F29"),
                    j =>
                    {
                        j.HasKey("LabId", "HardwareId").HasName("PK__lab_hard__EF4F5D9C05AB7234");
                        j.ToTable("lab_hardwares");
                        j.IndexerProperty<int>("LabId").HasColumnName("lab_id");
                        j.IndexerProperty<int>("HardwareId").HasColumnName("hardware_id");
                    });

            entity.HasMany(d => d.Softwares).WithMany(p => p.Labs)
                .UsingEntity<Dictionary<string, object>>(
                    "LabSoftware",
                    r => r.HasOne<Software>().WithMany()
                        .HasForeignKey("SoftwareId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__lab_softw__softw__46E78A0C"),
                    l => l.HasOne<Laboratory>().WithMany()
                        .HasForeignKey("LabId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__lab_softw__lab_i__45F365D3"),
                    j =>
                    {
                        j.HasKey("LabId", "SoftwareId").HasName("PK__lab_soft__1A322CF73BD39A69");
                        j.ToTable("lab_softwares");
                        j.IndexerProperty<int>("LabId").HasColumnName("lab_id");
                        j.IndexerProperty<int>("SoftwareId").HasColumnName("software_id");
                    });
        });

        modelBuilder.Entity<LessonSlot>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__lesson_s__3213E83FC5C0AADC");

            entity.ToTable("lesson_slots");

            entity.HasIndex(e => e.Code, "UQ__lesson_s__357D4CF90E8E9C87").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Code)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("code");
            entity.Property(e => e.EndTime)
                .HasMaxLength(5)
                .IsUnicode(false)
                .HasColumnName("end_time");
            entity.Property(e => e.StartTime)
                .HasMaxLength(5)
                .IsUnicode(false)
                .HasColumnName("start_time");
        });

        modelBuilder.Entity<MaintenanceTicket>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__maintena__3213E83F044437DF");

            entity.ToTable("maintenance_tickets");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.Description)
                .IsUnicode(false)
                .HasColumnName("description");
            entity.Property(e => e.LabId).HasColumnName("lab_id");
            entity.Property(e => e.OpenedById).HasColumnName("opened_by_id");
            entity.Property(e => e.PhysicalItemId).HasColumnName("physical_item_id");
            entity.Property(e => e.ResolutionNotes)
                .IsUnicode(false)
                .HasColumnName("resolution_notes");
            entity.Property(e => e.ResolvedAt)
                .HasColumnType("datetime")
                .HasColumnName("resolved_at");
            entity.Property(e => e.ResolvedById).HasColumnName("resolved_by_id");
            entity.Property(e => e.Severity)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("medio")
                .HasColumnName("severity");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasDefaultValue("aberto")
                .HasColumnName("status");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("title");

            entity.HasOne(d => d.Lab).WithMany(p => p.MaintenanceTickets)
                .HasForeignKey(d => d.LabId)
                .HasConstraintName("FK__maintenan__lab_i__6C190EBB");

            entity.HasOne(d => d.OpenedBy).WithMany(p => p.MaintenanceTicketOpenedBies)
                .HasForeignKey(d => d.OpenedById)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__maintenan__opene__6E01572D");

            entity.HasOne(d => d.PhysicalItem).WithMany(p => p.MaintenanceTickets)
                .HasForeignKey(d => d.PhysicalItemId)
                .HasConstraintName("FK__maintenan__physi__6D0D32F4");

            entity.HasOne(d => d.ResolvedBy).WithMany(p => p.MaintenanceTicketResolvedBies)
                .HasForeignKey(d => d.ResolvedById)
                .HasConstraintName("FK__maintenan__resol__6EF57B66");
        });

        modelBuilder.Entity<PhysicalItem>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__physical__3213E83F27B67328");

            entity.ToTable("physical_items");

            entity.HasIndex(e => e.PatrimonyId, "ix_physical_items_patrimony_id").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CurrentLabId).HasColumnName("current_lab_id");
            entity.Property(e => e.ModelId).HasColumnName("model_id");
            entity.Property(e => e.PatrimonyId)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("patrimony_id");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasDefaultValue("disponivel")
                .HasColumnName("status");

            entity.HasOne(d => d.CurrentLab).WithMany(p => p.PhysicalItems)
                .HasForeignKey(d => d.CurrentLabId)
                .HasConstraintName("FK__physical___curre__5441852A");

            entity.HasOne(d => d.Model).WithMany(p => p.PhysicalItems)
                .HasForeignKey(d => d.ModelId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__physical___model__534D60F1");
        });

        modelBuilder.Entity<Reservation>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__reservat__3213E83F0012D839");

            entity.ToTable("reservations");

            entity.HasIndex(e => e.GroupId, "ix_reservations_group_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ApprovalNotes)
                .IsUnicode(false)
                .HasColumnName("approval_notes");
            entity.Property(e => e.ApprovedById).HasColumnName("approved_by_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.Date).HasColumnName("date");
            entity.Property(e => e.GroupId)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("group_id");
            entity.Property(e => e.LabId).HasColumnName("lab_id");
            entity.Property(e => e.RejectionReason)
                .IsUnicode(false)
                .HasColumnName("rejection_reason");
            entity.Property(e => e.RequestedSoftwares)
                .IsUnicode(false)
                .HasColumnName("requested_softwares");
            entity.Property(e => e.SoftwareInstallationRequired).HasColumnName("software_installation_required");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasDefaultValue("pendente")
                .HasColumnName("status");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.ApprovedBy).WithMany(p => p.ReservationApprovedBies)
                .HasForeignKey(d => d.ApprovedById)
                .HasConstraintName("FK__reservati__appro__5BE2A6F2");

            entity.HasOne(d => d.Lab).WithMany(p => p.Reservations)
                .HasForeignKey(d => d.LabId)
                .HasConstraintName("FK__reservati__lab_i__5AEE82B9");

            entity.HasOne(d => d.User).WithMany(p => p.ReservationUsers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__reservati__user___59FA5E80");

            entity.HasMany(d => d.Slots).WithMany(p => p.Reservations)
                .UsingEntity<Dictionary<string, object>>(
                    "ReservationSlot",
                    r => r.HasOne<LessonSlot>().WithMany()
                        .HasForeignKey("SlotId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__reservati__slot___5FB337D6"),
                    l => l.HasOne<Reservation>().WithMany()
                        .HasForeignKey("ReservationId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__reservati__reser__5EBF139D"),
                    j =>
                    {
                        j.HasKey("ReservationId", "SlotId").HasName("PK__reservat__9849EC3232F68E77");
                        j.ToTable("reservation_slots");
                        j.IndexerProperty<int>("ReservationId").HasColumnName("reservation_id");
                        j.IndexerProperty<int>("SlotId").HasColumnName("slot_id");
                    });
        });

        modelBuilder.Entity<ReservationItem>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__reservat__3213E83FA0E9D979");

            entity.ToTable("reservation_items");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.DamageObservation)
                .IsUnicode(false)
                .HasColumnName("damage_observation");
            entity.Property(e => e.ItemModelId).HasColumnName("item_model_id");
            entity.Property(e => e.PhysicalItemId).HasColumnName("physical_item_id");
            entity.Property(e => e.QuantityRequested)
                .HasDefaultValueSql("('1')")
                .HasColumnName("quantity_requested");
            entity.Property(e => e.QuantityReturned)
                .HasDefaultValueSql("('0')")
                .HasColumnName("quantity_returned");
            entity.Property(e => e.ReservationId).HasColumnName("reservation_id");
            entity.Property(e => e.ReturnStatus)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("return_status");

            entity.HasOne(d => d.ItemModel).WithMany(p => p.ReservationItems)
                .HasForeignKey(d => d.ItemModelId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__reservati__item___656C112C");

            entity.HasOne(d => d.PhysicalItem).WithMany(p => p.ReservationItems)
                .HasForeignKey(d => d.PhysicalItemId)
                .HasConstraintName("FK__reservati__physi__66603565");

            entity.HasOne(d => d.Reservation).WithMany(p => p.ReservationItems)
                .HasForeignKey(d => d.ReservationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__reservati__reser__6477ECF3");
        });

        modelBuilder.Entity<Software>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__software__3213E83F18597EC0");

            entity.ToTable("softwares");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.DeletedAt)
                .HasColumnType("datetime")
                .HasColumnName("deleted_at");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("name");
            entity.Property(e => e.Version)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("version");
        });

        modelBuilder.Entity<SystemBackup>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__system_b__3213E83FF743C823");

            entity.ToTable("system_backups");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.Filename)
                .HasMaxLength(255)
                .IsUnicode(false)
                .HasColumnName("filename");
            entity.Property(e => e.SizeMb).HasColumnName("size_mb");
            entity.Property(e => e.TriggeredById).HasColumnName("triggered_by_id");

            entity.HasOne(d => d.TriggeredBy).WithMany(p => p.SystemBackups)
                .HasForeignKey(d => d.TriggeredById)
                .HasConstraintName("FK__system_ba__trigg__04E4BC85");
        });

        modelBuilder.Entity<TeacherAttendance>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__teacher___3213E83F2E60CEAE");

            entity.ToTable("teacher_attendances");

            entity.HasIndex(e => e.ReservationId, "UQ__teacher___31384C28054C152B").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.RegisteredAt)
                .HasColumnType("datetime")
                .HasColumnName("registered_at");
            entity.Property(e => e.RegisteredById).HasColumnName("registered_by_id");
            entity.Property(e => e.ReservationId).HasColumnName("reservation_id");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("status");

            entity.HasOne(d => d.RegisteredBy).WithMany(p => p.TeacherAttendances)
                .HasForeignKey(d => d.RegisteredById)
                .HasConstraintName("FK__teacher_a__regis__09A971A2");

            entity.HasOne(d => d.Reservation).WithOne(p => p.TeacherAttendance)
                .HasForeignKey<TeacherAttendance>(d => d.ReservationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__teacher_a__reser__08B54D69");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__users__3213E83FD1A7E2D9");

            entity.ToTable("users");

            entity.HasIndex(e => e.RegistrationNumber, "ix_users_registration_number").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.DeletedAt)
                .HasColumnType("datetime")
                .HasColumnName("deleted_at");
            entity.Property(e => e.FullName)
                .HasMaxLength(255)
                .IsUnicode(false)
                .HasColumnName("full_name");
            entity.Property(e => e.HashedPassword)
                .HasMaxLength(255)
                .IsUnicode(false)
                .HasColumnName("hashed_password");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.RegistrationNumber)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("registration_number");
            entity.Property(e => e.Role)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasDefaultValue("professor")
                .HasColumnName("role");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
