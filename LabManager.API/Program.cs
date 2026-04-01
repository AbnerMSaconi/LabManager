using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using LabManager.API.Models;
using LabManager.API.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHealthChecks();
builder.Services.AddAuthorization();

// Snake_case para todas as respostas JSON (Minimal APIs e Controllers)
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);
builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(o =>
    o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);

// CORS — permite qualquer origem em desenvolvimento
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});
// 1. INJEÇÃO DO BANCO DE DADOS
builder.Services.AddDbContext<LabManagerDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. CONFIGURAÇÃO DE AUTENTICAÇÃO JWT
// Esquema padrão ("Bearer") = JWT local, usado para simulação/testes
// Esquema "Keycloak" = tokens reais do SSO institucional
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing");
var keyBytes = Encoding.ASCII.GetBytes(jwtKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    // JWT local — simula tokens que virão do Keycloak durante o desenvolvimento
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = false,
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
})
.AddJwtBearer("Keycloak", options =>
{
    options.Authority = builder.Configuration["Keycloak:Authority"] ?? "http://localhost:8080/realms/ucdb";
    options.MetadataAddress = builder.Configuration["Keycloak:MetadataAddress"] ?? "http://localhost:8080/realms/ucdb/.well-known/openid-configuration";
    options.RequireHttpsMetadata = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Keycloak:Authority"] ?? "http://localhost:8080/realms/ucdb",
        
        // ⬇️ MUDANÇA AQUI: Desligue a validação de audiência
        ValidateAudience = false, 
        
        ValidateLifetime = true
    };
});

// 3. CONFIGURAÇÃO DO SWAGGER COM SUPORTE A TOKEN JWT
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "LabManager API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Insira o token JWT desta forma: Bearer {seu token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer", doc),
            new List<string>()
        }
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");
app.MapLabsEndpoints();
app.MapReservationsEndpoints();
app.MapInventoryEndpoints();
app.MapLogisticsEndpoints();
app.MapUsersEndpoints();
app.MapMaintenanceEndpoints();
app.MapAdminEndpoints();
app.MapAttendanceEndpoints();
app.MapSseEndpoints();

app.Run();
