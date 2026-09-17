# Yayına almak için:
#   docker build -t chatbot .
#   docker run -p 3000:3000 --env-file .env chatbot
FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.mjs"]
