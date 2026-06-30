import fs from 'fs';
import path from 'path';
import { container } from './config/index.js';

/**
 * Adaptador Primario CLI (Línea de Comandos)
 * Consume el puerto de entrada BibliographyProcessorPort exactamente igual que la Web App.
 */
async function runCLI() {
  console.log(`\n=============================================================`);
  console.log(`💻 [CLI Hexagonal] Procesador de Bibliografía Académica Node.js`);
  console.log(`=============================================================\n`);

  try {
    await container.init();
    const processorService = container.getBibliographyProcessor();

    const targetDir = process.argv[2] || './archivos';

    if (!fs.existsSync(targetDir)) {
      console.log(`⚠ El directorio '${targetDir}' no existe. Creándolo para futuras ejecuciones...`);
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`Coloca tus archivos .pdf o .docx en '${targetDir}' y vuelve a ejecutar: npm run cli`);
      return;
    }

    const files = fs.readdirSync(targetDir)
      .filter(f => f.endsWith('.pdf') || f.endsWith('.docx') || f.endsWith('.doc') || f.endsWith('.txt'))
      .map(f => ({
        filePath: path.join(targetDir, f),
        originalName: f
      }));

    if (files.length === 0) {
      console.log(`ℹ No se encontraron archivos .pdf o .docx en '${targetDir}'.`);
      return;
    }

    console.log(`Procesando ${files.length} archivo(s) en '${targetDir}'...\n`);
    const results = await processorService.processFiles(files, 'Ciencias Sociales', 'Trabajo Social');

    console.log(`\n--- Resumen del Procesamiento ---`);
    results.forEach(r => {
      console.log(`  [${r.status}] ${r.file} -> ${r.entries || 0} referencias procesadas`);
    });

    const rows = await processorService.getConsolidatedReport();
    console.log(`\n✓ Total de registros en Base de Datos Hexagonal: ${rows.length}`);
    console.log(`Para exportar a CSV o gestionar datos, puedes iniciar el servidor con: npm start\n`);
  } catch (err) {
    console.error('❌ Error en ejecución CLI:', err);
  }
}

runCLI();
