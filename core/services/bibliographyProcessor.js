import { BibliographyProcessorPort } from '../ports/ports.js';
import { Title, Acquisition } from '../domain/models.js';

/**
 * Servicio Central del Núcleo (Core Service)
 * Implementa el puerto de entrada BibliographyProcessorPort y coordina
 * los puertos de salida (Parser, AI, Scraper, Repository).
 */
export class BibliographyProcessorService extends BibliographyProcessorPort {
  /**
   * @param {import('../ports/ports.js').ParserPort} parserPort
   * @param {import('../ports/ports.js').AIPort} aiPort
   * @param {import('../ports/ports.js').ScraperPort} scraperPort
   * @param {import('../ports/ports.js').RepositoryPort} repositoryPort
   */
  constructor(parserPort, aiPort, scraperPort, repositoryPort) {
    super();
    this.parserPort = parserPort;
    this.aiPort = aiPort;
    this.scraperPort = scraperPort;
    this.repositoryPort = repositoryPort;
  }

  async processFiles(files, facultad = 'Ciencias Sociales', carreraDefault = 'Trabajo Social') {
    const results = [];

    // ── PASO 1: Extraer texto de todos los archivos sin llamadas API ──────────
    console.log(`\n[CoreService] Extrayendo texto de ${files.length} archivo(s)...`);
    const preparedFiles = [];
    for (const file of files) {
      try {
        const extractedText = await this.parserPort.extractText(file.filePath, file.originalName);
        preparedFiles.push({ ...file, extractedText });
      } catch (err) {
        console.error(`[CoreService] Error extrayendo texto de ${file.originalName}:`, err.message);
        results.push({ file: file.originalName, status: 'ERROR', error: err.message });
      }
    }

    if (!preparedFiles.length) return results;

    // ── PASO 2: UNA sola llamada API para analizar TODO el lote ──────────────
    let batchResults = null;
    if (this.aiPort.analyzeBatch) {
      console.log(`[CoreService] Analizando lote completo (${preparedFiles.length} archivos) en 1 llamada API...`);
      batchResults = await this.aiPort.analyzeBatch(preparedFiles);
    }

    // ── PASO 3: Persistir resultados por cada archivo ─────────────────────────
    for (let i = 0; i < preparedFiles.length; i++) {
      const file = preparedFiles[i];
      console.log(`\n[CoreService] Persistiendo: ${file.originalName}`);
      try {
        const aiResult = batchResults?.[i] || null;

        // Datos de asignatura (de IA o fallback heurístico local)
        let subject, plan, semester;
        if (aiResult) {
          ({ subject, plan, semester } = aiResult);
        } else {
          ({ subject, plan, semester } = await this.aiPort.extractSubjectDetails(file.extractedText));
        }

        const asignaturaNombre = subject || file.originalName.replace(/\.[^/.]+$/, '');
        console.log(`    Asignatura: ${asignaturaNombre} | Carrera: ${carreraDefault} | Plan: ${plan}`);

        // Registrar Carrera y Asignatura en persistencia
        const career = await this.repositoryPort.getOrCreateCareer(carreraDefault, facultad);
        const subjectEntity = await this.repositoryPort.getOrCreateSubject(
          asignaturaNombre,
          career.id,
          plan || '',
          semester || ''
        );

        // Referencias bibliográficas (de IA o fallback heurístico)
        let rawEntries = aiResult?.references || [];
        if (!rawEntries.length) {
          console.log(`    [Respaldo Heurístico] Extrayendo referencias locales...`);
          rawEntries = this.extractBibliographyEntries(file.extractedText);
        }
        console.log(`    Referencias encontradas: ${rawEntries.length}`);

        for (const raw of rawEntries) {
          const norm = raw.isNormalizedByAI
            ? { normalizedAuthor: raw.author, normalizedTitle: raw.title, language: 'Español' }
            : await this.aiPort.normalizeEntry(raw.author, raw.title);
          if (!raw.isNormalizedByAI) {
            console.log(`    Normalizando con IA: "${raw.author}" - "${raw.title}"`);
          }

          // Buscar si ya existe el título
          let titleObj = await this.repositoryPort.findTitleByNormalized(
            norm.normalizedAuthor,
            norm.normalizedTitle
          );

          if (titleObj) {
            console.log(`      [DUPLICADO detectado en BD] ID: ${titleObj.id}`);
            await this.repositoryPort.linkTitleToSubject(titleObj.id, subjectEntity.id);
          } else {
            console.log(`      [NUEVO Título] Consultando disponibilidad en catálogo Primo...`);
            const isArticle = raw.url !== null;
            let scrapResult = { found: false, availablePrinted: false, availableDigital: isArticle, details: null };

            if (!isArticle) {
              scrapResult = await this.scraperPort.checkAvailability(norm.normalizedTitle, norm.normalizedAuthor);
            }

            const newTitle = new Title({
              normalizedAuthor: scrapResult.details?.autor_normalizado || norm.normalizedAuthor,
              normalizedTitle: scrapResult.details?.titulo_normalizado || norm.normalizedTitle,
              originalAuthor: raw.author,
              originalTitle: raw.title,
              year: scrapResult.details?.fecha_creacion || raw.year || '',
              publisher: scrapResult.details?.editor || raw.publisher || (isArticle ? raw.url : ''),
              edition: scrapResult.details?.edicion || '',
              format: scrapResult.details?.formato || '',
              physicalAvailability: scrapResult.details?.disponibilidad_fisica || '',
              onlineAvailability: scrapResult.details?.disponibilidad_online || (isArticle ? 'Enlace directo' : ''),
              language: norm.language,
              typeBib: raw.typeBib || 'básica'
            });

            const savedTitle = await this.repositoryPort.saveTitle(newTitle);
            await this.repositoryPort.linkTitleToSubject(savedTitle.id, subjectEntity.id);

            const status = (scrapResult.found || scrapResult.availablePrinted || scrapResult.availableDigital)
              ? 'disponible'
              : 'no disponible';

            const acquisition = new Acquisition({
              titleId: savedTitle.id,
              status,
              availablePrinted: scrapResult.availablePrinted,
              availableDigital: scrapResult.availableDigital
            });

            await this.repositoryPort.saveAcquisition(acquisition);
          }
        }

        results.push({ file: file.originalName, status: 'OK', entries: rawEntries.length });
      } catch (err) {
        console.error(`[CoreService] Error procesando archivo ${file.originalName}:`, err.message);
        results.push({ file: file.originalName, status: 'ERROR', error: err.message });
      }
    }

    return results;
  }

  async getConsolidatedReport() {
    return await this.repositoryPort.getAllReportRows();
  }

  /**
   * Heurística robusta para detectar y extraer referencias bibliográficas de un texto de syllabus.
   */
  extractBibliographyEntries(text) {
    const lines = text.split(/\r?\n/);
    let inBibSection = false;
    let currentType = 'básica';
    const entries = [];

    const bibRegex = /(bibliograf[íi]a|referencias|lecturas|literatura)\b/i;
    const compRegex = /(complementaria|opcional|secundaria)/i;

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (bibRegex.test(trimmed) && trimmed.length < 50) {
        inBibSection = true;
        if (compRegex.test(trimmed)) {
          currentType = 'complementaria';
        } else {
          currentType = 'básica';
        }
        continue;
      }

      // Si estamos en sección o si parece una referencia con formato Autor (Año). Título.
      if (inBibSection || /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+.*(\(\d{4}\)|\d{4})/.test(trimmed)) {
        if (trimmed.length > 20) {
          // Extraer año si existe
          const yearMatch = trimmed.match(/\(?(\d{4})\)?/);
          const year = yearMatch ? yearMatch[1] : '';

          // Intentar separar autor y título
          const parts = trimmed.split(/\.\s+/);
          const author = parts[0] || 'Autor Desconocido';
          const title = parts.slice(1, 3).join('. ') || trimmed;

          entries.push({
            author: author.substring(0, 100),
            title: title.substring(0, 150),
            year,
            publisher: parts[3] || '',
            url: trimmed.includes('http') ? (trimmed.match(/https?:\/\/[^\s]+/) || [null])[0] : null,
            typeBib: currentType
          });
        }
      }
    }

    // Si la extracción de sección falló, tomamos las líneas que parezcan citas académicas
    if (entries.length === 0) {
      for (let line of lines) {
        const trimmed = line.trim();
        if (/^[A-Z][a-z]+,\s*[A-Z]\./.test(trimmed) || /.*\(\d{4}\)\..*/.test(trimmed)) {
          const parts = trimmed.split(/\.\s+/);
          entries.push({
            author: parts[0] || 'Autor Desconocido',
            title: parts[1] || trimmed,
            year: (trimmed.match(/\d{4}/) || [''])[0],
            url: null,
            typeBib: 'básica'
          });
        }
      }
    }

    return entries.slice(0, 15); // Limitar a las 15 más relevantes por archivo para no saturar APIs
  }
}
