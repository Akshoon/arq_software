import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIPort } from '../../../core/ports/ports.js';

/**
 * Adaptador Secundario de IA exclusivo para Google Gemini.
 * Implementa el contrato AIPort de la Arquitectura Hexagonal.
 */
export class GeminiAdapter extends AIPort {
  constructor() {
    super();
    this.geminiKey = process.env.GEMINI_API_KEY;

    if (this.geminiKey) {
      this.genAI = new GoogleGenerativeAI(this.geminiKey);
    } else {
      console.warn('⚠ Advertencia: GEMINI_API_KEY no está configurada en .env. Se utilizará heurística local de respaldo.');
    }
  }

  async generateContent(prompt) {
    if (this.genAI) {
      try {
        const model = await this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
}
