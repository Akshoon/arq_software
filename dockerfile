# Usar imagen oficial ligera de Node.js
FROM node:22-slim

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema si fueran necesarias para pdf-parse o scraping
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiar manifiestos de paquetes
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar el código fuente con Arquitectura Hexagonal
COPY . .

# Crear directorio temporal para cargas de archivos
RUN mkdir -p uploads_node archivos

# Exponer el puerto de la aplicación web
EXPOSE 5000

# Comando por defecto para iniciar el servidor web
CMD ["npm", "start"]
