package com.jbstock.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class JbstockApplicationTests {
    private static final String TOKEN = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    @DynamicPropertySource
    static void isolatedDatabase(DynamicPropertyRegistry registry) {
        String root = java.nio.file.Path.of("target", "sqlite-foundation-" + UUID.randomUUID()).toAbsolutePath().toString();
        registry.add("jbstock.storage.home", () -> root);
        registry.add("jbstock.storage.database-path", () -> "");
        registry.add("spring.datasource.url", () -> "");
        registry.add("jbstock.security.local-session-token", () -> TOKEN);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private com.zaxxer.hikari.HikariDataSource dataSource;

    @Autowired
    private com.jbstock.backend.company.CompanyProfileRepository companyRepository;

    @Test
    void replacementConnectionRetainsPragmasAndEnforcesForeignKeys() throws Exception {
        org.sqlite.SQLiteConnection original;
        try (var connection = dataSource.getConnection()) {
            original = connection.unwrap(org.sqlite.SQLiteConnection.class);
            dataSource.evictConnection(connection);
        }
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.unwrap(org.sqlite.SQLiteConnection.class)).isNotSameAs(original);
        }
        sqlitePragmasAreEnabled();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO company_fiscal_identifier (company_id, label, value, position) VALUES (999, 'demo', '', 0)"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }

    @Test
    void failedCompanyUpdateRollsBackProfileAndAllIdentifiers() {
        companyRepository.update(new com.jbstock.backend.company.CompanyProfileRequest("Before rollback", "Original", "", "",
                java.util.List.of(new com.jbstock.backend.company.FiscalIdentifierRequest("Original ID", "KEEP-001"))));
        var before = companyRepository.get();
        var request = new com.jbstock.backend.company.CompanyProfileRequest("Rollback demo", "changed", "", "",
                java.util.List.of(new com.jbstock.backend.company.FiscalIdentifierRequest("Valid", "one"),
                        new com.jbstock.backend.company.FiscalIdentifierRequest("", "invalid")));
        // Bypass HTTP validation deliberately: the second insert must fail inside the SQL transaction.
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> companyRepository.update(request))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(companyRepository.get()).isEqualTo(before);
    }

    @LocalServerPort
    private int port;

    @Test
    void contextLoads() { }

    @ParameterizedTest
    @ValueSource(strings = {"", "wrong-token", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})
    void missingOrInvalidTokenCannotReadOrModifyCompany(String token) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        URI endpoint = URI.create("http://127.0.0.1:" + port + "/api/company");
        HttpRequest read = HttpRequest.newBuilder(endpoint).header("X-JBStock-Local-Token", TOKEN).build();
        String before = client.send(read, HttpResponse.BodyHandlers.ofString()).body();
        for (String method : new String[]{"GET", "PUT"}) {
            var builder = HttpRequest.newBuilder(endpoint).header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString("{\"name\":\"Intruder\",\"fiscalIdentifiers\":[]}"));
            if (!token.isEmpty()) builder.header("X-JBStock-Local-Token", token);
            var response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(401);
            assertThat(response.body()).contains("LOCAL_SESSION_UNAUTHORIZED").doesNotContain(TOKEN);
            assertThat(response.headers().firstValue("set-cookie")).isEmpty();
        }
        assertThat(client.send(read, HttpResponse.BodyHandlers.ofString()).body()).isEqualTo(before);
    }

    @Test
    void duplicateTokenHeadersAreRejected() throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/company"))
                .header("X-JBStock-Local-Token", TOKEN).header("X-JBStock-Local-Token", TOKEN).build();
        assertThat(HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/users", "/actuator/env", "/unknown"})
    void tokenDoesNotGrantAccessToOtherRoutes(String path) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .header("X-JBStock-Local-Token", TOKEN).build();
        assertThat(HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(403);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/health", "/actuator/health"})
    void healthEndpointIsAvailableWithoutAuthenticationOnLocalServer(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + path))
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
        assertThat(jdbcTemplate.queryForObject("PRAGMA synchronous", Integer.class)).isEqualTo(2);
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

    @Test
    void companyProfileCanBeReadAndUpdatedWithLocalToken() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        URI endpoint = URI.create("http://127.0.0.1:" + port + "/api/company");
        HttpRequest update = HttpRequest.newBuilder(endpoint).header("X-JBStock-Local-Token", TOKEN)
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString("""
                        {"name":"JBStock Demo","address":"Main Street","phone":"+212600000000","email":"hello@example.com","fiscalIdentifiers":[{"label":"Tax ID","value":"TX-123"},{"label":"Regional number","value":"REG-456"}]}
                        """))
                .build();

        HttpResponse<String> updated = client.send(update, HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> fetched = client.send(HttpRequest.newBuilder(endpoint).header("X-JBStock-Local-Token", TOKEN).GET().build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(updated.statusCode()).isEqualTo(200);
        assertThat(updated.body()).contains("\"name\":\"JBStock Demo\"");
        assertThat(fetched.statusCode()).isEqualTo(200);
        assertThat(fetched.body()).contains("\"address\":\"Main Street\"")
                .contains("\"email\":\"hello@example.com\"")
                .contains("\"label\":\"Tax ID\"")
                .contains("\"value\":\"REG-456\"");
    }

    @Test
    void companyProfileRejectsBlankName() throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/company")).header("X-JBStock-Local-Token", TOKEN)
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString("{\"name\":\"  \",\"address\":\"\",\"phone\":\"\",\"email\":\"\",\"fiscalIdentifiers\":[]}"))
                .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.body()).contains("\"code\":\"VALIDATION_ERROR\"", "\"fields\":[\"name\"]");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"name\":\"Invalid\",\"fiscalIdentifiers\":[null]}",
            "{\"name\":\"Invalid\",\"fiscalIdentifiers\":[{\"label\":\" \"}]}",
            "{\"name\":\"Invalid\",\"fiscalIdentifiers\":null}",
            "{\"name\":\"Invalid\",\"email\":\"not-an-email\",\"fiscalIdentifiers\":[]}",
            "{invalid-json"
    })
    void invalidRequestDoesNotChangeCompany(String body) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        URI endpoint = URI.create("http://127.0.0.1:" + port + "/api/company");
        HttpRequest read = HttpRequest.newBuilder(endpoint).header("X-JBStock-Local-Token", TOKEN).GET().build();
        String before = client.send(read, HttpResponse.BodyHandlers.ofString()).body();
        HttpRequest update = HttpRequest.newBuilder(endpoint).header("X-JBStock-Local-Token", TOKEN)
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(body)).build();

        HttpResponse<String> response = client.send(update, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.body()).contains(body.equals("{invalid-json") ? "INVALID_JSON" : "VALIDATION_ERROR");
        assertThat(client.send(read, HttpResponse.BodyHandlers.ofString()).body()).isEqualTo(before);
    }
}
