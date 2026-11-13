package com.nightcrawlers.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Every Italian key exists in English and Spanish, and every key used by the code exists. */
class MessageBundlesTest {

    static Properties load(String resource) {
        try (InputStream in = MessageBundlesTest.class.getClassLoader().getResourceAsStream(resource)) {
            assertThat(in).as(resource).isNotNull();
            Properties properties = new Properties();
            properties.load(new InputStreamReader(in, StandardCharsets.UTF_8));
            return properties;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static Set<String> keys(Properties properties) {
        return new TreeSet<>(properties.stringPropertyNames());
    }

    @ParameterizedTest
    @ValueSource(strings = { "i18n/messages", "mail/messages" })
    void everyLanguageHasTheSameKeysAsItalian(String basename) {
        Properties italian = load(basename + "_it.properties");
        assertThat(italian).isNotEmpty();
        assertThat(load(basename + ".properties")).as("default bundle is Italian").isEqualTo(italian);
        for (String language : new String[] { "en", "es" }) {
            Properties other = load(basename + "_" + language + ".properties");
            assertThat(keys(other)).as(basename + " " + language).isEqualTo(keys(italian));
            other.forEach((key, value) -> assertThat(value.toString()).as(language + " " + key).isNotBlank());
        }
    }

    /** The error bundle always goes through MessageFormat: a lone apostrophe would vanish. */
    @ParameterizedTest
    @ValueSource(strings = { "it", "en", "es" })
    void errorMessagesEscapeApostrophes(String language) {
        Pattern lone = Pattern.compile("(?<!')'(?!')");
        load("i18n/messages_" + language + ".properties").forEach((key, value) -> assertThat(
                lone.matcher(value.toString().replace("''", "")).find()).as(language + " " + key).isFalse());
    }

    @Test
    void everyKeyUsedByTheCodeExists() throws IOException {
        Set<String> keys = keys(load("i18n/messages_it.properties"));
        // a code followed by "+" is a prefix completed at runtime (error.http<status>)
        Pattern code = Pattern.compile("\"(error\\.[A-Za-z]+)\"(?!\\s*\\+)");
        Pattern key = Pattern.compile("\"\\{?((?:validation|field|password|message)\\.[A-Za-z.]+)\\}?\"");
        Set<String> missing = new TreeSet<>();
        try (Stream<Path> files = Files.walk(Path.of("src/main/java"))) {
            for (Path file : files.filter(f -> f.toString().endsWith(".java")).toList()) {
                String source = Files.readString(file);
                Matcher m = code.matcher(source);
                while (m.find()) {
                    if (!keys.contains(m.group(1) + ".title")) {
                        missing.add(m.group(1) + ".title in " + file.getFileName());
                    }
                }
                m = key.matcher(source);
                while (m.find()) {
                    if (!keys.contains(m.group(1))) {
                        missing.add(m.group(1) + " in " + file.getFileName());
                    }
                }
            }
        }
        assertThat(missing).isEmpty();
    }
}
