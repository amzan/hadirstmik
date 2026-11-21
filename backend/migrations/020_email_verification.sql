ALTER TABLE auth_challenges MODIFY COLUMN purpose ENUM('reset','change','verify') NOT NULL;
