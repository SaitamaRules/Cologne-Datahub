-- 1. First we do a test run.
EXPLAIN ANALYZE SELECT * FROM trees WHERE botanical_name = 'Acer platanoides';

-- 2. Then we create the index.
CREATE INDEX idx_trees_botanical_name ON trees(botanical_name);

-- 3. And then we do the test again.
EXPLAIN ANALYZE SELECT * FROM trees WHERE botanical_name = 'Acer platanoides';
