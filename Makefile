.PHONY: help dev test build up down restart logs ps fetch-data seed-pg seed-mongo seed backup restore clean

.DEFAULT_GOAL := help

APP_DIR     := app
COMPOSE     := docker compose -f infra/docker-compose.yml --env-file .env

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

dev:  ## Run the app in watch mode (Deno, native, requires .env in /app)
	cd $(APP_DIR) && deno task dev

test:  ## Run tests (Deno) from /app
	cd $(APP_DIR) && deno test --allow-net --allow-env --allow-read

build:  ## Build the app image
	$(COMPOSE) build

up:  ## Start the full stack (app + postgres + mongo) in the background
	$(COMPOSE) up -d

down:  ## Stop the stack (volumes preserved)
	$(COMPOSE) down

restart:  ## Restart the stack
	$(COMPOSE) restart

logs:  ## Tail all stack logs
	$(COMPOSE) logs -f --tail=100

ps:  ## Show container status
	$(COMPOSE) ps

fetch-data:  ## Fetch the 500-feature sample GeoJSON from Cologne WFS into app/data/
	cd $(APP_DIR) && deno run --allow-net --allow-write scripts/fetch_data.ts

seed-pg:  ## Import app/data/baumkataster.json into PostgreSQL (one-shot container)
	$(COMPOSE) --profile import run --rm import-pg

seed-mongo:  ## Import app/data/baumkataster.json into MongoDB (creates 2dsphere index)
	$(COMPOSE) --profile import run --rm import-mongo

seed: seed-pg seed-mongo  ## Seed both databases

backup:  ## Run backup routine [Phase 8+]
	@echo "Not implemented yet (Phase 8)."

restore:  ## Run restore routine [Phase 8+]
	@echo "Not implemented yet (Phase 8)."

clean:  ## Stop stack and REMOVE all volumes (destructive)
	$(COMPOSE) down -v
