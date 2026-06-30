/**
 * Puertos de la Arquitectura Hexagonal (Contratos / Interfaces)
 * Separan el núcleo de la aplicación de la infraestructura exterior.
 */

// ============================================================================
// PUERTO DE ENTRADA (Driving Port - consumido por Web App, CLI, GUI)
// ============================================================================
export class BibliographyProcessorPort {
  /**
   * Procesa un directorio o conjunto de archivos para extraer y verificar bibliografías.
   * @param {Array<{filePath: string, originalName: string}>} files Lista de archivos
   * @param {string} facultad Nombre de la facultad
   * @param {string} carreraDefault Nombre de la carrera por defecto
   * @returns {Promise<Array<object>>} Resumen o lista de reportes generados
   */
  async processFiles(files, facultad, carreraDefault) {
    throw new Error('Method not implemented: processFiles');
  }

  /**
   * Obtiene el reporte consolidado de bibliografía.
   * @returns {Promise<Array<object>>} Datos tabulares del reporte
   */
  async getConsolidatedReport() {
    throw new Error('Method not implemented: getConsolidatedReport');
  }
}

// ============================================================================
// PUERTOS DE SALIDA (Driven Ports - implementados por adaptadores externos)
// ============================================================================

export class AIPort {
  /**
   * Extrae la asignatura, plan y semestre de un texto inicial del syllabus.
   * @param {string} text Sample de texto de las primeras páginas
   * @returns {Promise<{subject: string, plan: string, semester: string}>}
   */
  async extractSubjectDetails(text) {
    throw new Error('Method not implemented: extractSubjectDetails');
  }

  /**
   * Normaliza una entrada bibliográfica (autor y título).
   * @param {string} author Autor crudo
   * @param {string} title Título crudo
   * @returns {Promise<{normalizedAuthor: string, normalizedTitle: string, language: string}>}
   */
  async normalizeEntry(author, title) {
    throw new Error('Method not implemented: normalizeEntry');
  }

  /**
   * Extrae todas las referencias bibliográficas estructuradas directamente desde el archivo o texto.
   * @param {string} filePath Ruta del archivo
   * @param {string} originalName Nombre original
   * @param {string} extractedText Texto extraído (para docx o si no es pdf)
   * @returns {Promise<Array<object>|null>} Array de referencias o null si falla
   */
  async extractBibliography(filePath, originalName, extractedText) {
    throw new Error('Method not implemented: extractBibliography');
  }
}

export class ScraperPort {
  /**
   * Busca un libro en el catálogo bibliotecario (Primo/Aleph).
   * @param {string} normalizedTitle
   * @param {string} normalizedAuthor
   * @returns {Promise<{found: boolean, availablePrinted: boolean, availableDigital: boolean, details: object|null}>}
   */
  async checkAvailability(normalizedTitle, normalizedAuthor) {
    throw new Error('Method not implemented: checkAvailability');
  }
}

export class ParserPort {
  /**
   * Extrae texto plano de un archivo (PDF o Docx).
   * @param {string} filePath Ruta al archivo
   * @param {string} originalName Nombre original del archivo (opcional)
   * @returns {Promise<string>} Texto extraído
   */
  async extractText(filePath, originalName = '') {
    throw new Error('Method not implemented: extractText');
  }
}

export class RepositoryPort {
  async getOrCreateCareer(name, facultad) {
    throw new Error('Method not implemented: getOrCreateCareer');
  }

  async getOrCreateSubject(name, careerId, plan, semester) {
    throw new Error('Method not implemented: getOrCreateSubject');
  }

  async findTitleByNormalized(normalizedAuthor, normalizedTitle) {
    throw new Error('Method not implemented: findTitleByNormalized');
  }

  async saveTitle(titleObj) {
    throw new Error('Method not implemented: saveTitle');
  }

  async linkTitleToSubject(titleId, subjectId) {
    throw new Error('Method not implemented: linkTitleToSubject');
  }

  async saveAcquisition(acquisitionObj) {
    throw new Error('Method not implemented: saveAcquisition');
  }

  async getAllReportRows() {
    throw new Error('Method not implemented: getAllReportRows');
  }
}
