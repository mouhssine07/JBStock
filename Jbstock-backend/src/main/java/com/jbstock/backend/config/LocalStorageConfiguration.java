package com.jbstock.backend.config;

import com.jbstock.backend.storage.LocalStorage;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.io.IOException;

@Configuration(proxyBeanMethods = false)
public class LocalStorageConfiguration {
    @Bean
    LocalStorage localStorage(Environment environment) throws IOException {
        LocalStorage storage = LocalStorage.resolve(
                environment.getProperty("jbstock.storage.home"),
                environment.getProperty("jbstock.storage.database-path"),
                environment.getProperty("spring.datasource.url"),
                environment.getProperty("LOCALAPPDATA"), environment.getProperty("user.home"));
        storage.initializeDirectories();
        return storage;
    }
}
