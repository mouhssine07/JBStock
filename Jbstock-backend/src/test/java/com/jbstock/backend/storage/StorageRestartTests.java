package com.jbstock.backend.storage;

import com.jbstock.backend.JbstockApplication;
import com.jbstock.backend.company.CompanyProfile;
import com.jbstock.backend.company.CompanyProfileRepository;
import com.jbstock.backend.company.CompanyProfileRequest;
import com.jbstock.backend.company.FiscalIdentifierRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class StorageRestartTests {
    @TempDir Path temporary;

    @Test
    void dataAndMediaSurviveTwoCompleteBackendLifecycles() throws Exception {
        CompanyProfile saved;
        Path media = temporary.resolve("media/products/originals/persistence-test.txt");
        try (var context = start()) {
            saved = context.getBean(CompanyProfileRepository.class).update(new CompanyProfileRequest(
                    "Persistence demo", "Fictional address", "", "demo@example.com",
                    List.of(new FiscalIdentifierRequest("Demo", "TEST-001"))));
            Files.writeString(media, "media sentinel");
        }
        try (var context = start()) {
            assertThat(context.getBean(CompanyProfileRepository.class).get()).isEqualTo(saved);
            var jdbc = context.getBean(JdbcTemplate.class);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success = 1", Integer.class)).isEqualTo(3);
            assertThat(jdbc.queryForObject("PRAGMA quick_check", String.class)).isEqualTo("ok");
            assertThat(jdbc.queryForObject("PRAGMA synchronous", Integer.class)).isEqualTo(2);
            assertThat(Files.readString(media)).isEqualTo("media sentinel");
        }
    }

    private ConfigurableApplicationContext start() {
        return new SpringApplicationBuilder(JbstockApplication.class).run(
                "--server.port=0", "--jbstock.storage.home=" + temporary,
                "--jbstock.storage.database-path=", "--spring.datasource.url=",
                "--jbstock.security.local-session-token=" + UUID.randomUUID().toString().replace("-", "")
                        + UUID.randomUUID().toString().replace("-", ""));
    }
}
