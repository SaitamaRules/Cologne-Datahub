// mongosh < queries_mongo.js

use("cologne_datahub");


// 31. Find all trees of species 'Acer platanoides'

db.arboles.find({
  "properties.botanischer_name": "Acer platanoides"
}).limit(10);

// Count for reference:
db.arboles.countDocuments({
  "properties.botanischer_name": "Acer platanoides"
});


// 32. Total number of documents in the collection

db.arboles.countDocuments({});


// 33. All trees classified as natural monuments

db.arboles.find({
  "properties.naturdenkmal": "ja"
}).limit(10);

// Count for reference:
db.arboles.countDocuments({
  "properties.naturdenkmal": "ja"
});


// 34. Aggregation: number of trees per neighborhood

db.arboles.aggregate([
  { $group: {
      _id: "$properties.stadtteil",
      total: { $sum: 1 }
  }},
  { $sort: { total: -1 } }
]);


// 35. Aggregation: average trunk circumference per
//     neighborhood (excluding nulls)

db.arboles.aggregate([
  { $match: { "properties.stammumfang": { $ne: null } } },
  { $group: {
      _id: "$properties.stadtteil",
      avg_circumference: { $avg: "$properties.stammumfang" }
  }},
  { $sort: { avg_circumference: -1 } }
]);


// 36. Trees planted after 2000 AND circumference > 100 cm

db.arboles.find({
  "properties.pflanzjahr": { $gt: 2000 },
  "properties.stammumfang": { $gt: 100 }
}).limit(10);

// Count for reference:
db.arboles.countDocuments({
  "properties.pflanzjahr": { $gt: 2000 },
  "properties.stammumfang": { $gt: 100 }
});


// 37. Geospatial: all trees within 500m of Cologne Cathedral
//     (lon: 6.9578, lat: 50.9413)
//     Requires 2dsphere index on 'geometry'.

db.arboles.find({
  geometry: {
    $near: {
      $geometry: { type: "Point", coordinates: [6.9578, 50.9413] },
      $maxDistance: 500
    }
  }
}).limit(10);


// 38. Geospatial: trees within a polygon ($geoWithin)
//     Approximate bounding box of Altstadt-Nord / Innenstadt.
//     Adjust coordinates with geojson.io for precision.

db.arboles.find({
  geometry: {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [[
          [6.9450, 50.9350],
          [6.9650, 50.9350],
          [6.9650, 50.9450],
          [6.9450, 50.9450],
          [6.9450, 50.9350]
        ]]
      }
    }
  }
}).limit(10);
