# Cologne DataHub - Project

## Week 1: WFS Data Fetching & PostgreSQL

### 1.2 WFS Service Exploration

**6. What is a WFS (Web Feature Service)? What is it used for?**  
It is an OGC standard used to query and exchange geographic vector data over the web. Instead of getting a rendered map image, it allows us to consume the raw underlying map data directly.

**7. What is GeoJSON? What types of geometry exist?**  
It is an open, JSON-based format for geographic features and their attributes. Standard geometry types include Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, and GeometryCollection.

**8. Why does the service provide GeoJSON instead of CSV?**  
GeoJSON natively standardizes spatial metadata and geometry. The service provides this rather than a CSV because CSVs require custom workarounds to store coordinates, making interoperability with GIS tools much harder.

**9. What does the parameter typeNames=ms:baumkataster mean?**  
It specifies the exact data layer requested from the WFS server. In this case, it targets the tree registry dataset.

**10. What is the COUNT parameter used for?**  
It limits the maximum number of records returned in a single request.

### 1.3 Deno and data obtained

**11. What fields does a single feature contain?**  
A single feature consists of a `type` string (set to "Feature"), a `geometry` object containing the coordinates, and a `properties` object that holds all the tree attributes like `baumnummer`, `botanischer_name`, and `strasse`.

**12. Where are the coordinates and in what format (lon/lat or lat/lon)?**  
The coordinates are inside the geometry.coordinates array. The standard GeoJSON format uses Longitude first, then Latitude (lon/lat).

**13. What fields have NULL values?**  
Measurements like kronendurchmesser (crown diameter), stammumfang (trunk circumference), and baumhoehe (tree height) often contain null values.

**14. What is the difference between properties and geometry in GeoJSON?**  
Geometry defines the spatial location of the tree (coordinates). Properties describe the tree's physical attributes, such as its species, dimensions, and planting year.

### 1.4 Database Schema Design

**1. Which fields are suitable as a primary key?**  
A key like an auto-incrementing id (SERIAL) is the standard for relational mapping. The tree ID serves as a natural key and must have a UNIQUE constraint to prevent duplicates.

**2. Which fields could be moved to their own tables?**  
The neighborhood could be extracted into a separate table to normalize the database, establishing a (1:N) relationship. Location types (derived from the first letter of the tree number, e.g., S=Street, G=Park) could also be separated.

**3. How will you store the coordinates?**  
For this initial stage, they are stored as two separate NUMERIC(10,7) columns (lat and lon).  
The optimal, long-term solution for geospatial data in PostgreSQL is using the PostGIS extension.

### 1.7 Bonus Task: Indexing and PostGIS

#### Performance Comparison (EXPLAIN ANALYZE)

To evaluate the performance improvement of indexing, a query searching for a specific botanical name (Acer platanoides) was executed before and after creating a B-Tree index.

**Before Indexing (Sequential Scan):**

- **Execution Time:** ~5.5 ms
- **Observation:** PostgreSQL performs a sequential scan.

**After Indexing (Index Scan):**

- **Execution Time:** ~1.5 ms
- **Observation:** PostgreSQL uses an index scan, drastically reducing the execution time as it searches directly within the optimized B-Tree structure instead of scanning the entire table.

#### PostGIS Extension Research

**What is the PostGIS extension for PostgreSQL and what does it bring to geodata?**

- **Definition:** PostGIS is a spatial database extender for the PostgreSQL object-relational database. It adds support for geographic objects, allowing location-aware queries to be run natively in SQL.  
  **Native Spatial Data Types:** Replaces basic `NUMERIC` `lat`/`lon` columns with native `Geometry` or `Geography` types (Points, Lines, Polygons).  
  **Spatial Indexing:** Introduces GiST (Generalized Search Tree) indexes, which are specifically optimized for multi-dimensional spatial queries (e.g., finding all items within a specific map view).

## Week 3: Native GeoJSON in MongoDB

### 3.2 Fundamental Concepts

**26. What is the advantage of storing GeoJSON directly in MongoDB (compared to PostgreSQL)?**  
It eliminates the need for data transformation. MongoDB natively stores BSON/JSON objects, allowing us to import the entire `Feature` block exactly as it comes from the WFS. This preserves its nested structure (`geometry` and `properties`) without needing to extract coordinates into separate relational columns.

**27. What is the difference between a "document" and a "row"?**  
A row in PostgreSQL is a flat, rigid two-dimensional structure where every column requires a strict, predefined data type. A document in MongoDB is a hierarchical data structure (JSON/BSON format) that allows nesting arrays and sub-objects at multiple levels within a single database entry.

**28. What does "schemaless" mean in practice? Is it an advantage here?**  
"Schemaless" means the database does not enforce a strict structural blueprint (like tables and columns) before inserting data. This is highly advantageous for this project; if the Cologne WFS suddenly adds a new attribute to the tree `properties` (e.g., last pruning date), MongoDB will store it automatically without requiring a database migration or `ALTER TABLE` command.

**29. What is a 2dsphere index and what is it used for?**  
It is a specialized spatial index designed to support queries that calculate geometries on an earth-like sphere. It significantly speeds up geospatial operations, such as calculating exact distances, finding all trees within a specific polygon, or locating the nearest features to a given coordinate point (`$near`).

**30. When is MongoDB a better choice than PostgreSQL?**  
MongoDB is preferable when handling datasets with highly nested or variable structures (like native GeoJSON), when rapid prototyping requires flexibility without strict schema design, and when the application primarily reads and writes self-contained documents rather than relying heavily on complex relational joins.

## Troubleshooting & Blocks

**1. Connection refused on WFS fetch**  
The Deno fetch request to the Cologne Geoportal WFS failed with a **Connection refused** error. The network firewall (University) was blocking direct outbound HTTPS traffic to external services.  
Bypassed by temporarily switching the host machine to an external mobile hotspot and downloading both the small dataset (500 records) and the full dataset (~60MB).

**2. MongoDB BSON Memory Overflow on Import**  
When attempting to import the full ~58MB dataset into MongoDB using a single `insertMany()` call, the Deno script crashed with a `RangeError: offset is out of bounds`. The underlying BSON serializer ran out of memory buffer trying to process the massive array.  
Bypassed by modifying the import script to process the data in smaller batches, slicing the main array and inserting exactly 500 documents per iteration.  

**3. MongoDB 2dsphere Index "Out of bounds" Error**  
Creating the spatial index (`2dsphere`) failed because the longitude/latitude values were extremely large (e.g., ~352668, ~5652168). The WFS server provided the data in a local German cartographic projection (EPSG:25832, measured in meters), but MongoDB strictly requires the global GPS standard (WGS84/EPSG:4326, measured in degrees from -180 to 180).  
Bypassed by importing the `proj4` npm library into the Deno script to mathematically transform the coordinates from EPSG:25832 to EPSG:4326 in memory right before inserting them into the database.
