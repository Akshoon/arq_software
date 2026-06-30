# Principios SOLID Aplicados

Este documento explica cómo se aplican los principios SOLID en el Sistema de Procesamiento de Bibliografía.

## Índice
1. [Single Responsibility Principle (SRP)](#single-responsibility-principle)
2. [Open/Closed Principle (OCP)](#openclosed-principle)
3. [Liskov Substitution Principle (LSP)](#liskov-substitution-principle)
4. [Interface Segregation Principle (ISP)](#interface-segregation-principle)
5. [Dependency Inversion Principle (DIP)](#dependency-inversion-principle)

---

## Single Responsibility Principle (SRP)

> Una clase debe tener una, y solo una, razón para cambiar.

### ✅ Aplicación en el Proyecto

#### `FileExtractorStrategy` y Estrategias Concretas
- **PDFExtractorStrategy**: UNA responsabilidad → Extraer texto de PDFs
- **WordExtractorStrategy**: UNA responsabilidad → Extraer texto de Word
- Cada estrategia maneja un solo tipo de archivo

#### `OpenAIConfig`
- **UNA responsabilidad**: Gestionar configuración de OpenAI
- No mezcla configuración con lógica de negocio

#### Modelos de Datos
- **Carrera**: Representa y persiste datos de carrera
- **Asignatura**: Representa y persiste datos de asignatura
- **Titulo**: Representa y persiste datos de título
- Cada modelo tiene una responsabilidad clara

### Ejemplo de Violación (evitado)
```python
# ❌ MAL - Múltiples responsabilidades
class FileProcessor:
    def extract_text(self, file):
        if file.endswith('.pdf'):
            # Lógica PDF
        elif file.endswith('.docx'):
            # Lógica Word
        # Configurar OpenAI
        # Acceder a base de datos
        # etc.

# ✅ BIEN - Responsabilidad única
class PDFExtractorStrategy:
    def extract_text(self, file):
        # Solo extracción de PDF
```

---

## Open/Closed Principle (OCP)

> Las entidades de software deben estar abiertas para extensión, pero cerradas para modificación.

### ✅ Aplicación en el Proyecto

#### Sistema de Estrategias
**ABIERTO a extensión**: Se pueden agregar nuevas estrategias
```python
# Agregar soporte para Excel sin modificar código existente
class ExcelExtractorStrategy(FileExtractorStrategy):
    def extract_text(self, file_path: str) -> str:
        # Implementación para Excel
        pass
```

**CERRADO a modificación**: No se modifica `FileProcessor` ni otras estrategias

#### Factory Method
```python
# Solo se modifica el diccionario de estrategias
estrategias = {
    '.pdf': PDFExtractorStrategy(),
    '.docx': WordExtractorStrategy(),
    '.xlsx': ExcelExtractorStrategy()  # Nueva extensión
}
```

### Beneficios
- ✅ Agregar nuevos formatos sin romper código existente
- ✅ Sin regresiones en funcionalidad actual
- ✅ Facilita mantenimiento

---

## Liskov Substitution Principle (LSP)

> Los objetos de una superclase deben poder ser reemplazados por objetos de sus subclases sin romper la aplicación.

### ✅ Aplicación en el Proyecto

#### Estrategias Intercambiables
```python
# Todas las estrategias son intercambiables
def procesar_archivo(strategy: FileExtractorStrategy, file: str):
    return strategy.extract_text(file)

# Funciona con cualquier estrategia
procesar_archivo(PDFExtractorStrategy(), "doc.pdf")
procesar_archivo(WordExtractorStrategy(), "doc.docx")
```

#### Comportamiento Consistente
- Todas las estrategias retornan `str` (Markdown)
- Todas lanzan `FileNotFoundError` si el archivo no existe
- Todas implementan `get_supported_extensions()`

### Garantías
- ✅ Cualquier `FileExtractorStrategy` puede usarse donde se espera la interfaz
- ✅ El comportamiento es predecible y consistente
- ✅ No hay sorpresas al cambiar estrategias

---

## Interface Segregation Principle (ISP)

> Los clientes no deben verse forzados a depender de interfaces que no usan.

### ✅ Aplicación en el Proyecto

#### Interfaz Mínima y Específica
```python
class FileExtractorStrategy(ABC):
    @abstractmethod
    def extract_text(self, file_path: str) -> str:
        pass
    
    @abstractmethod
    def get_supported_extensions(self) -> List[str]:
        pass
```

**Solo 2 métodos esenciales**:
- `extract_text()` - Funcionalidad core
- `get_supported_extensions()` - Metadatos necesarios

### Ejemplo de Violación (evitado)
```python
# ❌ MAL - Interfaz inflada
class FileExtractorStrategy(ABC):
    def extract_text(self, file): pass
    def validate_file(self, file): pass  # No todos necesitan
    def compress_file(self, file): pass  # No todos necesitan
    def encrypt_file(self, file): pass   # No todos necesitan
    def send_email(self, file): pass     # No todos necesitan
```

### Beneficios
- ✅ Fácil implementar nuevas estrategias
- ✅ No se fuerza a implementar métodos innecesarios
- ✅ Interfaz clara y enfocada

---

## Dependency Inversion Principle (DIP)

> Depender de abstracciones, no de concreciones.

### ✅ Aplicación en el Proyecto

#### FileProcessor Depende de Abstracción
```python
class FileProcessor:
    def __init__(self, strategy: FileExtractorStrategy):  # Abstracción
        self._strategy = strategy
    
    def extract_text(self, file_path: str) -> str:
        return self._strategy.extract_text(file_path)  # Usa abstracción
```

**NO depende de**:
- ❌ `PDFExtractorStrategy` (concreción)
- ❌ `WordExtractorStrategy` (concreción)

**SÍ depende de**:
- ✅ `FileExtractorStrategy` (abstracción)

#### Inyección de Dependencias
```python
# La estrategia se inyecta desde fuera
processor = FileProcessor(PDFExtractorStrategy())

# Fácil cambiar implementación
processor = FileProcessor(WordExtractorStrategy())

# Fácil usar mocks en tests
processor = FileProcessor(MockStrategy())
```

### Beneficios
- ✅ Facilita testing (mocks)
- ✅ Bajo acoplamiento
- ✅ Alta cohesión
- ✅ Flexibilidad

---

## Resumen de Aplicación

| Principio | Archivos Principales | Beneficio Clave |
|-----------|---------------------|-----------------|
| **SRP** | Todas las clases | Mantenibilidad |
| **OCP** | `file_extractor_strategies.py` | Extensibilidad |
| **LSP** | Estrategias | Intercambiabilidad |
| **ISP** | `FileExtractorStrategy` | Simplicidad |
| **DIP** | `FileProcessor` | Testabilidad |

---

## Métricas de Calidad

### Cohesión
- ✅ **Alta**: Cada clase tiene responsabilidades relacionadas
- ✅ Métodos trabajan con los mismos datos
- ✅ Funcionalidad enfocada

### Acoplamiento
- ✅ **Bajo**: Dependencias a través de abstracciones
- ✅ Módulos independientes
- ✅ Fácil cambiar implementaciones

### Mantenibilidad
- ✅ Código auto-documentado
- ✅ Patrones claros
- ✅ Fácil agregar funcionalidad

---

## Mejores Prácticas Aplicadas

1. **Programar contra interfaces, no implementaciones**
   - Uso de clases abstractas
   - Type hints con abstracciones

2. **Favorecer composición sobre herencia**
   - Strategy pattern en lugar de herencia compleja
   - Inyección de dependencias

3. **Principio DRY (Don't Repeat Yourself)**
   - `BaseRepository` para lógica común
   - Métodos helper reutilizables

4. **Separación de Concerns**
   - Lógica de negocio separada de persistencia
   - Configuración separada de implementación

---

## Referencias

- **SOLID Principles**: Robert C. Martin (Uncle Bob)
- **Clean Code**: Robert C. Martin
- **Design Patterns**: Gang of Four
- **Refactoring**: Martin Fowler
