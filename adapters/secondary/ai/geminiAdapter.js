import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { AIPort } from '../../../core/ports/ports.js';

/**
 * Adaptador Secundario de IA exclusivo para Google Gemini.
 *
 * Características clave:
 * - Pool de API keys con rotación automática en caso de error (rate limit, cuota agotada).
 * - Un LOTE completo de archivos se analiza en UNA sola petición API.
 * - Throttle por key: 62s entre llamadas para respetar 1 RPM por cuenta.
 * - Fallback heurístico local si todas las keys se agotan.
 *
 * Configuración en .env:
 *   GEMINI_API_KEY=clave_principal
 *   GEMINI_API_KEY_2=clave_respaldo_2
 *   GEMINI_API_KEY_3=clave_respaldo_3
 *   (puedes agregar tantas como quieras: GEMINI_API_KEY_4, etc.)
 */
export class GeminiAdapter extends AIPort {
  constructor() {
    super();
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    // ── Cargar pool de API keys ────────────────────────────────────────────────
    // Recoge GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc.
    this._keys = this._loadApiKeys();
    this._currentKeyIdx = 0;

    if (this._keys.length === 0) {
      console.warn('⚠ [GeminiAdapter] Ninguna GEMINI_API_KEY configurada. Modo heurístico local activo.');
    } else {
      console.log(`✓ [GeminiAdapter] ${this._keys.length} API key(s) cargadas | Modelo: ${this.modelName}`);
    }
  }

  /**
   * Lee todas las keys de entorno y retorna un array de objetos:
   * [{ key, genAI, lastCallAt, exhausted }]
   */
  _loadApiKeys() {
    const keyPool = [];

    // Key principal
    if (process.env.GEMINI_API_KEY) {
      keyPool.push(this._createKeyEntry(process.env.GEMINI_API_KEY, 1));
    }

    // Keys de respaldo: GEMINI_API_KEY_2, GEMINI_API_KEY_3, ...
    let idx = 2;
    while (process.env[`GEMINI_API_KEY_${idx}`]) {
      keyPool.push(this._createKeyEntry(process.env[`GEMINI_API_KEY_${idx}`], idx));
      idx++;
    }

    return keyPool;
  }

  _createKeyEntry(key, num) {
    return {
      num,
      key,
      genAI: new GoogleGenerativeAI(key),
      lastCallAt: 0,
      exhausted: false
    };
  }

  /**
   * Retorna la key activa actual, o rota a la siguiente si la actual está agotada.
   * Retorna null si todas las keys están agotadas.
   */
  _getActiveKey() {
    for (let i = 0; i < this._keys.length; i++) {
      const idx = (this._currentKeyIdx + i) % this._keys.length;
      if (!this._keys[idx].exhausted) {
        this._currentKeyIdx = idx;
        return this._keys[idx];
      }
    }
    return null; // todas agotadas
  }

  /**
   * Marca la key actual como agotada y rota a la siguiente disponible.
   */
  _rotateKey(reason = 'error') {
    const current = this._keys[this._currentKeyIdx];
    console.warn(`    🔄 [Key Rotation] Key #${current.num} marcada como agotada (${reason}). Rotando a la siguiente...`);
    current.exhausted = true;
    this._currentKeyIdx = (this._currentKeyIdx + 1) % this._keys.length;
  }

  /**
   * Espera el tiempo necesario para respetar 1 RPM en la key activa.
   */
  async _throttle(keyEntry) {
    const MIN_INTERVAL_MS = 62000;
    const elapsed = Date.now() - keyEntry.lastCallAt;
    if (keyEntry.lastCallAt > 0 && elapsed < MIN_INTERVAL_MS) {
      const wait = MIN_INTERVAL_MS - elapsed;
      console.log(`    ⏳ [Rate Limit Key #${keyEntry.num}] Esperando ${Math.ceil(wait / 1000)}s...`);
      await new Promise(r => setTimeout(r, wait));
    }
    keyEntry.lastCallAt = Date.now();
  }

  /**
   * Determina si un error es de cuota/rate-limit (debe rotar key)
   * o un error de otro tipo (puede reintentar con la misma).
   */
  _isQuotaError(err) {
    const msg = err.message?.toLowerCase() || '';
    return (
      msg.includes('429') ||
      msg.includes('quota') ||
      msg.includes('rate limit') ||
      msg.includes('resource_exhausted') ||
      msg.includes('too many requests')
    );
  }

  // ─── MÉTODO PRINCIPAL ──────────────────────────────────────────────────────

  /**
   * ★ Analiza un LOTE completo de archivos en UNA sola llamada API.
   * Rota automáticamente entre keys si alguna falla por cuota/rate-limit.
   *
   * @param {Array<{filePath: string, originalName: string, extractedText: string}>} files
   * @returns {Promise<Array<object>|null>}
   */
  async analyzeBatch(files) {
    if (this._keys.length === 0 || !files.length) return null;

    const MAX_TEXT_CHARS = Math.floor(50000 / files.length);

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
4. Para "faculty" y "career": extráelos del encabezado. Si no están explícitos, infiere el área académica. Si es imposible, usa "".
5. Devuelve SOLO el array JSON, sin texto adicional ni markdown.
6. El array debe tener exactamente ${files.length} elemento(s), uno por documento.`;

    // Construir partes del mensaje (reutilizable para todas las keys)
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
        parts.push((extractedText || '').substring(0, MAX_TEXT_CHARS));
      }
    }

    // ── Intentar con cada key disponible ────────────────────────────────────
    let attempts = 0;
    while (attempts < this._keys.length) {
      const keyEntry = this._getActiveKey();
      if (!keyEntry) {
        console.error('❌ [GeminiAdapter] Todas las API keys están agotadas. Usando fallback heurístico.');
        return null;
      }

      try {
        await this._throttle(keyEntry);

        console.log(`    [Gemini Batch] Key #${keyEntry.num} | ${files.length} archivo(s) → 1 llamada API...`);

        const model = keyEntry.genAI.getGenerativeModel({
          model: this.modelName,
          generationConfig: { responseMimeType: 'application/json' }
        });

        const result = await model.generateContent(parts);
        const rawText = result.response.text();
        const jsonStr = rawText.replace(/```json\s*|\s*```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        if (!Array.isArray(parsed)) return null;

        console.log(`    ✅ [GeminiAdapter] Análisis exitoso con Key #${keyEntry.num}`);

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
        if (this._isQuotaError(err)) {
          this._rotateKey(`cuota agotada: ${err.message.substring(0, 80)}`);
          attempts++;
        } else {
          console.warn(`⚠ [GeminiAdapter] Error inesperado con Key #${keyEntry.num}:`, err.message);
          return null;
        }
      }
    }

    console.error('❌ [GeminiAdapter] Se agotaron todos los reintentos de API keys.');
    return null;
  }

  // ─── Métodos de compatibilidad ─────────────────────────────────────────────

  async analyzeDocument(filePath, originalName, extractedText) {
    const results = await this.analyzeBatch([{ filePath, originalName, extractedText }]);
    return results?.[0] ?? null;
  }

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
