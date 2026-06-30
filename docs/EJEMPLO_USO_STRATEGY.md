# Ejemplo de Uso del Patrón Strategy

Este archivo demuestra cómo usar el nuevo sistema de procesamiento de archivos.

## Uso Básico

```python
from file_extractor_strategies import FileProcessor

# Ejemplo 1: Procesar un PDF
pdf_processor = FileProcessor.create_for_file("documento.pdf")
texto_pdf = pdf_processor.extract_text("documento.pdf")
print(f"Texto extraído del PDF: {texto_pdf[:100]}...")

# Ejemplo 2: Procesar un Word
word_processor = FileProcessor.create_for_file("documento.docx")
texto_word = word_processor.extract_text("documento.docx")
print(f"Texto extraído del Word: {texto_word[:100]}...")
```

## Uso con el Sistema Completo

```python
from main import procesar_archivos

# Procesar todos los archivos PDF y Word en un directorio
procesar_archivos(
    directorio='archivos/',
    facultad='Ciencias Sociales',
    carrera_default='Trabajo Social'
)
```

## Crear una Nueva Estrategia

Para agregar soporte para archivos de texto plano (.txt):

```python
from file_extractor_strategies import FileExtractorStrategy
import os

class TextExtractorStrategy(FileExtractorStrategy):
    """Estrategia para extraer texto de archivos .txt"""
    
    def extract_text(self, file_path: str) -> str:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"El archivo no existe: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def get_supported_extensions(self) -> list:
        return ['.txt']
```

Luego agregar al factory method en `FileProcessor.create_for_file()`:

```python
estrategias = {
    '.pdf': PDFExtractorStrategy(),
    '.docx': WordExtractorStrategy(),
    '.txt': TextExtractorStrategy()  # Nueva estrategia
}
```
