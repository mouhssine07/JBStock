package com.jbstock.backend.storage;

import com.jbstock.backend.JbstockApplication;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class StartupFailureTests {
    @TempDir Path root;

    @Test
    void invalidDatabaseIsNotReplaced() throws Exception {
        Files.createDirectories(root.resolve("data"));
        Path database = root.resolve("data/jbstock.db");
        Files.writeString(database, "not a database - preserve me");
        assertThatThrownBy(() -> start()).isInstanceOf(RuntimeException.class);
        assertThat(Files.readString(database)).isEqualTo("not a database - preserve me");
        assertThat(Files.readString(root.resolve("logs/jbstock.log"))).contains("SQLITE_NOTADB")
                .doesNotContain("not a database - preserve me", "DATABASE_OPEN_RETRY");
    }

    @Test
    void unusableStoragePreventsDatabaseCreation() throws Exception {
        Files.writeString(root.resolve("media"), "existing file");
        assertThatThrownBy(() -> start()).isInstanceOf(RuntimeException.class);
        assertThat(root.resolve("data/jbstock.db")).doesNotExist();
        assertThat(Files.readString(root.resolve("media"))).isEqualTo("existing file");
    }

    @Test
    void failedMigrationPreservesExistingDataAndDoesNotStartBackend() throws Exception {
        try (var context = start()) {
            context.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                    .update("UPDATE company_profile SET name='Migration sentinel' WHERE id=1");
        }
        Path migrations = Files.createDirectories(root.resolve("test-migrations"));
        Files.writeString(migrations.resolve("V4__intentional_failure.sql"),
                "UPDATE company_profile SET name='Should rollback' WHERE id=1;\nINVALID SQL;\n");
        assertThatThrownBy(() -> start("--spring.flyway.locations=classpath:db/migration,filesystem:" + migrations))
                .isInstanceOf(RuntimeException.class);
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + root.resolve("data/jbstock.db"));
             var statement = connection.createStatement();
             var result = statement.executeQuery("SELECT name FROM company_profile WHERE id=1")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getString(1)).isEqualTo("Migration sentinel");
        }
    }

    private ConfigurableApplicationContext start(String... extra) {
        var args = new ArrayList<>(List.of("--server.port=0", "--jbstock.storage.home=" + root,
                "--jbstock.storage.database-path=", "--spring.datasource.url=",
                "--jbstock.security.local-session-token=" + "a".repeat(64)));
        args.addAll(List.of(extra));
        return new SpringApplicationBuilder(JbstockApplication.class).run(args.toArray(String[]::new));
    }
}
