import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createProxyMiddleware } from 'http-proxy-middleware';

export enum UserRole {
  PROFESSOR = "professor",
  DTI_ESTAGIARIO = "dti_estagiario",
  DTI_TECNICO = "dti_tecnico",
  PROGEX = "progex",
}

export enum ReservationStatus {
  PENDENTE = "pendente",
  APROVADO = "aprovado",
  REJEITADO = "rejeitado",
  EM_USO = "em_uso",
  CONCLUIDO = "concluido",
  CANCELADO = "cancelado",
  AGUARDANDO_SOFTWARE = "aguardando_software",
}

export enum ItemStatus {
  DISPONIVEL = "disponivel",
  MANUTENCAO = "manutencao",
  EM_USO = "em_uso",
  BAIXADO = "baixado",
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Proxy para o Keycloak — evita CORS entre portas diferentes no Chrome
app.use('/keycloak', createProxyMiddleware({
  target: 'http://localhost:8080',
  changeOrigin: true,
  pathRewrite: { '^/keycloak': '' },
}));

// Proxy específico para o backend C# (auth/sync via Keycloak) — deve vir ANTES do proxy geral
app.use('/api/v1/auth/sync', createProxyMiddleware({
  target: 'http://localhost:5165',
  changeOrigin: true,
}));

// Proxy geral para o backend Python (FastAPI)
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true,
}));

// --- VITE MIDDLEWARE ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger docs: http://localhost:${PORT}/api/docs`);
  });
}

startServer();
