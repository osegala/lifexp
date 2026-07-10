package com.productivity.productivity.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DatabaseMigrationRunner implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        migrateTasks();
        migrateTaskCompletions();
        migrateUserBuildings();
        migrateUserCosmetics();
    }

    private void migrateTasks() {
        jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived boolean");
        jdbcTemplate.execute("UPDATE tasks SET archived = false WHERE archived IS NULL");
        jdbcTemplate.execute("ALTER TABLE tasks ALTER COLUMN archived SET DEFAULT false");
        jdbcTemplate.execute("ALTER TABLE tasks ALTER COLUMN archived SET NOT NULL");
    }

    private void migrateTaskCompletions() {
        jdbcTemplate.execute("ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS awarded_xp integer");
        jdbcTemplate.execute("ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS category varchar(255)");
        jdbcTemplate.execute("ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS building_type varchar(255)");

        jdbcTemplate.execute("""
                UPDATE task_completions completion
                SET awarded_xp = task.xp_value,
                    category = task.category,
                    building_type = CASE task.category
                        WHEN 'Cleaning' THEN 'HOME_BASE'
                        WHEN 'Work' THEN 'WORKSHOP'
                        WHEN 'School' THEN 'LIBRARY'
                        WHEN 'Fitness' THEN 'TRAINING_GROUNDS'
                        WHEN 'Health' THEN 'GARDEN'
                        ELSE 'HALL_OF_ACHIEVEMENTS'
                    END
                FROM tasks task
                WHERE completion.task_id = task.id
                  AND (
                    completion.awarded_xp IS NULL
                    OR completion.category IS NULL
                    OR completion.building_type IS NULL
                  )
                """);

        jdbcTemplate.execute("UPDATE task_completions SET awarded_xp = 0 WHERE awarded_xp IS NULL");
        jdbcTemplate.execute("ALTER TABLE task_completions ALTER COLUMN awarded_xp SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE task_completions ALTER COLUMN awarded_xp SET NOT NULL");
    }

    private void migrateUserBuildings() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_buildings (
                    id bigserial PRIMARY KEY,
                    user_id bigint NOT NULL REFERENCES users(id),
                    building_type varchar(255) NOT NULL,
                    level integer NOT NULL DEFAULT 1,
                    total_xp integer NOT NULL DEFAULT 0,
                    CONSTRAINT uk_user_buildings_user_type UNIQUE (user_id, building_type)
                )
                """);

        jdbcTemplate.execute("""
                INSERT INTO user_buildings (user_id, building_type, level, total_xp)
                SELECT users.id, building.type, 1, 0
                FROM users
                CROSS JOIN (
                    VALUES
                        ('HOME_BASE'),
                        ('WORKSHOP'),
                        ('LIBRARY'),
                        ('TRAINING_GROUNDS'),
                        ('GARDEN'),
                        ('HALL_OF_ACHIEVEMENTS')
                ) AS building(type)
                ON CONFLICT (user_id, building_type) DO NOTHING
                """);
    }

    private void migrateUserCosmetics() {
        jdbcTemplate.execute("""
                DELETE FROM user_cosmetics duplicate
                USING user_cosmetics original
                WHERE duplicate.id > original.id
                  AND duplicate.user_id = original.user_id
                  AND duplicate.cosmetic_id = original.cosmetic_id
                """);

        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_user_cosmetics_user_cosmetic
                ON user_cosmetics(user_id, cosmetic_id)
                """);
    }
}
