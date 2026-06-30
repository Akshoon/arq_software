import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { container } from './config/index.js';
import { createExpressRouter } from './adapters/primary/web/expressRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración básica
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Asegurar directorio temporal de uploads
if (!fs.existsSync('uploads_node/')) {
  fs.mkdirSync('uploads_node/');
}

// Inicializar el Contenedor de Arquitectura Hexagonal y arrancar servidor
async function startServer() {
  try {
    await container.init();
    const processorService = container.getBibliographyProcessor();
    
    // Conectar el adaptador primario web (Express) al servicio del núcleo
    app.use('/', createExpressRouter(processorService));

    app.listen(PORT, () => {
      console.log(`\n=============================================================`);
      console.log(`🚀 [Node.js + Arquitectura Hexagonal] Servidor iniciado con éxito`);
      console.log(`🌐 Accede a la Web App moderna: http://localhost:${PORT}`);
      console.log(`=============================================================\n`);
    });
  } catch (err) {
    console.error('❌ Error iniciando servidor Hexagonal:', err);
    process.exit(1);
  }
}

startServer();
