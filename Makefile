.PHONY: help dev test build up down logs backup restore clean

.DEFAULT_GOAL := help

APP_DIR := app

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

dev:  ## Run the app in watch mode (Deno) from /app
	cd $(APP_DIR) && deno task dev

test:  ## Run tests (Deno) from /app
	cd $(APP_DIR) && deno test --allow-net --allow-env --allow-read

build:  ## Build Docker images [Phase 1+]
	@echo "Not implemented yet (Phase 1)."

up:  ## Start the stack [Phase 1+]
	@echo "Not implemented yet (Phase 1)."

down:  ## Stop the stack [Phase 1+]
	@echo "Not implemented yet (Phase 1)."

logs:  ## Tail logs [Phase 1+]
	@echo "Not implemented yet (Phase 1)."

backup:  ## Run backup routine [Phase 8+]
	@echo "Not implemented yet (Phase 8)."

restore:  ## Run restore routine [Phase 8+]
	@echo "Not implemented yet (Phase 8)."

clean:  ## Remove generated artifacts
	@echo "Nothing to clean yet."
