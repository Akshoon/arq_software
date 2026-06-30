import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { AIPort } from '../../../core/ports/ports.js';

/**
 * Adaptador Secundario de IA exclusivo para Google Gemini.
 * Optimizado para límites estrictos de rate (1 RPM / 20 RPD):
 * - Todo el análisis de un archivo se hace en UNA sola petición.
 * - Cola interna con throttle de 62s entre llamadas para respetar 1 RPM.
 * - Fallback heurístico local si no hay API key o se agota la cuota.
 */
export class GeminiAdapter extends AIPort {
  constructor() {
    super();
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this._lastCallAt = 0; // timestamp en ms de la última llamada a la API

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
    const MIN_INTERVAL_MS = 62000; // 62 segundos entre llamadas
    const elapsed = Date.now() - this._lastCallAt;
    if (this._lastCallAt > 0 && elapsed < MIN_INTERVAL_MS) {
      const wait = MIN_INTERVAL_MS - elapsed;
      console.log(`    ⏳ [Rate Limit] Esperando ${Math.ceil(wait / 1000)}s para respetar 1 RPM...`);
      await new Promise(r => setTimeout(r, wait));
    }
    this._lastCallAt = Date.now();
  }

  /**
   * Método maestro: una sola petición que extrae asignatura + bibliografía completa.
   * Retorna { subject, plan, semester, references[] } o null en caso de fallo.
   * @param {string} filePath Ruta del archivo en disco
   * @param {string} originalName Nombre original del archivo
   * @param {string} extractedText Texto pre-extraído (para .docx o fallback)
   */
  async analyzeDocument(filePath, originalName, extractedText) {
    if (!this.genAI) return null;

    const ext = (path.extname(originalName) || path.extname(filePath)).toLowerCase();
    const isPdf = ext === '.pdf';

    const prompt = `Eres un experto en catalogación bibliográfica universitaria. Analiza este syllabus/programa de asignatura y devuelve UN ÚNICO objeto JSON con esta estructura exacta, sin texto adicional:

{
  "subject": "Nombre completo de la asignatura",
  "plan": "Año o código del plan de estudios (ej: 2024)",
  "semester": "Semestre o ciclo (ej: 1°, II, Primer Semestre)",
  "references": [
    {
      "author": "Apellido, Nombre del autor normalizado",
      "title": "Título completo de la obra",
      "year": "Año (solo dígitos, ej: 2020)",
      "publisher": "Editorial, revista o URL de acceso",
      "url": null,
      "typeBib": "básica"
    }
  ]
}

REGLAS CRÍTICAS:
1. En "references" incluye ÚNICAMENTE las entradas de las secciones formales de Bibliografía, Referencias, Lecturas Obligatorias o Complementarias.
2. IGNORA completamente las citas breves del cuerpo del texto como "(Pérez, 2020)".
3. Clasifica "typeBib" como "básica" o "complementaria" según la sección donde aparecen.
4. Si un campo no está disponible, usa cadena vacía "" (nunca null para strings).
5. El campo "url" debe ser null si no hay URL, o la URL completa si existe en la referencia.`;

    try {
      await this._throttle();

      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });

      let result;
      if (isPdf && fs.existsSync(filePath)) {
        console.log(`    [Gemini Multimodal] Enviando PDF directo → 1 sola llamada API...`);
        const pdfPart = {
          inlineData: {
            data: fs.readFileSync(filePath).toString('base64'),
            mimeType: 'application/pdf'
          }
        };
        result = await model.generateContent([prompt, pdfPart]);
      } else {
        console.log(`    [Gemini Text] Enviando texto extraído → 1 sola llamada API...`);
        result = await model.generateContent([
          prompt + `\n\n--- DOCUMENTO ---\n` + (extractedText || '').substring(0, 60000)
        ]);
      }

      const rawText = result.response.text();
      const jsonStr = rawText.replace(/```json\s*|\s*```/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      if (!parsed || typeof parsed !== 'object') return null;

      const references = Array.isArray(parsed.references)
        ? parsed.references.map(e => ({
            author: (e.author || 'Autor Desconocido').substring(0, 100),
            title: (e.title || 'Título no especificado').substring(0, 150),
            year: String(e.year || '').replace(/\D/g, '').substring(0, 4),
            publisher: e.publisher || '',
            url: e.url || null,
            typeBib: String(e.typeBib || 'básica').toLowerCase().includes('comp') ? 'complementaria' : 'básica',
            isNormalizedByAI: true
          }))
        : [];

      return {
        subject: parsed.subject || null,
        plan: parsed.plan || '2024',
        semester: parsed.semester || 'I',
        references
      };
    } catch (err) {
      console.warn('⚠ [GeminiAdapter] Error en analyzeDocument:', err.message);
      return null;
    }
  }

  // ─── Métodos heredados (fallback o compatibilidad) ─────────────────────────

  /**
   * Fallback: extrae solo datos de asignatura desde texto (sin llamada API si se puede evitar).
   */
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

  /**
   * Fallback: normalización heurística local sin llamada API.
   */
  async normalizeEntry(author, title) {
    const cleanAuthor = author.replace(/[\(\[\{\]\)\}]/g, '').trim();
    const cleanTitle  = title.replace(/[.,;:\/]+$/, '').trim();
    return {
      normalizedAuthor: cleanAuthor || author,
      normalizedTitle:  cleanTitle  || title,
      language: 'Español'
    };
  }

  /**
   * Delegado a analyzeDocument para compatibilidad con el puerto AIPort.
   */
  async extractBibliography(filePath, originalName, extractedText) {
    const result = await this.analyzeDocument(filePath, originalName, extractedText);
    return result ? result.references : null;
  }
}
