# Conversión a Markdown - Beneficios y Uso

## ¿Por qué Markdown?

La conversión a Markdown antes de procesar con OpenAI ofrece varios beneficios:

### 1. **Reducción de Tokens** 💰
- Markdown es más compacto que texto plano sin estructura
- Elimina espacios y saltos de línea innecesarios
- Reduce el costo de procesamiento con la API de OpenAI

### 2. **Mejor Precisión** 🎯
- Preserva la estructura del documento (títulos, listas, tablas)
- La IA puede identificar mejor las secciones de bibliografía
- Mejora la extracción de información estructurada

### 3. **Formato Consistente** 📋
- Normaliza el formato independientemente del archivo fuente
- Facilita el procesamiento uniforme de PDFs y Word
- Simplifica el mantenimiento del código

## Librerías Utilizadas

### `pymupdf4llm` (para PDF)
- Convierte PDFs directamente a Markdown
- Preserva títulos, listas, tablas y formato
- Más eficiente que extraer texto plano

### `mammoth` (para Word)
- Convierte archivos .docx a Markdown
- Mantiene la estructura del documento
- Maneja estilos y formato

## Optimizaciones Aplicadas

Ambas estrategias aplican las siguientes optimizaciones al Markdown:

1. **Eliminar líneas vacías excesivas**: Máximo 2 líneas consecutivas
2. **Limpiar espacios**: Elimina espacios al final de líneas
3. **Normalizar títulos**: Asegura formato correcto de encabezados
4. **Reducir ruido**: Elimina caracteres innecesarios

## Ejemplo de Conversión

### Antes (Texto Plano)
```
BIBLIOGRAFÍA BÁSICA


Martuccelli, D.     (2007).     Cambio de rumbo.     Santiago: LOM.


Bourdieu, P. (1999). La miseria del mundo. Buenos Aires: FCE.
```

### Después (Markdown Optimizado)
```markdown
# BIBLIOGRAFÍA BÁSICA

Martuccelli, D. (2007). Cambio de rumbo. Santiago: LOM.

Bourdieu, P. (1999). La miseria del mundo. Buenos Aires: FCE.
```

## Impacto en Tokens

**Estimación de ahorro:**
- Texto plano: ~1000 tokens por documento
- Markdown optimizado: ~700-800 tokens por documento
- **Ahorro: 20-30% en tokens**

## Uso Transparente

El cambio es completamente transparente para el usuario:
- No requiere cambios en el flujo de trabajo
- Funciona automáticamente con PDFs y Word
- La salida final es la misma

## Código de Ejemplo

```python
from file_extractor_strategies import FileProcessor

# El procesador ahora retorna Markdown automáticamente
processor = FileProcessor.create_for_file("documento.pdf")
markdown_text = processor.extract_text("documento.pdf")

# El texto ya está en formato Markdown optimizado
print(markdown_text)
```

## Verificación

Para verificar que la conversión funciona correctamente:

1. Procesa un archivo PDF o Word
2. Observa la salida en la consola
3. Verifica que el formato Markdown esté presente (títulos con #, listas, etc.)
4. Compara el número de tokens usado en OpenAI (debería ser menor)
