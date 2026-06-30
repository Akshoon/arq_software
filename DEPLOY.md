# Guía de Despliegue (Deployment)

Esta aplicación está lista para ser desplegada en plataformas de nube modernas. A continuación, se detallan los pasos para desplegar en **Railway** o **Render**, que son las opciones recomendadas por su facilidad de uso con Docker y Selenium.

## ⚠️ Consideración Importante: Base de Datos

La aplicación utiliza **SQLite** por defecto.
- **En la nube (Render/Railway/Heroku/Vercel):** El sistema de archivos suele ser *efímero*. Esto significa que si la aplicación se reinicia (por inactividad o actualización), **se borrará la base de datos** y los reportes generados.
- **Solución:**
    - **Opción A (Recomendada para producción):** Configurar un volumen persistente (Railway y Render lo soportan) para montar la carpeta donde se guarda `bibliografia.db`.
    - **Opción B (Uso temporal):** Si solo necesitas procesar arquivos y descargar el CSV inmediatamente, no necesitas hacer nada extra.

## Opción 1: Despliegue en Railway (Recomendado)

Railway detecta automáticamente el `Dockerfile`.

1.  Crea una cuenta en [railway.app](https://railway.app/).
2.  Instala el CLI de Railway (opcional) o sube tu código a GitHub.
3.  **Nuevo Proyecto** -> **Deploy from GitHub repo**.
4.  Selecciona este repositorio.
5.  **Variables de Entorno**:
    Agrega las siguientes variables en la pestaña "Variables":
    - `OPENAI_API_KEY`: Tu clave de OpenAI.
    - `GEMINI_API_KEY`: Tu clave de Gemini.
    - `PORT`: 5000 (Railway suele asignarlo automáticamente, pero es bueno definirlo).
6.  Railway construirá la imagen usando el Dockerfile incluido (que instala Python + Chrome).

## Opción 2: Despliegue en Render

1.  Crea una cuenta en [render.com](https://render.com/).
2.  **New +** -> **Web Service**.
3.  Conecta tu repositorio de GitHub.
4.  **Runtime**: Selecciona **Docker**.
5.  **Variables de Entorno**:
    - `OPENAI_API_KEY`: ...
    - `GEMINI_API_KEY`: ...
6.  **Disk (Opcional)**: Si quieres persistencia, añade un disco y móntalo en `/app/archivos` o donde esté tu DB.

## Prueba Local con Docker

Si tienes Docker instalado en tu máquina, puedes probar la imagen antes de subirla:

1.  **Construir imagen**:
    ```bash
    docker build -t bibliografia-app .
    ```

2.  **Correr contenedor**:
    ```bash
    docker run -p 5000:5000 --env-file .env bibliografia-app
    ```
    Visita `http://localhost:5000`.

## Notas Técnicas

- **Chrome/Selenium**: El `Dockerfile` ya incluye la instalación de Google Chrome y las dependencias necesarias.
- **Memoria**: Selenium consume bastante memoria RAM. En los planes gratuitos de nube, podría fallar si se procesan muchos archivos simultáneamente.
- **Tiempo de Espera**: El scraping puede tardar. Asegúrate de configurar los timeouts de la plataforma a un valor alto (ej. 300 segundos) si es posible.
