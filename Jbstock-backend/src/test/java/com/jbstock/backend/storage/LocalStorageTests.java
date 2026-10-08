package com.jbstock.backend.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.*;

class LocalStorageTests {
    @TempDir Path temporary;

    @Test
    void usesLocalAppDataAndCreatesAllDirectoriesWithoutTouchingExistingFiles() throws Exception {
        Path local = temporary.resolve("Local déplacé");
        LocalStorage storage = LocalStorage.resolve(null, null, null, local.toString(), temporary.toString());
        assertThat(storage.database()).isEqualTo(local.resolve("JBStock/data/jbstock.db"));
        storage.initializeDirectories();
        for (Path directory : storage.directories()) assertThat(directory).isDirectory();
        Files.writeString(storage.database(), "existing bytes");
        storage.initializeDirectories();
        assertThat(Files.readString(storage.database())).isEqualTo("existing bytes");
    }

    @Test
    void explicitPathsAndExistingJdbcOverrideArePreserved() throws Exception {
        Path root = temporary.resolve("explicit");
        Path db = temporary.resolve("old/data/custom.db");
        LocalStorage storage = LocalStorage.resolve(root.toString(), "ignored.db", "jdbc:sqlite:" + db, null, temporary.toString());
        assertThat(storage.root()).isEqualTo(root);
        assertThat(storage.database()).isEqualTo(db);
        LocalStorage inferred = LocalStorage.resolve(null, db.toString(), null, null, temporary.toString());
        assertThat(inferred.root()).isEqualTo(temporary.resolve("old"));
        assertThat(inferred.database()).isEqualTo(db);
    }

    @Test
    void legacyDatabaseRequiresExplicitSelectionWhenDefaultLocationChanges() throws Exception {
        Path legacy = temporary.resolve("AppData/Local/JBStock/data/jbstock.db");
        Files.createDirectories(legacy.getParent());
        Files.writeString(legacy, "original");
        Path relocated = temporary.resolve("relocated");
        assertThatThrownBy(() -> LocalStorage.resolve(null, null, null, relocated.toString(), temporary.toString()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("JBSTOCK_DATABASE_PATH");
        assertThat(relocated).doesNotExist();
        assertThat(Files.readString(legacy)).isEqualTo("original");
        assertThat(LocalStorage.resolve(null, legacy.toString(), null, relocated.toString(), temporary.toString()).database())
                .isEqualTo(legacy);
        assertThat(LocalStorage.resolve(null, null, null, temporary.resolve("AppData/Local").toString(), temporary.toString()).database())
                .isEqualTo(legacy);
    }

    @Test
    void missingLocalAppDataRequiresExplicitRoot() {
        assertThatThrownBy(() -> LocalStorage.resolve(null, null, null, null, temporary.toString()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("JBSTOCK_HOME");
    }

    @ParameterizedTest
    @ValueSource(strings = {"jdbc:sqlite::memory:", "jdbc:sqlite:file:db?mode=memory", "jdbc:sqlite:", "jdbc:postgresql:db"})
    void unsupportedDatabaseUrlsFailRatherThanOpeningAnotherDatabase(String url) {
        assertThatThrownBy(() -> LocalStorage.resolve(temporary.toString(), null, url, null, temporary.toString()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unusableDirectoryFailsWithoutFallback() throws Exception {
        Path root = temporary.resolve("root");
        Files.createDirectories(root);
        Files.writeString(root.resolve("media"), "not a directory");
        var storage = LocalStorage.resolve(root.toString(), null, null, null, temporary.toString());
        assertThatThrownBy(storage::initializeDirectories).isInstanceOf(java.io.IOException.class);
        assertThat(storage.database()).doesNotExist();
    }
}
