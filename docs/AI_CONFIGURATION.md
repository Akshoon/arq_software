# Guía de Configuración - API Multi-Proveedor

## Configuración de APIs de IA

El sistema ahora soporta múltiples proveedores de IA con balanceo de carga automático:
- **OpenAI** (GPT-3.5 Turbo)
- **Google Gemini** (Gemini 1.5 Flash)

### Paso 1: Obtener API Keys

#### OpenAI
1. Visita https://platform.openai.com/api-keys
2. Crea una cuenta o inicia sesión
3. Genera una nueva API key
4. Copia la clave

#### Gemini (Opcional)
1. Visita https://makersuite.google.com/app/apikey
2. Inicia sesión con tu cuenta de Google
3. Crea una API key
4. Copia la clave

### Paso 2: Configurar Variables de Entorno

Edita el archivo `.env` y agrega tus claves:

```env
# OpenAI API Key (requerido si no usas Gemini)
OPENAI_API_KEY=sk-...

# Gemini API Key (opcional - para balanceo de carga)
GEMINI_API_KEY=AIza...

# Configuración de proveedor
# Opciones: 'openai', 'gemini', 'auto'
AI_PROVIDER=auto
```

### Paso 3: Instalar Dependencias

```bash
pip install google-generativeai
```

## Modos de Operación

### Modo 1: Solo OpenAI
```env
OPENAI_API_KEY=tu_clave
# No configurar GEMINI_API_KEY
AI_PROVIDER=openai
```

### Modo 2: Solo Gemini
```env
GEMINI_API_KEY=tu_clave
# No configurar OPENAI_API_KEY
AI_PROVIDER=gemini
```

### Modo 3: Balanceo Automático (Recomendado)
```env
OPENAI_API_KEY=tu_clave_openai
GEMINI_API_KEY=tu_clave_gemini
AI_PROVIDER=auto
```

**Beneficios del modo auto:**
- ✅ Distribuye carga entre ambas APIs
- ✅ Reduce costos al usar Gemini (más económico)
- ✅ Fallback automático si una API falla
- ✅ Mayor disponibilidad

## Características

### Balanceo de Carga
El sistema alterna automáticamente entre proveedores disponibles:
```
Solicitud 1 → OpenAI
Solicitud 2 → Gemini
Solicitud 3 → OpenAI
Solicitud 4 → Gemini
...
```

### Fallback Automático
Si un proveedor falla, el sistema intenta automáticamente con el siguiente:
```
1. Intenta con OpenAI → Error
2. Intenta con Gemini → ✓ Éxito
```

### Monitoreo
El sistema muestra qué proveedor está usando:
```
📊 Usando proveedor: openai
✓ Respuesta exitosa de OpenAI

📊 Usando proveedor: gemini
✓ Respuesta exitosa de Gemini
```

## Costos Estimados

### OpenAI (GPT-3.5 Turbo)
- Input: $0.50 / 1M tokens
- Output: $1.50 / 1M tokens

### Gemini (1.5 Flash)
- Input: $0.075 / 1M tokens (6.6x más barato)
- Output: $0.30 / 1M tokens (5x más barato)

**Ahorro estimado con balanceo 50/50:**
- ~70% de reducción en costos

## Solución de Problemas

### Error: "No hay proveedores de IA disponibles"
- Verifica que al menos una API key esté configurada en `.env`
- Asegúrate de que el archivo `.env` existe en el directorio raíz

### Error: "GEMINI_API_KEY no está configurada"
- Si solo quieres usar OpenAI, no configures `GEMINI_API_KEY`
- El sistema funcionará solo con OpenAI

### Error: "Error en OpenAI/Gemini"
- Verifica que las API keys sean válidas
- Verifica que tengas créditos disponibles
- Revisa los límites de rate limiting

## Recomendaciones

1. **Desarrollo**: Usa solo OpenAI para consistencia
2. **Producción**: Usa balanceo automático para reducir costos
3. **Alta carga**: Configura ambas APIs para mejor distribución
4. **Presupuesto limitado**: Usa solo Gemini (más económico)

## Ejemplo de Uso Programático

```python
from ai_providers import AIProviderFactory

# Inicializar con balanceo de carga
factory = AIProviderFactory(load_balance=True)

# Generar con fallback automático
response, provider = factory.generate_with_fallback(
    prompt="Extrae la bibliografía...",
    max_tokens=2000
)

print(f"Proveedor usado: {provider}")
print(f"Respuesta: {response}")
```
