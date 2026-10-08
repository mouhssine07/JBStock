package com.jbstock.backend.security;

import com.jbstock.backend.config.SecurityConfiguration;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;

import static org.assertj.core.api.Assertions.assertThat;

class LocalSessionTokenConfigurationTests {
    @Configuration(proxyBeanMethods = false)
    @EnableWebSecurity
    @Import(SecurityConfiguration.class)
    static class TestSecurity { }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"short", "                                                                ",
            "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"})
    void securityContextCannotStartWithoutValidSecret(String token) {
        var runner = new WebApplicationContextRunner().withUserConfiguration(TestSecurity.class);
        if (token != null) runner = runner.withPropertyValues("jbstock.security.local-session-token=" + token);
        runner.run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(IllegalStateException.class)
                    .hasStackTraceContaining("JBSTOCK_LOCAL_SESSION_TOKEN must contain");
        });
    }
}
