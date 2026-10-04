package com.jbstock.backend.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;

@Configuration
public class SqliteDataSourceConfiguration {
    @Bean
    HikariDataSource dataSource(DataSourceProperties properties,
                                @Value("${spring.datasource.url}") String jdbcUrl) throws Exception {
        if (jdbcUrl.startsWith("jdbc:sqlite:") && !jdbcUrl.equals("jdbc:sqlite::memory:")) {
            Path databasePath = Path.of(jdbcUrl.substring("jdbc:sqlite:".length()));
            Path parent = databasePath.toAbsolutePath().getParent();
            if (parent != null) Files.createDirectories(parent);
        }
        HikariDataSource dataSource = properties.initializeDataSourceBuilder()
                .type(HikariDataSource.class).build();
        dataSource.setMaximumPoolSize(1);
        dataSource.setConnectionInitSql("PRAGMA foreign_keys=ON");
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode=WAL");
            statement.execute("PRAGMA busy_timeout=5000");
        } catch (Exception exception) {
            dataSource.close();
            throw exception;
        }
        return dataSource;
    }
}
