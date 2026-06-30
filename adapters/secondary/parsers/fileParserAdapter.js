import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { ParserPort } from '../../../core/ports/ports.js';

export class FileParserAdapter extends ParserPort {
  async extractText(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo no existe: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text || '';
    } else if (ext === '.docx' || ext === '.doc') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } else if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf-8');
    } else {
      throw new Error(`Formato de archivo no soportado para extracción: ${ext}`);
    }
  }
}
