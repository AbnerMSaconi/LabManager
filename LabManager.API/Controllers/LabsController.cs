using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LabManager.API.Models;
using Microsoft.AspNetCore.Authorization; // 1. Adicione este using

namespace LabManager.API.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")] 
    [Authorize(AuthenticationSchemes = "Keycloak")] // 2. Blinde o controller inteiro aqui
    public class LabsController : ControllerBase
    {
        private readonly LabManagerDbContext _context;

        public LabsController(LabManagerDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetLabs()
        {
            var labs = await _context.Laboratories
                .Where(l => l.IsActive == true)
                .ToListAsync();

            return Ok(labs); 
        }
    }
}