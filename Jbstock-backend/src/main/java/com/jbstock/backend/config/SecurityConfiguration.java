package com.jbstock.backend.config;

import com.jbstock.backend.security.LocalSessionTokenFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;

@Configuration
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain applicationSecurity(HttpSecurity http,
            @Value("${jbstock.security.local-session-token:}") String token) throws Exception {
        // Construct inside the chain: no servlet-container registration or duplicate invocation.
        LocalSessionTokenFilter tokenFilter = new LocalSessionTokenFilter(token);
        return http.csrf(csrf -> csrf.ignoringRequestMatchers("/api/company"))
                .addFilterBefore(tokenFilter, CsrfFilter.class)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, "/health", "/actuator/health").permitAll()
                        // Token checked above; local user authentication is a separate upcoming step.
                        .requestMatchers(HttpMethod.GET, "/api/company").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/company").permitAll()
                        .anyRequest().denyAll())
                .build();
    }

    @Bean
    UserDetailsService userDetailsService() {
        // No implicit development account/password. Replace with local users in the auth step.
        return new InMemoryUserDetailsManager();
    }
}
