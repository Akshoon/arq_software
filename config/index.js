import dotenv from 'dotenv';
import { FileParserAdapter } from '../adapters/secondary/parsers/fileParserAdapter.js';
import { GeminiAdapter } from '../adapters/secondary/ai/geminiAdapter.js';
import { PrimoCatalogScraper } from '../adapters/secondary/scrapers/primoCatalogScraper.js';
import { SQLiteRepository } from '../adapters/secondary/persistence/sqliteRepository.js';
import { BibliographyProcessorService } from '../core/services/bibliographyProcessor.js';

dotenv.config();

/**
 * Contenedor de Inyección de Dependencias (Hexagonal Architecture DI Container)
 * Instancia los adaptadores secundarios concretos y los inyecta en los puertos del Core.
 * Ahora configurado exclusivamente para usar Google Gemini como proveedor de IA.
 */
class DependencyContainer {
  constructor() {
    this.repository = new SQLiteRepository('./bibliografia_node.db');
    this.parser = new FileParserAdapter();
    this.ai = new GeminiAdapter();
    this.scraper = new PrimoCatalogScraper();
    
    this.processorService = new BibliographyProcessorService(
      this.parser,
      this.ai,
      this.scraper,
      this.repository
    );
  }

  async init() {
    await this.repository.init();
    console.log('✓ [Hexagonal DI Container] Repositorio SQLite inicializado y conectado.');
    console.log('✓ [Hexagonal DI Container] Adaptadores secundarios inyectados (IA: Google Gemini).');
  }

  getBibliographyProcessor() {
    return this.processorService;
  }
}

export const container = new DependencyContainer();
