# Procesador de Bibliografía Académica Inteligente (Node.js • Arquitectura Hexagonal)

Sistema automatizado y modular para la gestión, extracción y validación de bibliografías de programas de asignaturas universitarios. Migrado completamente al ecosistema **Node.js (`npm`)** aplicando estrictamente el patrón de **Arquitectura Hexagonal (Puertos y Adaptadores)** e impulsado exclusivamente por **Google Gemini**.

---

## 🏛️ Arquitectura Hexagonal (Puertos y Adaptadores)

El sistema separa por completo las reglas de negocio de los detalles de infraestructura, frameworks y APIs externas:

```
ing_software_online_gpt_4o/
├── core/                                 # 🔴 NÚCLEO DEL DOMINIO (0 dependencias externas)
│   ├── domain/models.js                  #   -> Entidades puras (Career, Subject, Title, Acquisition)
│   ├── ports/ports.js                    #   -> Contratos abstractos (InputPort, AIPort, ScraperPort...)
│   └── services/bibliographyProcessor.js #   -> Orquestador central de lógica de negocio
│
├── adapters/                             # 🔵 ADAPTADORES DE INFRAESTRUCTURA
│   ├── primary/                          # Actores de Entrada (Driving Side)
│   │   └── web/expressRoutes.js          #   -> Rutas e interfaz para el Servidor Web (Express)
│   └── secondary/                        # Actores de Salida (Driven Side)
│       ├── ai/geminiAdapter.js           #   -> IA Exclusiva con Google Gemini (+ Fallback local)
│       ├── scrapers/primoCatalogScraper.js # -> Verificador de catálogo Primo/OpenLibrary
│       ├── parsers/fileParserAdapter.js  #   -> Lector de documentos (.pdf, .docx, .txt)
│       └── persistence/sqliteRepository.js # -> Persistencia en base de datos SQLite
│
├── config/index.js                       # ⚡ Contenedor de Inyección de Dependencias (DI Container)
├── views/index.ejs                       # ✨ Interfaz Web de última generación (Glassmorphism + Dark Mode)
├── app.js                                # Punto de entrada Web App
└── cli.js                                # Punto de entrada CLI
```

---

## 🚀 Requisitos e Instalación

*   **Node.js** v18 o superior (Recomendado v22 / v24)
*   Clave de API de **Google Gemini** en tu archivo `.env`.

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno (`.env`)
```env
GEMINI_API_KEY=tu_clave_gemini_aqui
PORT=5000
```

---

## 💻 Modos de Uso

### 1. Interfaz Web Moderna (Recomendado)
Inicia el servidor web con interfaz gráfica moderna en EJS (diseño Glassmorphic Dark Mode con animaciones y exportación en tiempo real):

```bash
npm start
```
Accede en tu navegador a: **`http://localhost:5000`**

### 2. Modo Desarrollo con Auto-recarga
```bash
npm run dev
```

### 3. Línea de Comandos (CLI)
Procesa archivos de syllabus ubicados en la carpeta `archivos/`:

```bash
npm run cli
```
*(El comando extraerá las referencias usando Google Gemini, las validará en catálogo y guardará los resultados en SQLite de manera instantánea).*
