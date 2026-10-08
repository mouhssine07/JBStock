package com.jbstock.backend.config;

import com.zaxxer.hikari.HikariDataSource;
import com.jbstock.backend.storage.LocalStorage;
import org.sqlite.SQLiteConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;

import java.sql.Connection;
import java.sql.Statement;

@Configuration
public class SqliteDataSourceConfiguration {
    @Bean
    @DependsOn("technicalLog")
    HikariDataSource dataSource(LocalStorage storage) throws Exception {
        SQLiteConfig sqlite = new SQLiteConfig();
        sqlite.enforceForeignKeys(true);
        sqlite.setBusyTimeout(5000);
        sqlite.setJournalMode(SQLiteConfig.JournalMode.WAL);
        sqlite.setSynchronous(SQLiteConfig.SynchronousMode.FULL);
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(storage.jdbcUrl());
        dataSource.setDriverClassName("org.sqlite.JDBC");
        dataSource.setMaximumPoolSize(1);
        dataSource.setConnectionTimeout(30000);
        // Driver properties are applied on EVERY physical connection, including replacements.
        dataSource.setDataSourceProperties(sqlite.toProperties());
        for (int attempt = 0; ; attempt++) {
            try (Connection connection = dataSource.getConnection();
                 Statement statement = connection.createStatement()) {
                try (var result = statement.executeQuery("PRAGMA journal_mode")) {
                    if (!result.next() || !"wal".equalsIgnoreCase(result.getString(1))) {
                        throw new IllegalStateException("SQLite WAL mode is required for the local database.");
                    }
                }
                return dataSource;
            } catch (Exception exception) {
                var logger = org.slf4j.LoggerFactory.getLogger("com.jbstock.database");
                String code = com.jbstock.backend.diagnostics.SqliteFailure.code(exception);
                if (attempt >= 2 || !com.jbstock.backend.diagnostics.SqliteFailure.mayBeTransient(exception)) {
                    // Keep the precise safe cause before Spring closes the file logger.
                    logger.error(code, exception);
                    dataSource.close();
                    throw exception;
                }
                logger.warn(code, exception);
                logger.warn("DATABASE_OPEN_RETRY");
                // Retry the same file only. Never replace, move, reset or fall back to another DB.
                try { Thread.sleep(250L << attempt); }
                catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    dataSource.close();
                    throw interrupted;
                }
            }
        }
    }
}
