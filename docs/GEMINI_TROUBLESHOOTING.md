# Guía de Verificación de Gemini API

## Paso 1: Verificar/Obtener API Key

1. **Accede a Google AI Studio**:
   - Ve a: https://aistudio.google.com/app/apikey
   - O: https://makersuite.google.com/app/apikey

2. **Inicia sesión** con tu cuenta de Google

3. **Crea o verifica tu API key**:
   - Si no tienes una, haz clic en "Create API Key"
   - Si ya tienes una, cópiala

4. **Importante**: Verifica que la API key:
   - Esté activa (no revocada)
   - Tenga el formato: `AIza...` (empieza con AIza)

## Paso 2: Verificar Disponibilidad Regional

Gemini está disponible en la mayoría de países, pero hay algunas restricciones:

**Países con acceso completo**:
- Estados Unidos
- Canadá
- Reino Unido
- Europa (mayoría)
- América Latina (mayoría)

**Si estás en un país restringido**:
- Usa solo OpenAI (el sistema ya tiene fallback automático)

## Paso 3: Verificar Modelo Disponible

Los modelos disponibles actualmente son:
- ✅ `gemini-pro` (modelo estable, recomendado)
- ✅ `gemini-1.5-flash` (rápido y económico)
- ⚠️ `gemini-2.0-flash` (puede no estar disponible en todas las regiones)

## Paso 4: Configurar en .env

Edita tu archivo `.env`:

```env
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Gemini API Key
GEMINI_API_KEY=AIza...  # Pega tu API key aquí

# Configuración de proveedor
AI_PROVIDER=auto
```

## Paso 5: Cambiar Modelo en ai_providers.py

Si `gemini-2.0-flash` no funciona, cambia a un modelo estable:

**Opción 1: Gemini 1.5 Flash (recomendado)**
```python
# Línea 149 en ai_providers.py
self.model = genai.GenerativeModel('gemini-1.5-flash')
```

**Opción 2: Gemini Pro**
```python
# Línea 149 en ai_providers.py
self.model = genai.GenerativeModel('gemini-pro')
```

## Paso 6: Probar la Configuración

Crea un archivo de prueba `test_gemini.py`:

```python
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Configurar API key
api_key = os.getenv('GEMINI_API_KEY')
print(f"API Key encontrada: {api_key[:10]}..." if api_key else "No se encontró API key")

genai.configure(api_key=api_key)

# Probar modelos
modelos_a_probar = ['gemini-pro', 'gemini-1.5-flash', 'gemini-2.0-flash']

for modelo_nombre in modelos_a_probar:
    try:
        print(f"\n🔄 Probando {modelo_nombre}...")
        modelo = genai.GenerativeModel(modelo_nombre)
        respuesta = modelo.generate_content("Di 'Hola' en una palabra")
        print(f"✓ {modelo_nombre} funciona!")
        print(f"   Respuesta: {respuesta.text}")
    except Exception as e:
        print(f"✗ {modelo_nombre} falló: {str(e)[:100]}")
```

Ejecuta:
```bash
python test_gemini.py
```

## Solución de Problemas Comunes

### Error 429: Quota Exceeded

**Causa 1**: API key inválida o revocada
- Solución: Genera una nueva API key

**Causa 2**: Modelo no disponible en tu región
- Solución: Usa `gemini-pro` en lugar de `gemini-2.0-flash`

**Causa 3**: Límite de rate (muy raro en cuentas nuevas)
- Solución: Espera unos minutos y reintenta

### Error 404: Model Not Found

**Causa**: El modelo no existe o no está disponible
- Solución: Cambia a `gemini-pro` o `gemini-1.5-flash`

### Error 403: Permission Denied

**Causa**: API key sin permisos o región restringida
- Solución: Verifica permisos en Google AI Studio

## Configuración Recomendada

Para máxima compatibilidad, usa:

```python
# En ai_providers.py línea 149
self.model = genai.GenerativeModel('gemini-1.5-flash')
```

Este modelo es:
- ✅ Estable y ampliamente disponible
- ✅ Rápido (optimizado para latencia baja)
- ✅ Económico (85% más barato que OpenAI)
- ✅ Compatible con la mayoría de regiones

## Alternativa: Usar Solo OpenAI

Si Gemini sigue sin funcionar, simplemente:

1. Comenta la línea en `.env`:
```env
# GEMINI_API_KEY=...
```

2. El sistema usará solo OpenAI automáticamente

El fallback automático ya está funcionando, así que no pierdes funcionalidad.
