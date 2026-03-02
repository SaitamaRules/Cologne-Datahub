# Cologne DataHub - Project

## Week 1: WFS Data Fetching & PostgreSQL

### 1.2 WFS Service Exploration

**1. What is a WFS (Web Feature Service)? What is it used for?**
It is an OGC standard used to query and exchange geographic vector data over the web. Instead of getting a rendered map image, it allows us to consume the raw underlying map data directly.

**2. What is GeoJSON? What types of geometry exist?**
It is an open, JSON-based format for geographic features and their attributes. Standard geometry types include Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, and GeometryCollection.

**3. Why does the service provide GeoJSON instead of CSV?**
GeoJSON natively standardizes spatial metadata and geometry. The service provides this rather than a CSV  because CSVs require custom workarounds to store coordinates, making interoperability with GIS tools much harder.

**4. What does the parameter typeNames=ms:baumkataster mean?**
It specifies the exact data layer requested from the WFS server. In this case, it targets the tree registry dataset.

**5. What is the COUNT parameter used for?**
It limits the maximum number of records returned in a single request.
