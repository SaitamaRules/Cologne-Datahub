# Cologne DataHub

This project was developed during my Erasmus+ mobility in Cologne (ASIR Higher Degree). The goal is to process real spatial data from the city and serve it through a modern REST API.

## Description and Data Source

The system consumes, stores, and serves data from the public tree registry of Cologne. The original data comes from a municipal WFS (Web Feature Service) that provides the info in GeoJSON format.

* **WFS Source:** [Cologne Tree Registry (GeoJSON)](https://geoportal.stadt-koeln.de/wss/service/baumkataster_extern_wfs/guest?service=WFS&version=2.0.0&request=GetFeature&typeNames=ms:baumkataster&outputFormat=application/json;%20subtype=geojson)

## Requirements

To run this project you need:
* **Deno 2.x** (Main runtime)
* **PostgreSQL 15+** (Relational database)
* **Git** (Version control)

## Setup and Installation

1. **Clone the repo and setup the database:**
   Create a database named `cologne_datahub` in your PostgreSQL server and run the `sql/schema.sql` file to create the tables.

2. **Load the data (Optional):**
   If you don't have the data yet, run the scripts in the `scripts/` folder in this order:
   ```bash
   deno run --allow-net --allow-write scripts/fetch_data.ts
   deno run --allow-read --allow-net --allow-env scripts/import_pg.ts
