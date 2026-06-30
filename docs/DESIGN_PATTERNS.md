# Patrones de Diseño Implementados

Este documento describe todos los patrones de diseño implementados en el Sistema de Procesamiento de Bibliografía.

## Índice
1. [Strategy Pattern](#strategy-pattern)
2. [Factory Method Pattern](#factory-method-pattern)
3. [Singleton Pattern](#singleton-pattern)
4. [Builder Pattern](#builder-pattern)
5. [Repository Pattern](#repository-pattern)
6. [Active Record Pattern](#active-record-pattern)

---

## Strategy Pattern

**Ubicación**: `file_extractor_strategies.py`

### Propósito
Definir una familia de algoritmos de extracción de archivos, encapsular cada uno y hacerlos intercambiables.

### Componentes
- **Strategy (Estrategia)**: `FileExtractorStrategy` - Interfaz común
- **ConcreteStrategy**: `PDFExtractorStrategy`, `WordExtractorStrategy`
- **Context (Contexto)**: `FileProcessor`

### Diagrama
```
FileExtractorStrategy (interfaz)
    ↑
    ├── PDFExtractorStrategy
    └── WordExtractorStrategy

FileProcessor usa → FileExtractorStrategy
```

### Beneficios
- ✅ Elimina condicionales complejos (if/elif/else)
- ✅ Facilita agregar nuevos formatos sin modificar código existente
- ✅ Cada estrategia es independiente y testeable
- ✅ Cumple con Open/Closed Principle

### Ejemplo de Uso
```python
# Uso con factory method (recomendado)
processor = FileProcessor.create_for_file("documento.pdf")
markdown = processor.extract_text("documento.pdf")

# Uso directo
processor = FileProcessor(PDFExtractorStrategy())
markdown = processor.extract_text("documento.pdf")
```

---

## Factory Method Pattern

**Ubicación**: `file_extractor_strategies.py` - Método `FileProcessor.create_for_file()`

### Propósito
Definir una interfaz para crear objetos, pero dejar que las subclases decidan qué clase instanciar.

### Implementación
```python
@staticmethod
def create_for_file(file_path: str) -> 'FileProcessor':
    _, extension = os.path.splitext(file_path)
    extension = extension.lower()
    
    estrategias = {
        '.pdf': PDFExtractorStrategy(),
        '.docx': WordExtractorStrategy()
    }
    
    if extension not in estrategias:
        raise ValueError(f"Tipo no soportado: {extension}")
    
    return FileProcessor(estrategias[extension])
```

### Beneficios
- ✅ Encapsula lógica de creación
- ✅ Cliente no necesita conocer clases concretas
- ✅ Facilita extensión con nuevos tipos

---

## Singleton Pattern

**Ubicación**: `config.py` - Clase `OpenAIConfig`

### Propósito
Garantizar que una clase tenga una única instancia y proporcionar un punto de acceso global.

### Implementación
```python
class OpenAIConfig:
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if OpenAIConfig._initialized:
            return
        # Inicialización solo una vez
        load_dotenv()
        self.api_key = os.getenv('OPENAI_API_KEY')
        OpenAIConfig._initialized = True
```

### Beneficios
- ✅ Evita múltiples lecturas del archivo .env
- ✅ Centraliza configuración de OpenAI
- ✅ Facilita testing con mocks
- ✅ Garantiza consistencia

### Ejemplo de Uso
```python
config1 = OpenAIConfig()
config2 = OpenAIConfig()
assert config1 is config2  # True - misma instancia
```

---

## Builder Pattern

**Ubicación**: `prompt_builder.py` - Clase `PromptBuilder`

### Propósito
Separar la construcción de un objeto complejo de su representación.

### Implementación
Interfaz fluida para construir prompts:
```python
prompt = (PromptBuilder()
    .set_task("Extraer bibliografía")
    .add_instruction("Diferencia entre libros y artículos")
    .set_output_format("JSON")
    .add_context(texto)
    .build())
```

### Beneficios
- ✅ Construcción fluida y legible
- ✅ Reutilización de componentes
- ✅ Facilita testing
- ✅ Permite diferentes representaciones

---

## Repository Pattern

**Ubicación**: `repositories.py`

### Propósito
Abstraer el acceso a datos, proporcionando una interfaz similar a una colección.

### Componentes
- `BaseRepository` - Operaciones CRUD comunes
- `TituloRepository` - Gestión de títulos
- `CarreraRepository` - Gestión de carreras
- `AsignaturaRepository` - Gestión de asignaturas

### Beneficios
- ✅ Separa lógica de negocio de persistencia
- ✅ Facilita cambio de base de datos
- ✅ Mejora testabilidad
- ✅ Centraliza consultas complejas

### Ejemplo de Uso
```python
repo = TituloRepository()
titulo = repo.find_by_author_and_title("Martuccelli", "Cambio de Rumbo")
```

---

## Active Record Pattern

**Ubicación**: `models.py`

### Propósito
Encapsular una fila de base de datos en un objeto con lógica de dominio.

### Implementación
Mediante SQLAlchemy ORM:
```python
class Titulo(Base):
    __tablename__ = 'titles'
    id = Column(Integer, primary_key=True)
    normalized_author = Column(String)
    # ... más campos
    asignaturas = relationship('Asignatura', ...)
```

### Beneficios
- ✅ Mapeo objeto-relacional transparente
- ✅ Simplifica acceso a datos
- ✅ Relaciones bien definidas
- ✅ Validaciones en el modelo

---

## Resumen de Patrones por Categoría

### Patrones Creacionales
- **Singleton**: Configuración única de OpenAI
- **Factory Method**: Creación de procesadores de archivos
- **Builder**: Construcción de prompts complejos

### Patrones Estructurales
- **Repository**: Abstracción de acceso a datos

### Patrones de Comportamiento
- **Strategy**: Algoritmos de extracción intercambiables

### Patrones de Persistencia
- **Active Record**: Mapeo objeto-relacional

---

## Extensibilidad

### Agregar Nuevo Formato de Archivo

1. Crear estrategia:
```python
class ExcelExtractorStrategy(FileExtractorStrategy):
    def extract_text(self, file_path: str) -> str:
        # Implementación
        pass
```

2. Agregar al factory:
```python
estrategias = {
    '.pdf': PDFExtractorStrategy(),
    '.docx': WordExtractorStrategy(),
    '.xlsx': ExcelExtractorStrategy()  # Nuevo
}
```

### Agregar Nuevo Tipo de Prompt

```python
class BibliographyPrompts:
    @staticmethod
    def new_prompt_type(text: str) -> str:
        return (PromptBuilder()
            .set_task("Nueva tarea")
            .add_instruction("...")
            .build())
```

---

## Referencias

- **Strategy Pattern**: Gang of Four - Design Patterns
- **Factory Method**: Gang of Four - Design Patterns
- **Singleton**: Gang of Four - Design Patterns
- **Builder**: Gang of Four - Design Patterns
- **Repository**: Martin Fowler - Patterns of Enterprise Application Architecture
- **Active Record**: Martin Fowler - Patterns of Enterprise Application Architecture
