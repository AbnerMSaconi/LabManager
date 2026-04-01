using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using LabManager.API.Models;
using LabManager.API.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// 1. BLINDAGEM DO PADRÃO JWT (Garante que "sub" permaneça "sub")
System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

// 2. SERVIÇOS NATIVOS
builder.Services.AddHealthChecks();
builder.Services.AddAuthorization(options =>
{
    // Política Global: Aceita token Local ou do Keycloak indiscriminadamente
    options.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder(
        JwtBearerDefaults.AuthenticationScheme, "Keycloak")
        .RequireAuthenticatedUser()
        .Build();
});

// Padronização Snake_case para respostas JSON (Minimal APIs)
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

// 3. BANCO DE DADOS
builder.Services.AddDbContext<LabManagerDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 4. AUTENTICAÇÃO DUPLA
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options => // LOCAL (Geração interna)
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
        ValidateIssuer = false, ValidateAudience = false, ValidateLifetime = true, ClockSkew = TimeSpan.Zero
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var token = context.Request.Query["token"];
            if (!string.IsNullOrEmpty(token) && context.Request.Path.StartsWithSegments("/api/v1/events"))
                context.Token = token;
            return Task.CompletedTask;
        }
    };
})
.AddJwtBearer("Keycloak", options => // EXTERNO (SSO)
{
    options.Authority = builder.Configuration["Keycloak:Authority"] ?? "http://localhost:8080/realms/ucdb";
    options.MetadataAddress = builder.Configuration["Keycloak:MetadataAddress"] ?? "http://localhost:8080/realms/ucdb/.well-known/openid-configuration";
    options.RequireHttpsMetadata = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true, ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Keycloak:Authority"] ?? "http://localhost:8080/realms/ucdb",
        ValidateAudience = false, ValidateLifetime = true
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var token = context.Request.Query["token"];
            if (!string.IsNullOrEmpty(token) && context.Request.Path.StartsWithSegments("/api/v1/events"))
                context.Token = token;
            return Task.CompletedTask;
        }
    };
});

// 5. SWAGGER
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.OpenApiInfo { Title = "LabManager Minimal API", Version = "v1" });
});

var app = builder.Build();

// =========================================================================
// PIPELINE DE EXECUÇÃO
// =========================================================================

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// =========================================================================
// MAPEAMENTO DAS MINIMAL APIs
// =========================================================================
app.MapHealthChecks("/health");

app.MapAuthEndpoints();
app.MapLabsEndpoints();
app.MapReservationsEndpoints();
app.MapSseEndpoints();
app.MapInventoryEndpoints();
app.MapLogisticsEndpoints();
app.MapUsersEndpoints();
app.MapMaintenanceEndpoints();
app.MapAdminEndpoints();
app.MapAttendanceEndpoints();

app.Run();