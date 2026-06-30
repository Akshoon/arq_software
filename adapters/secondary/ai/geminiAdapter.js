import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { AIPort } from '../../../core/ports/ports.js';

/**
 * Adaptador Secundario de IA exclusivo para Google Gemini.
 * Implementa el contrato AIPort de la Arquitectura Hexagonal.
 */
export class GeminiAdapter extends AIPort {
  constructor() {
    super();
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    if (this.geminiKey) {
      this.genAI = new GoogleGenerativeAI(this.geminiKey);
    } else {
      console.warn('⚠ Advertencia: GEMINI_API_KEY no está configurada en .env. Se utilizará heurística local de respaldo.');
    }
  }

  async generateContent(prompt) {
    if (this.genAI) {
      try {
        const model = await this.genAI.getGenerativeModel({ model: this.modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err) {
        console.warn('⚠ Error en API de Google Gemini:', err.message);
      }
    }
    return null;
  }

  async extractSubjectDetails(text) {
    const sample = text.substring(0, 3000);
    const prompt = `Extrae en JSON exactamente {"subject": "...", "plan": "...", "semester": "..."} del siguiente encabezado de syllabus universitario:\n${sample}`;

    const raw = await this.generateContent(prompt);
    if (raw) {
      try {
        const jsonStr = raw.replace(/```json\s*|\s*```/g, '').trim();
        const match = jsonStr.match(/\{.*\}/s);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return {
            subject: parsed.subject || 'Asignatura no identificada',
            plan: parsed.plan || '2024',
            semester: parsed.semester || '1°'
          };
        }
      } catch (e) {
        // Fallback en caso de error de parseo JSON
      }
    }

    // Heurística local robusta de respaldo si no hay API key configurada
    const subjMatch = text.match(/(?:asignatura|materia|curso):\s*([^\n\r]+)/i);
    const planMatch = text.match(/(?:plan|año):\s*([^\n\r]+)/i);
    const semMatch = text.match(/(?:semestre|ciclo):\s*([^\n\r]+)/i);

    return {
      subject: subjMatch ? subjMatch[1].trim() : null,
      plan: planMatch ? planMatch[1].trim() : '2024',
      semester: semMatch ? semMatch[1].trim() : 'I'
    };
  }

  async normalizeEntry(author, title) {
    const prompt = `Normaliza en JSON exactamente {"normalizedAuthor": "...", "normalizedTitle": "...", "language": "..."} para:\nAutor: "${author}"\nTítulo: "${title}"`;

    const raw = await this.generateContent(prompt);
    if (raw) {
      try {
        const jsonStr = raw.replace(/```json\s*|\s*```/g, '').trim();
        const match = jsonStr.match(/\{.*\}/s);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return {
            normalizedAuthor: parsed.normalizedAuthor || author,
            normalizedTitle: parsed.normalizedTitle || title,
            language: parsed.language || 'Español'
          };
        }
      } catch (e) {}
    }

    // Limpieza heurística de respaldo
    const cleanAuthor = author.replace(/[\(\[\{\]\)\}]/g, '').trim();
    const cleanTitle = title.replace(/[.,;:\/]+$/, '').trim();
    return {
      normalizedAuthor: cleanAuthor || author,
      normalizedTitle: cleanTitle || title,
      language: 'Español'
    };
  }

  async extractBibliography(filePath, originalName, extractedText) {
    if (!this.genAI) {
      return null;
    }

    const ext = (path.extname(originalName) || path.extname(filePath)).toLowerCase();
    const isPdf = ext === '.pdf';

    const prompt = `Actúa como un experto en catalogación bibliográfica universitaria.
Extrae todas las referencias bibliográficas del siguiente documento y devuélvelas como un array JSON.
REGLAS CRÍTICAS:
1. Extrae únicamente las referencias de la sección formal de Bibliografía, Referencias Bibliográficas, Lecturas Obligatorias o Complementarias al final del documento o en apartados específicos.
2. IGNORA absolutamente las citas breves en el cuerpo del texto (ej. "(Pérez, 2020)"). No mezcles ni inventes entradas a partir de citas en texto.
3. Devuelve solo un array JSON con estos campos exactos:
[
  {
    "author": "Nombre normalizado del autor o autores",
    "title": "Título completo de la obra o artículo",
    "year": "Año de publicación (ej. 2020) o vacío",
    "publisher": "Editorial, revista o URL",
    "url": null,
    "typeBib": "básica" | "complementaria"
  }
]
No incluyas texto adicional, solo el JSON.`;

    try {
      const model = await this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      let result;
      if (isPdf && fs.existsSync(filePath)) {
        console.log(`    [Gemini Multimodal] Enviando PDF directamente a Gemini 1.5 Flash...`);
        const fileBuffer = fs.readFileSync(filePath);
        const pdfPart = {
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType: 'application/pdf'
          }
        };
        result = await model.generateContent([prompt, pdfPart]);
      } else {
        console.log(`    [Gemini Text] Enviando texto extraído a Gemini 1.5 Flash...`);
        result = await model.generateContent([
          prompt + `\n\n--- DOCUMENTO ---\n` + (extractedText || '').substring(0, 60000)
        ]);
      }

      const rawText = result.response.text();
      const jsonStr = rawText.replace(/```json\s*|\s*```/g, '').trim();
      const entries = JSON.parse(jsonStr);
      if (Array.isArray(entries)) {
        return entries.map(e => ({
          author: (e.author || 'Autor Desconocido').substring(0, 100),
          title: (e.title || 'Título No Especifcado').substring(0, 150),
          year: String(e.year || '').replace(/\D/g, '').substring(0, 4),
          publisher: e.publisher || '',
          url: e.url || null,
          typeBib: (e.typeBib || 'básica').toLowerCase().includes('comp') ? 'complementaria' : 'básica',
          isNormalizedByAI: true
        }));
      }
    } catch (err) {
      console.warn('⚠ Error en extracción bibliográfica multimodal de Gemini:', err.message);
    }
    return null;
  }
}
