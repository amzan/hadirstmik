CREATE TABLE legacy_review_actors (
  id VARCHAR(100) PRIMARY KEY,
  actor_type ENUM('USER','HISTORICAL_OPERATOR') NOT NULL,
  user_id VARCHAR(100) NULL UNIQUE,
  provenance JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_actor_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_review_actor_type CHECK (
    (actor_type='USER' AND user_id IS NOT NULL AND user_id=id AND provenance IS NULL)
    OR (actor_type='HISTORICAL_OPERATOR' AND user_id IS NULL AND provenance IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO legacy_review_actors (id,actor_type,user_id)
SELECT DISTINCT actor_id,'USER',actor_id FROM (
  SELECT created_by AS actor_id FROM legacy_exclude_batches
  UNION SELECT decided_by FROM legacy_exclude_items WHERE decided_by IS NOT NULL
  UNION SELECT admin_id FROM legacy_exclude_decisions
) AS existing_actors;

ALTER TABLE legacy_exclude_batches DROP FOREIGN KEY legacy_exclude_batches_ibfk_1,
  ADD CONSTRAINT fk_legacy_batch_actor FOREIGN KEY (created_by) REFERENCES legacy_review_actors(id) ON DELETE RESTRICT;
ALTER TABLE legacy_exclude_items DROP FOREIGN KEY legacy_exclude_items_ibfk_2,
  ADD CONSTRAINT fk_legacy_item_actor FOREIGN KEY (decided_by) REFERENCES legacy_review_actors(id) ON DELETE RESTRICT;
ALTER TABLE legacy_exclude_decisions DROP FOREIGN KEY legacy_exclude_decisions_ibfk_2,
  ADD CONSTRAINT fk_legacy_decision_actor FOREIGN KEY (admin_id) REFERENCES legacy_review_actors(id) ON DELETE RESTRICT;

ALTER TABLE audit_logs ADD COLUMN historical_actor_id VARCHAR(100) NULL,
  ADD CONSTRAINT fk_log_historical_actor FOREIGN KEY (historical_actor_id) REFERENCES legacy_review_actors(id) ON DELETE RESTRICT;

CREATE TABLE legacy_review_transfer_provenance (
  source_hash CHAR(64) PRIMARY KEY,
  transfer_hash CHAR(64) NOT NULL,
  original_ciphertext LONGTEXT NOT NULL,
  original_operators JSON NOT NULL,
  original_audit JSON NOT NULL,
  original_key_hash CHAR(64) NOT NULL,
  transferred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_transfer_source FOREIGN KEY (source_hash) REFERENCES legacy_exclude_batches(source_hash) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
