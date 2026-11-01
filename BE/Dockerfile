# syntax=docker/dockerfile:1
# Nightcrawlers backend. Build context: BE/
# - deps:    Maven dependencies (pom.xml only), on the build host's platform (no QEMU for Maven).
# - modules: jdeps over the dependency jars lists the Java modules they need (build platform).
# - jre:     jlink on the target platform builds a trimmed runtime from that list (small image
#            for the GHCR free quota). deps, modules and jre do not depend on src/, so they stay
#            cached across application commits.
# - build:   the application jar, extracted (Spring Boot jarmode tools).
# - runtime: Ubuntu base (bash for the healthcheck), unprivileged user.

FROM --platform=$BUILDPLATFORM eclipse-temurin:25-jdk AS deps
WORKDIR /src
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 \
    sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -B -q dependency:go-offline \
    && ./mvnw -B -q dependency:copy-dependencies -DincludeScope=runtime -DoutputDirectory=/deps

FROM deps AS modules
# Modular jars require modules that are not on the class path (jakarta.cdi...), so the classes are
# unpacked without module-info and analysed as one directory. jdk.compiler is dropped: only build
# tooling references it (the runtime was verified without it).
RUN mkdir /tmp/classes && cd /tmp/classes \
    && for jar in /deps/*.jar; do jar xf "$jar"; done \
    && find . -name module-info.class -delete \
    && jdeps --ignore-missing-deps --print-module-deps --multi-release 25 -q . > /tmp/modules \
    && tr ',' '\n' < /tmp/modules | grep -vx 'jdk.compiler' | paste -sd, - > /modules.txt \
    && echo "jdeps: $(cat /modules.txt)" \
    && rm -rf /tmp/classes

FROM deps AS build
COPY src/ src/
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -q -DskipTests package \
    && cp target/nightcrawlers-*.jar /tmp/app.jar \
    && java -Djarmode=tools -jar /tmp/app.jar extract --destination /extracted

FROM eclipse-temurin:25-jdk AS jre
COPY --from=modules /modules.txt /modules.txt
# Modules from jdeps, plus a fixed set for the application code and for what is loaded only
# reflectively or by service lookup (JDBC, HTTP client, JNDI/DNS, management, JFR, locales for
# Italian messages, zipfs, crypto providers).
RUN jlink --add-modules "$(cat /modules.txt),java.sql,java.sql.rowset,java.net.http,java.naming,java.desktop,java.management,java.instrument,java.prefs,java.rmi,java.scripting,java.security.jgss,java.compiler,jdk.jfr,jdk.unsupported,jdk.crypto.ec,jdk.naming.dns,jdk.localedata,jdk.zipfs,jdk.management" \
        --include-locales=en,it --strip-debug --no-man-pages --no-header-files \
        --compress=zip-0 --output /jre

FROM ubuntu:24.10
RUN groupadd --system app && useradd --system --gid app --no-create-home --shell /usr/sbin/nologin app
ENV JAVA_HOME=/opt/java \
    PATH=/opt/java/bin:$PATH \
    LANG=C.UTF-8 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
COPY --from=jre /jre /opt/java
WORKDIR /app
COPY --from=build /extracted/lib/ ./lib/
COPY --from=build /extracted/app.jar ./app.jar
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /actuator/health HTTP/1.0\\r\\n\\r\\n' >&3 && grep -q '\"status\":\"UP\"' <&3"]
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
