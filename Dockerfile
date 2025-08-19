FROM python:3.10-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar arquivos de requisitos primeiro para aproveitar o cache
COPY requirements.txt .

# Instalar dependências do Python
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copiar o código da aplicação
COPY . .

# Expor a porta que a aplicação usará
ENV PORT=4000
EXPOSE $PORT

# Comando para iniciar a aplicação
CMD gunicorn --bind 0.0.0.0:$PORT wsgi:application
