package com.jbstock.backend.diagnostics;

import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.core.util.FileSize;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.*;

class TechnicalLogTests {
    @TempDir Path directory;

    @Test
    void logsUsefulLocationsWithoutMessagesArgumentsOrMdcAndRotates() throws Exception {
        var context = new LoggerContext();
        context.setMDCAdapter(new ch.qos.logback.classic.util.LogbackMDCAdapter());
        context.start();
        try {
            try (var log = new TechnicalLog(context, directory, FileSize.valueOf("1KB"))) {
                var logger = context.getLogger("com.jbstock.test");
                for (int i = 0; i < 200; i++) {
                    logger.error("password=PRIVATE-PASSWORD customer=PRIVATE-CUSTOMER {}", "PRIVATE-TOKEN",
                            new IllegalStateException("SQL PRIVATE-SQL", new RuntimeException("PRIVATE-CAUSE")));
                }
            }
            try (var files = Files.list(directory)) {
                var paths = files.toList();
                assertThat(paths).anyMatch(path -> path.toString().endsWith(".gz"));
                for (var path : paths) {
                    String text;
                    if (path.toString().endsWith(".gz")) {
                        try (var zip = new java.util.zip.GZIPInputStream(Files.newInputStream(path))) {
                            text = new String(zip.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                        }
                    } else text = Files.readString(path);
                    assertThat(text).doesNotContain("PRIVATE-", "password=");
                }
            }
            assertThat(Files.readString(directory.resolve("jbstock.log"))).contains("LOGGING_STOPPED");
        } finally { context.stop(); }
    }

    @Test
    void unwritableLogTargetFailsExplicitly() throws Exception {
        Files.createDirectory(directory.resolve("jbstock.log"));
        var context = new LoggerContext();
        try {
            assertThatThrownBy(() -> new TechnicalLog(context, directory, FileSize.valueOf("1KB")))
                    .isInstanceOf(java.io.IOException.class);
        } finally { context.stop(); }
    }

    @Test
    void startupDiagnosticUsesStableCodesWithoutExceptionMessages() {
        assertThat(StartupFailureListener.classify(new RuntimeException("secret", new java.sql.SQLException("secret"))))
                .isEqualTo("DATABASE_ERROR");
        assertThat(StartupFailureListener.classify(new java.io.IOException("secret"))).isEqualTo("STORAGE_ERROR");
        assertThat(StartupFailureListener.classify(new org.flywaydb.core.api.FlywayException("secret"))).isEqualTo("MIGRATION_ERROR");
    }

    @Test
    void databaseDiagnosticKeepsOnlyWhitelistedCodes() throws Exception {
        var context = new LoggerContext();
        context.setMDCAdapter(new ch.qos.logback.classic.util.LogbackMDCAdapter());
        context.start();
        try (var log = new TechnicalLog(context, directory, FileSize.valueOf("10MB"))) {
            var logger = context.getLogger("com.jbstock.database");
            logger.error("SQLITE_CANTOPEN");
            logger.error("PRIVATE-PATH PRIVATE-SQL");
            logger.error("SQLITE_READONLY", new IllegalStateException("PRIVATE-DATA"));
        } finally { context.stop(); }
        assertThat(Files.readString(directory.resolve("jbstock.log")))
                .contains("SQLITE_CANTOPEN", "SQLITE_READONLY", "TECHNICAL_EVENT").doesNotContain("PRIVATE-");
        assertThat(SqliteFailure.code(new java.sql.SQLException("PRIVATE-SQL"))).isEqualTo("DATABASE_FAILURE");
    }

    @Test
    void sqliteCausesAreCategorizedWithoutReadingMessages() {
        for (var value : java.util.Map.of(
                org.sqlite.SQLiteErrorCode.SQLITE_BUSY, "SQLITE_BUSY",
                org.sqlite.SQLiteErrorCode.SQLITE_LOCKED, "SQLITE_BUSY",
                org.sqlite.SQLiteErrorCode.SQLITE_READONLY, "SQLITE_READONLY",
                org.sqlite.SQLiteErrorCode.SQLITE_IOERR, "SQLITE_IOERR",
                org.sqlite.SQLiteErrorCode.SQLITE_CORRUPT, "SQLITE_CORRUPT",
                org.sqlite.SQLiteErrorCode.SQLITE_FULL, "SQLITE_FULL",
                org.sqlite.SQLiteErrorCode.SQLITE_CANTOPEN, "SQLITE_CANTOPEN",
                org.sqlite.SQLiteErrorCode.SQLITE_NOTADB, "SQLITE_NOTADB").entrySet()) {
            var failure = new RuntimeException("PRIVATE-PATH", new org.sqlite.SQLiteException("PRIVATE-SQL", value.getKey()));
            assertThat(SqliteFailure.code(failure)).isEqualTo(value.getValue());
            assertThat(SqliteFailure.mayBeTransient(failure))
                    .isEqualTo(java.util.Set.of("SQLITE_BUSY", "SQLITE_CANTOPEN").contains(value.getValue()));
        }
    }
}
