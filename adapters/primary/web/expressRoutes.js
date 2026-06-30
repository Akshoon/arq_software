import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads_node')) {
      fs.mkdirSync('uploads_node', { recursive: true });
    }
    cb(null, 'uploads_node/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});
const upload = multer({ storage });

export function createExpressRouter(processorService) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    // Si hay reportes consolidados en la base de datos, los cargamos para previsualización en la UI
    try {
      const rows = await processorService.getConsolidatedReport();
      res.render('index', { reportRows: rows, message: null, error: null });
    } catch (e) {
      res.render('index', { reportRows: [], message: null, error: null });
    }
  });

  router.post('/procesar', upload.array('files'), async (req, res) => {
    const { facultad, carrera } = req.body;
    const files = req.files || [];

    if (files.length === 0) {
      const rows = await processorService.getConsolidatedReport();
      return res.render('index', { reportRows: rows, message: null, error: 'Por favor, selecciona al menos un archivo PDF o Word para procesar.' });
    }

    try {
      const formattedFiles = files.map(f => ({
        filePath: f.path,
        originalName: f.originalname
      }));

      await processorService.processFiles(formattedFiles, facultad || 'Ciencias Sociales', carrera || 'Trabajo Social');

      // Limpiar archivos subidos temporalmente
      for (const f of files) {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      }

      const rows = await processorService.getConsolidatedReport();
      res.render('index', { reportRows: rows, message: '¡Procesamiento bibliográfico completado con éxito mediante Arquitectura Hexagonal!', error: null });
    } catch (err) {
      const rows = await processorService.getConsolidatedReport();
      res.render('index', { reportRows: rows, message: null, error: `Error en el procesamiento: ${err.message}` });
    }
  });

  router.get('/descargar-csv', async (req, res) => {
    try {
      const rows = await processorService.getConsolidatedReport();
      if (rows.length === 0) {
        return res.status(404).send('No hay datos procesados para exportar.');
      }

      const csvPath = path.resolve('reporte_bibliografia_node.csv');
      const csvWriter = createObjectCsvWriter({
        path: csvPath,
        fieldDelimiter: ';',
        header: [
          { id: 'facultad', title: 'Facultad' },
          { id: 'carrera', title: 'Carrera' },
          { id: 'asignatura', title: 'Asignatura' },
          { id: 'plan', title: 'Plan' },
          { id: 'semester', title: 'Semestre' },
          { id: 'type_bib', title: 'Tipo Bibliografía' },
          { id: 'normalized_author', title: 'Autor Normalizado' },
          { id: 'normalized_title', title: 'Título Normalizado' },
          { id: 'year', title: 'Año' },
          { id: 'publisher', title: 'Editorial / URL' },
          { id: 'physical_availability', title: 'Disponibilidad Física' },
          { id: 'online_availability', title: 'Disponibilidad Online' },
          { id: 'status', title: 'Estado Catálogo' }
        ]
      });

      await csvWriter.writeRecords(rows);
      res.download(csvPath, 'reporte_bibliografia_node.csv');
    } catch (err) {
      res.status(500).send(`Error generando archivo CSV: ${err.message}`);
    }
  });

  return router;
}
