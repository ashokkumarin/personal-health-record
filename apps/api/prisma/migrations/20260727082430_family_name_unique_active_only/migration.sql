-- Replace the plain unique index on Family.name with a partial unique index
-- that only applies to non-deleted families, so a name freed up by a soft
-- delete can be reused.
DROP INDEX "Family_name_key";

CREATE UNIQUE INDEX "Family_name_active_key" ON "Family"("name") WHERE "deletedAt" IS NULL;
