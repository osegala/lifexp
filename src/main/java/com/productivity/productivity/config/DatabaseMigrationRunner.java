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
        migrateCosmetics();
        migrateUserCosmetics();
        migrateUsers();
        migrateAvatars();
        migrateGameSystems();
    }

    private void migrateUsers() {
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak integer");
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak integer");
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_task_completed_date date");
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS coins integer");
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_active boolean");
        jdbcTemplate.execute("UPDATE users SET current_streak = 0 WHERE current_streak IS NULL");
        jdbcTemplate.execute("UPDATE users SET longest_streak = 0 WHERE longest_streak IS NULL");
        jdbcTemplate.execute("UPDATE users SET coins = 0 WHERE coins IS NULL");
        jdbcTemplate.execute("UPDATE users SET premium_active = false WHERE premium_active IS NULL");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN current_streak SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN longest_streak SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN coins SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN premium_active SET DEFAULT false");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN current_streak SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN longest_streak SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN coins SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN premium_active SET NOT NULL");
    }

    private void migrateAvatars() {
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS body_type varchar(255)");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_hair_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_top_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_bottom_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_boots_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_cape_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_weapon_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_shield_id bigint");
        jdbcTemplate.execute("UPDATE avatars SET body_type = 'BOY' WHERE body_type IS NULL");
    }

    private void migrateGameSystems() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_weekly_quest_claims (
                    id bigserial PRIMARY KEY,
                    user_id bigint NOT NULL REFERENCES users(id),
                    quest_key varchar(255) NOT NULL,
                    week_start date NOT NULL,
                    CONSTRAINT uk_weekly_quest_claim UNIQUE (user_id, quest_key, week_start)
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_achievement_claims (
                    id bigserial PRIMARY KEY,
                    user_id bigint NOT NULL REFERENCES users(id),
                    achievement_key varchar(255) NOT NULL,
                    claimed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uk_achievement_claim UNIQUE (user_id, achievement_key)
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_building_interiors (
                    id bigserial PRIMARY KEY,
                    user_id bigint NOT NULL REFERENCES users(id),
                    building_type varchar(255) NOT NULL,
                    wall_style varchar(255),
                    floor_style varchar(255),
                    center_item varchar(255),
                    left_item varchar(255),
                    right_item varchar(255),
                    CONSTRAINT uk_building_interiors_user_type UNIQUE (user_id, building_type)
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS friendships (
                    id bigserial PRIMARY KEY,
                    requester_id bigint NOT NULL REFERENCES users(id),
                    receiver_id bigint NOT NULL REFERENCES users(id),
                    status varchar(255) NOT NULL,
                    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uk_friendships_pair UNIQUE (requester_id, receiver_id)
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id bigserial PRIMARY KEY,
                    sender_id bigint NOT NULL REFERENCES users(id),
                    recipient_id bigint REFERENCES users(id),
                    realm varchar(255) NOT NULL DEFAULT 'town-square',
                    body varchar(500) NOT NULL,
                    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void migrateTasks() {
        jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived boolean");
        jdbcTemplate.execute("UPDATE tasks SET archived = false WHERE archived IS NULL");
        jdbcTemplate.execute("ALTER TABLE tasks ALTER COLUMN archived SET DEFAULT false");
        jdbcTemplate.execute("ALTER TABLE tasks ALTER COLUMN archived SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check");
        normalizeTaskCategoryLabels("tasks");
    }

    private void migrateTaskCompletions() {
        jdbcTemplate.execute("ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS awarded_xp integer");
        jdbcTemplate.execute("ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS category varchar(255)");
        jdbcTemplate.execute("ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS building_type varchar(255)");
        jdbcTemplate.execute("ALTER TABLE task_completions DROP CONSTRAINT IF EXISTS task_completions_category_check");

        jdbcTemplate.execute("""
                UPDATE task_completions completion
                SET awarded_xp = task.xp_value,
                    category = task.category,
                    building_type = CASE task.category
                        WHEN 'Cleaning' THEN 'HOME_BASE'
                        WHEN 'CLEANING' THEN 'HOME_BASE'
                        WHEN 'Work' THEN 'WORKSHOP'
                        WHEN 'WORK' THEN 'WORKSHOP'
                        WHEN 'School' THEN 'LIBRARY'
                        WHEN 'SCHOOL' THEN 'LIBRARY'
                        WHEN 'Fitness' THEN 'TRAINING_GROUNDS'
                        WHEN 'FITNESS' THEN 'TRAINING_GROUNDS'
                        WHEN 'Health' THEN 'GARDEN'
                        WHEN 'HEALTH' THEN 'GARDEN'
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

        normalizeTaskCategoryLabels("task_completions");
        jdbcTemplate.execute("UPDATE task_completions SET awarded_xp = 0 WHERE awarded_xp IS NULL");
        jdbcTemplate.execute("ALTER TABLE task_completions ALTER COLUMN awarded_xp SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE task_completions ALTER COLUMN awarded_xp SET NOT NULL");
    }

    private void normalizeTaskCategoryLabels(String tableName) {
        jdbcTemplate.execute("""
                UPDATE %s
                SET category = CASE category
                    WHEN 'School' THEN 'SCHOOL'
                    WHEN 'Fitness' THEN 'FITNESS'
                    WHEN 'Cleaning' THEN 'CLEANING'
                    WHEN 'Work' THEN 'WORK'
                    WHEN 'Health' THEN 'HEALTH'
                    WHEN 'Personal Growth' THEN 'PERSONAL_GROWTH'
                    ELSE category
                END
                WHERE category IN (
                    'School',
                    'Fitness',
                    'Cleaning',
                    'Work',
                    'Health',
                    'Personal Growth'
                )
                """.formatted(tableName));
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

    private void migrateCosmetics() {
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_hair_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_hat_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_cape_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_weapon_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_shield_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_background_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_pet_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_aura_id bigint");
        jdbcTemplate.execute("ALTER TABLE avatars ADD COLUMN IF NOT EXISTS equipped_outfit_id bigint");
        jdbcTemplate.execute("ALTER TABLE cosmetics DROP CONSTRAINT IF EXISTS cosmetics_type_check");
        jdbcTemplate.execute("""
                UPDATE cosmetics
                SET name = 'Moss Golem',
                    required_level = 5,
                    image_url = 'avatar-v2/pets/moss-golem'
                WHERE image_url = 'avatar/pets/tiny-dragon'
                """);
        jdbcTemplate.execute("""
                UPDATE cosmetics
                SET name = 'Seraphic Light',
                    required_level = 6,
                    image_url = 'avatar-v2/auras/seraphic-light'
                WHERE image_url = 'avatar/auras/golden'
                """);
        jdbcTemplate.execute("""
                UPDATE cosmetics
                SET name = 'Phoenix Flame',
                    required_level = 12,
                    image_url = 'avatar-v2/auras/phoenix-flame'
                WHERE image_url = 'avatar/auras/phoenix'
                """);

        jdbcTemplate.execute("""
                UPDATE avatars
                SET equipped_hair_id = NULL
                WHERE equipped_hair_id IN (
                    SELECT id FROM cosmetics
                    WHERE image_url = 'avatar-v2/hair/adventurer-brown'
                )
                """);
        jdbcTemplate.execute("""
                UPDATE avatars
                SET equipped_hat_id = NULL
                WHERE equipped_hat_id IN (
                    SELECT id FROM cosmetics
                    WHERE image_url IN (
                        'avatar/legacy/hats/starter-cap',
                        'avatar/legacy/hats/gym-headband',
                        'avatar/legacy/hats/knight-helm',
                        'avatar/legacy/hats/ranger-hood',
                        'avatar-v2/hats/azure-mage-hat'
                    )
                )
                """);
        jdbcTemplate.execute("""
                UPDATE avatars
                SET equipped_cape_id = NULL
                WHERE equipped_cape_id IN (
                    SELECT id FROM cosmetics
                    WHERE image_url = 'avatar-v2/capes/azure-cape'
                )
                """);
        jdbcTemplate.execute("""
                UPDATE avatars
                SET equipped_shield_id = NULL
                WHERE equipped_shield_id IN (
                    SELECT id FROM cosmetics
                    WHERE image_url = 'avatar-v2/shields/azure-shield'
                )
                """);
        jdbcTemplate.execute("""
                UPDATE avatars
                SET equipped_weapon_id = NULL
                WHERE equipped_weapon_id IN (
                    SELECT id FROM cosmetics
                    WHERE image_url = 'avatar-v2/weapons/azure-sword'
                )
                """);
        jdbcTemplate.execute("UPDATE avatars SET equipped_outfit_id = NULL");
        jdbcTemplate.execute("""
                UPDATE avatars
                SET equipped_background_id = NULL
                WHERE equipped_background_id IN (
                    SELECT id FROM cosmetics
                    WHERE image_url IN (
                        'avatar/backgrounds/forest',
                        'avatar/backgrounds/moonlit-forest'
                    )
                )
                """);
        jdbcTemplate.execute("""
                DELETE FROM user_cosmetics
                WHERE cosmetic_id IN (
                    SELECT id FROM cosmetics
                    WHERE type IN ('FULL_SET', 'OUTFIT')
                       OR image_url IN (
                           'avatar-v2/hair/adventurer-brown',
                           'avatar/legacy/hats/starter-cap',
                           'avatar/legacy/hats/gym-headband',
                           'avatar/legacy/hats/knight-helm',
                           'avatar/legacy/hats/ranger-hood',
                           'avatar-v2/hats/azure-mage-hat',
                           'avatar-v2/capes/azure-cape',
                           'avatar-v2/weapons/azure-sword',
                           'avatar-v2/shields/azure-shield',
                           'avatar/backgrounds/forest',
                           'avatar/backgrounds/moonlit-forest'
                       )
                )
                """);
        jdbcTemplate.execute("""
                DELETE FROM cosmetics
                WHERE type IN ('FULL_SET', 'OUTFIT')
                   OR image_url IN (
                       'avatar-v2/hair/adventurer-brown',
                       'avatar/legacy/hats/starter-cap',
                       'avatar/legacy/hats/gym-headband',
                       'avatar/legacy/hats/knight-helm',
                       'avatar/legacy/hats/ranger-hood',
                       'avatar-v2/hats/azure-mage-hat',
                       'avatar-v2/capes/azure-cape',
                       'avatar-v2/weapons/azure-sword',
                       'avatar-v2/shields/azure-shield',
                       'avatar/backgrounds/forest',
                       'avatar/backgrounds/moonlit-forest'
                   )
                """);
        jdbcTemplate.execute("ALTER TABLE avatars DROP COLUMN IF EXISTS equipped_outfit_id");

        jdbcTemplate.execute("""
                ALTER TABLE cosmetics
                ADD CONSTRAINT cosmetics_type_check
                CHECK (type IN (
                    'HAIR',
                    'HAT',
                    'TOP',
                    'BOTTOM',
                    'BOOTS',
                    'CAPE',
                    'WEAPON',
                    'SHIELD',
                    'BACKGROUND',
                    'PET',
                    'AURA'
                ))
                """);
    }
}
