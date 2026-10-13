-- Product-owned fence; keep the preceding Base owner-claim schema byte-exact.
-- Repeat admission checks inside the signed claim transaction so restored actors
-- cannot be bypassed by a native claim racing the HTTP preflight.
CREATE TRIGGER nook_claim_storage_fence BEFORE INSERT ON oc_owner_claims
WHEN COALESCE((SELECT authority FROM nook_storage WHERE id=1),'')<>'normalized'
  OR EXISTS(SELECT 1 FROM nook_actors)
BEGIN
 SELECT RAISE(ABORT,'owner_claim_requires_empty_normalized_product');
END;
