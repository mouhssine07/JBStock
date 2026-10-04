package com.jbstock.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "spring.datasource.url=jdbc:sqlite:target/sqlite-foundation-test.db")
class JbstockApplicationTests {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @LocalServerPort
    private int port;

    @Test
    void contextLoads() { }

    @Test
    void healthEndpointIsAvailableWithoutAuthenticationOnLocalServer() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/actuator/health"))
                .GET()
                .build();
        HttpResponse<String> response = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"status\":\"UP\"");
    }

    @Test
    void sqlitePragmasAreEnabled() {
        assertThat(jdbcTemplate.queryForObject("PRAGMA foreign_keys", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("PRAGMA journal_mode", String.class)).isEqualToIgnoringCase("wal");
        assertThat(jdbcTemplate.queryForObject("PRAGMA busy_timeout", Integer.class)).isEqualTo(5000);
    }

    @Test
    void flywayAppliesTheFoundationMigration() {
        assertThat(jdbcTemplate.queryForObject(
                "SELECT metadata_value FROM application_metadata WHERE metadata_key = 'schema_initialized'",
                String.class)).isEqualTo("true");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '1' AND success = 1",
                Integer.class)).isEqualTo(1);
    }
}