using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LabManager.API.Models;

namespace LabManager.API.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")] // O .NET converte [controller] para "labs" (ignora o sufixo Controller)
    public class LabsController : ControllerBase
    {
        private readonly LabManagerDbContext _context;

        // O .NET injeta o contexto do banco automaticamente aqui
        public LabsController(LabManagerDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetLabs()
        {
            // Substitui a query do SQLAlchemy (db.query(Laboratory).filter(Laboratory.is_active == True).all())
            var labs = await _context.Laboratories
                .Where(l => l.IsActive == true)
                .ToListAsync();

            return Ok(labs); // Retorna HTTP 200 com o JSON
        }
    }
}