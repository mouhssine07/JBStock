package com.jbstock.backend.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/** Resolved once at startup, shared by the database and future file-based modules. */
public record LocalStorage(Path root, Path database) {
    public static LocalStorage resolve(String rootOverride, String databaseOverride, String jdbcUrl,
                                       String localAppData, String userHome) throws IOException {
        Path database = null;
        if (hasText(jdbcUrl)) {
            if (!jdbcUrl.startsWith("jdbc:sqlite:")) {
                throw new IllegalArgumentException("Only a local SQLite file is supported.");
            }
            database = databasePath(jdbcUrl.substring("jdbc:sqlite:".length()));
        } else if (hasText(databaseOverride)) {
            database = databasePath(databaseOverride);
        }
        Path root;
        if (hasText(rootOverride)) {
            root = Path.of(rootOverride);
            if (!root.isAbsolute()) throw new IllegalArgumentException("JBSTOCK_HOME must be an absolute path.");
            root = root.normalize();
        } else if (database != null) {
            Path parent = database.getParent();
            root = parent.getFileName() != null && parent.getFileName().toString().equalsIgnoreCase("data")
                    ? parent.getParent() : parent;
        } else {
            if (!hasText(localAppData) || !Path.of(localAppData).isAbsolute()) {
                throw new IllegalStateException("LOCALAPPDATA is unavailable; set an absolute JBSTOCK_HOME.");
            }
            root = Path.of(localAppData).resolve("JBStock").normalize();
            Path legacy = Path.of(userHome, "AppData", "Local", "JBStock", "data", "jbstock.db")
                    .toAbsolutePath().normalize();
            Path selected = root.resolve("data/jbstock.db");
            if (!legacy.equals(selected) && Files.exists(legacy)
                    && !(Files.exists(selected) && Files.isSameFile(legacy, selected))) {
                throw new IllegalStateException("An existing database uses the previous location. "
                        + "Set JBSTOCK_DATABASE_PATH to " + legacy + " before restarting. No data was moved.");
            }
        }
        if (database == null) database = root.resolve("data/jbstock.db");
        if (Files.exists(database) && !Files.isRegularFile(database)) {
            throw new IOException("The database path must reference a regular file: " + database);
        }
        return new LocalStorage(root, database);
    }

    public void initializeDirectories() throws IOException {
        for (Path path : directories()) Files.createDirectories(path);
        Files.createDirectories(database.getParent());
    }

    public List<Path> directories() {
        return List.of(root.resolve("data"), root.resolve("media/products/originals"),
                root.resolve("media/products/thumbnails"), root.resolve("invoices"),
                root.resolve("backups"), root.resolve("logs"), root.resolve("config"));
    }

    public String jdbcUrl() { return "jdbc:sqlite:" + database; }

    private static Path databasePath(String value) {
        if (!hasText(value) || value.equals(":memory:") || value.startsWith("file:") || value.contains("?")) {
            throw new IllegalArgumentException("Use a plain SQLite file path, without URI options or in-memory mode.");
        }
        return Path.of(value).toAbsolutePath().normalize();
    }

    private static boolean hasText(String value) { return value != null && !value.isBlank(); }
}
