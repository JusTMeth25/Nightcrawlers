# Nightcrawlers

Roguelike survivors-like per browser con orde infinite, ambientato nell'universo di Cyberpunk Edgerunners. Giocabile da desktop (tastiera + mouse), smartphone (touch) e controller.

> **Disclaimer:** Nightcrawlers è un gioco fan non ufficiale e non commerciale. Non è affiliato, approvato o sponsorizzato da CD Projekt né da Studio Trigger. Cyberpunk, Cyberpunk Edgerunners e i relativi personaggi sono marchi e proprietà dei rispettivi titolari.

## Struttura

- `FE/` — frontend React + TypeScript + Vite + Phaser 4
- `BE/` — backend Spring Boot 4 + PostgreSQL
- `tools/` — script di sviluppo (pipeline sprite, sync dati di gioco)
- `assets-src/` — sorgenti grafiche (non servite dal web server)
- `docs/` — spec, piani, contratto API

## Prerequisiti

- Node.js 24
- Java 25 (Temurin)
- PostgreSQL 18 (database `nightcrawlers`)
- Docker Desktop (test di integrazione backend e stack Docker Compose)

## Documentazione

- `docs/dev-setup.md` — ambiente di sviluppo locale e stack Docker
- `docs/deploy.md` — deploy su Oracle Cloud, DuckDNS, Brevo, backup
- `docs/api/openapi.yaml` — contratto API
- `e2e/README.md` — test end-to-end

## Sviluppo

Frontend:

```bash
cd FE
npm install
npm run dev        # http://localhost:5173 (anche da telefono sulla stessa rete)
npm test
npm run lint
npm run build
```

Backend:

```bash
cd BE
cp src/main/resources/application-local.properties.example src/main/resources/application-local.properties
# compila i valori locali (mai committare questo file)
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
./mvnw verify
```
