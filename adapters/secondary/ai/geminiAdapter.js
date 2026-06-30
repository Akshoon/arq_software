import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { AIPort } from '../../../core/ports/ports.js';

/**
 * Adaptador Secundario de IA exclusivo para Google Gemini.
 * Optimizado para límites estrictos de rate (1 RPM / 20 RPD):
 * - Un LOTE completo de archivos se analiza en UNA sola petición API.
 * - Throttle de 62s entre llamadas para respetar 1 RPM.
 * - Fallback heurístico local si no hay API key o se agota la cuota.
 */
export class GeminiAdapter extends AIPort {
  constructor() {
    super();
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this._lastCallAt = 0;

    if (this.geminiKey) {
      this.genAI = new GoogleGenerativeAI(this.geminiKey);
      console.log(`✓ [GeminiAdapter] Modelo: ${this.modelName} | Rate-limit: 1 RPM / 20 RPD`);
    } else {
      console.warn('⚠ Advertencia: GEMINI_API_KEY no está configurada en .env. Se utilizará heurística local de respaldo.');
    }
  }

  /**
   * Espera el tiempo necesario para respetar el límite de 1 RPM.
   */
  async _throttle() {
    const MIN_INTERVAL_MS = 62000;
    const elapsed = Date.now() - this._lastCallAt;
    if (this._lastCallAt > 0 && elapsed < MIN_INTERVAL_MS) {
      const wait = MIN_INTERVAL_MS - elapsed;
      console.log(`    ⏳ [Rate Limit] Esperando ${Math.ceil(wait / 1000)}s para respetar 1 RPM...`);
      await new Promise(r => setTimeout(r, wait));
    }
    this._lastCallAt = Date.now();
  }

  /**
   * ★ MÉTODO PRINCIPAL: Analiza un LOTE completo de archivos en UNA sola llamada API.
   *
   * Acepta N archivos (PDF o docx) y retorna un array con el resultado de cada uno:
   * [{ originalName, subject, plan, semester, references[] }, ...]
   *
   * - PDFs: se envían como inlineData base64 (multimodal nativo).
   * - Docx/txt: su texto extraído se incluye como bloque de texto en el prompt.
   * - 1 sola llamada API sin importar cuántos archivos haya en el lote.
   *
   * @param {Array<{filePath: string, originalName: string, extractedText: string}>} files
   * @returns {Promise<Array<object>|null>}
   */
  async analyzeBatch(files) {
    if (!this.genAI || !files.length) return null;

    const MAX_TEXT_CHARS = Math.floor(50000 / files.length); // distribuir tokens entre archivos

    const prompt = `Eres un experto en catalogación bibliográfica universitaria.
Se te proporcionan ${files.length} documento(s) de programas de asignatura (syllabi) universitarios.
Analiza CADA documento de forma independiente y devuelve un array JSON con UN objeto por documento, en el MISMO ORDEN en que aparecen.

Estructura requerida para cada objeto (NO omitas ningún campo):
{
  "documentIndex": 0,
  "originalName": "nombre del archivo tal como se indica",
  "faculty": "Nombre de la Facultad o Unidad Académica a la que pertenece la asignatura",
  "career": "Nombre completo de la Carrera o Programa al que pertenece la asignatura",
  "subject": "Nombre completo de la asignatura",
  "plan": "Año o código del plan de estudios (ej: 2024)",
  "semester": "Semestre o ciclo (ej: 1°, II)",
  "references": [
    {
      "author": "Apellido, Nombre normalizado",
      "title": "Título completo de la obra",
      "year": "Solo dígitos (ej: 2020)",
      "publisher": "Editorial, revista o URL",
      "url": null,
      "typeBib": "básica"
    }
  ]
}

REGLAS CRÍTICAS:
1. En "references" incluye ÚNICAMENTE entradas de secciones formales: Bibliografía, Referencias, Lecturas Obligatorias/Complementarias.
2. IGNORA citas breves del cuerpo del texto como "(Pérez, 2020)".
3. Clasifica "typeBib" como "básica" o "complementaria" según la sección.
4. Para "faculty" y "career": extráelos del encabezado del documento. Si no están explícitos, infiere el área académica a partir del contenido. Si es imposible determinarlo, usa cadena vacía "".
5. Devuelve SOLO el array JSON, sin texto adicional ni markdown.
6. El array debe tener exactamente ${files.length} elemento(s), uno por documento.`;

    // Construir las partes del mensaje
    const parts = [prompt];

    for (let i = 0; i < files.length; i++) {
      const { filePath, originalName, extractedText } = files[i];
      const ext = (path.extname(originalName) || path.extname(filePath)).toLowerCase();
      const isPdf = ext === '.pdf';

      parts.push(`\n\n=== DOCUMENTO ${i} | Archivo: "${originalName}" ===`);

      if (isPdf && fs.existsSync(filePath)) {
        parts.push({
          inlineData: {
            data: fs.readFileSync(filePath).toString('base64'),
            mimeType: 'application/pdf'
          }
        });
      } else {
        // Para docx/txt incluimos el texto extraído
        const snippet = (extractedText || '').substring(0, MAX_TEXT_CHARS);
        parts.push(snippet);
      }
    }

    try {
      await this._throttle();

      console.log(`    [Gemini Batch] Enviando ${files.length} archivo(s) en 1 sola llamada API...`);

      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });

      const result = await model.generateContent(parts);
      const rawText = result.response.text();
      const jsonStr = rawText.replace(/```json\s*|\s*```/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) return null;

      return parsed.map((item, idx) => ({
        originalName: item.originalName || files[idx]?.originalName || `doc_${idx}`,
        faculty: item.faculty || '',
        career: item.career || '',
        subject: item.subject || null,
        plan: item.plan || '2024',
        semester: item.semester || 'I',
        references: Array.isArray(item.references)
          ? item.references.map(e => ({
              author: (e.author || 'Autor Desconocido').substring(0, 100),
              title: (e.title || 'Título no especificado').substring(0, 150),
              year: String(e.year || '').replace(/\D/g, '').substring(0, 4),
              publisher: e.publisher || '',
              url: e.url || null,
              typeBib: String(e.typeBib || 'básica').toLowerCase().includes('comp') ? 'complementaria' : 'básica',
              isNormalizedByAI: true
            }))
          : []
      }));
    } catch (err) {
      console.warn('⚠ [GeminiAdapter] Error en analyzeBatch:', err.message);
      return null;
    }
  }

  /**
   * Compatibilidad: analiza un solo documento delegando a analyzeBatch.
   */
  async analyzeDocument(filePath, originalName, extractedText) {
    const results = await this.analyzeBatch([{ filePath, originalName, extractedText }]);
    return results?.[0] ?? null;
  }

  // ─── Métodos fallback heurísticos (sin llamada API) ────────────────────────

  async extractSubjectDetails(text) {
    const subjMatch = text.match(/(?:asignatura|materia|curso)\s*:\s*([^\n\r]+)/i);
    const planMatch = text.match(/(?:plan|año)\s*:\s*([^\n\r]+)/i);
    const semMatch  = text.match(/(?:semestre|ciclo)\s*:\s*([^\n\r]+)/i);
    return {
      subject:  subjMatch ? subjMatch[1].trim() : null,
      plan:     planMatch ? planMatch[1].trim() : '2024',
      semester: semMatch  ? semMatch[1].trim()  : 'I'
    };
  }

  async normalizeEntry(author, title) {
    const cleanAuthor = author.replace(/[\(\[\{\]\)\}]/g, '').trim();
    const cleanTitle  = title.replace(/[.,;:\/]+$/, '').trim();
    return {
      normalizedAuthor: cleanAuthor || author,
      normalizedTitle:  cleanTitle  || title,
      language: 'Español'
    };
  }

  async extractBibliography(filePath, originalName, extractedText) {
    const result = await this.analyzeDocument(filePath, originalName, extractedText);
    return result ? result.references : null;
  }
}
