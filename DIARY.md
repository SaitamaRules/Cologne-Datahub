# Cologne DataHub - Project

## Week 1: WFS Data Fetching & PostgreSQL

### 1.2 WFS Service Exploration

**6. What is a WFS (Web Feature Service)? What is it used for?**  
It is an OGC standard used to query and exchange geographic vector data over the web. Instead of getting a rendered map image, it allows us to consume the raw underlying map data directly.

**7. What is GeoJSON? What types of geometry exist?**  
It is an open, JSON-based format for geographic features and their attributes. Standard geometry types include Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, and GeometryCollection.

**8. Why does the service provide GeoJSON instead of CSV?**  
GeoJSON natively standardizes spatial metadata and geometry. The service provides this rather than a CSV  because CSVs require custom workarounds to store coordinates, making interoperability with GIS tools much harder.

**9. What does the parameter typeNames=ms:baumkataster mean?**  
It specifies the exact data layer requested from the WFS server. In this case, it targets the tree registry dataset.

**10. What is the COUNT parameter used for?**  
It limits the maximum number of records returned in a single request.

### 1.3 Deno and data obtained

**11. Which fields are suitable as a primary key?**  
It contains the standard structure type (geometry and properties).

**12. Where are the coordinates and in what format (lon/lat or lat/lon)?**  
The coordinates are inside the geometry.coordinates array. The standard GeoJSON format uses Longitude first, then Latitude (lon/lat).

**13. What fields have NULL values?**  
Measurements like kronendurchmesser (crown diameter), stammumfang (trunk circumference), and baumhoehe (tree height) often contain null values.

**14. What is the difference between properties and geometry in GeoJSON?**  
Geometry tells us where the tree is, and how is that information stored. Properties tells us about the tree, what is, measurements, etc...

### 1.3 Deno and data obtained

**1. Which fields are suitable as a primary key?**  
A key like an auto-incrementing id (SERIAL) is the standard for relational mapping. The tree ID serves as a natural key and must have a UNIQUE constraint to prevent duplicates.

**2. Which fields could be moved to their own tables?**  
The neighborhood could be extracted into a separate table to normalize the database, establishing a (1:N) relationship. Location types (derived from the first letter of Neighborhoods) could also be separated.

**3. How will you store the coordinates?**  
For this initial stage, they are stored as two separate NUMERIC(10,7) columns (lat and lon) .  
The optimal, long-term solution for geospatial data in PostgreSQL is using the PostGIS extension.

## Troubleshooting & Blocks

**1. Connection refused on WFS fetch**  
The Deno fetch request to the Cologne Geoportal WFS failed with a **Connection refused** error. The network firewall (University) was blocking direct outbound HTTPS traffic to external services.  
Bypassed by temporarily switching the host machine to an external mobile hotspot and downloading both the small dataset (500 records) and the full dataset (~60MB).
